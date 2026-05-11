import querystring from 'querystring';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { db } from '../database/connectionPool.js';
import { discordMember, discordToken, authSession } from '../database/schema.js';
import { BusinessError, SystemError } from '../types/error.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { systemConfigService } from './systemConfig.service.js';
const discordApiBaseUrl = 'https://discord.com/api';
const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const redirectUri = process.env.DISCORD_REDIRECT_URI;
/**
 * @desc 최초 로그인 시 토큰 포맷
 */
function formatNewToken(tokenData) {
    return {
        accessToken: tokenData.access_token,
        acExpiresDate: new Date(Date.now() + tokenData.expires_in * 1000),
        refreshToken: tokenData.refresh_token,
        reExpiresDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
    };
}
/**
 * @desc 토큰 재발급 시 토큰 포맷 (토큰 순환 처리)
 */
function formatRefreshedToken(tokenData, oldRefreshToken) {
    return {
        accessToken: tokenData.access_token,
        acExpiresDate: new Date(Date.now() + tokenData.expires_in * 1000),
        refreshToken: tokenData.refresh_token || oldRefreshToken,
        reExpiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
        rotatedDate: new Date(),
        revokedDate: null, // 재발급 시 폐기 상태 해제
    };
}
/**
 * @desc discord API 호출 및 DB 작업 처리
 */
export class DiscordAuthService {
    // --- 1. Public Methods (컨트롤러에서 호출) ---
    /**
     * @desc Discord OAuth2 인증 URL 생성 (로그인용)
     */
    async getDiscordAuthorizeUrl() {
        try {
            const scopes = await systemConfigService.getListConfig('DISCORD_OAUTH_SCOPES');
            const scopeStr = scopes.length > 0 ? scopes.join(' ') : 'identify guilds guilds.members.read';
            const authorizeUrl = `${discordApiBaseUrl}/oauth2/authorize?${querystring.stringify({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: scopeStr,
            })}`;
            return authorizeUrl;
        }
        catch (error) {
            console.error('Error creating authorize URL', error);
            throw new SystemError('Failed to create authorize URL', 500);
        }
    }
    /**
     * @desc Discord 콜백 로직 처리 (Callback)
     * (토큰 교환, 유저 정보 조회, DB 트랜잭션)
     */
    async handleDiscordCallback(code, userAgent, ipAddr) {
        try {
            // 1. Discord API로 토큰 요청
            const tokenResult = await fetchWithTimeout(`${discordApiBaseUrl}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: querystring.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri,
                }),
            });
            if (!tokenResult.ok) {
                throw new SystemError('Failed to fetch discord token', 500);
            }
            const tokenData = await tokenResult.json();
            const { access_token, token_type } = tokenData;
            // 2. Discord API로 유저 정보 요청
            const userResult = await fetchWithTimeout(`${discordApiBaseUrl}/users/@me`, {
                headers: { Authorization: `${token_type} ${access_token}` },
            });
            if (!userResult.ok) {
                throw new SystemError('Failed to fetch discord user', 500);
            }
            const userData = await userResult.json();
            // 3. DB 저장을 위한 데이터 포맷팅
            const formattedToken = formatNewToken(tokenData);
            const formattedMember = {
                id: userData.id,
                displayName: userData.global_name || userData.username,
                avatarUrl: userData.avatar
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                    : null,
            };
            const newAuthData = {
                discordMemberId: userData.id,
                userAgent,
                ipAddr,
                isActive: true,
            };
            // 4. DB 트랜잭션 호출
            const sessionUid = await this.handleLoginTransaction(formattedMember, { ...formattedToken, id: userData.id }, newAuthData);
            return sessionUid;
        }
        catch (error) {
            console.error('handleDiscordCallback service error', error);
            if (error instanceof SystemError)
                throw error;
            throw new SystemError('Failed to process Discord callback', 500);
        }
    }
    /**
     * @desc 로그아웃 로직 (Logout)
     * (API 폐기, 세션 비활성화, 토큰 폐기)
     */
    async revokeAndDeactivateSession(sessionUid) {
        try {
            const sessionData = await this.findAuthSessionByUid(sessionUid);
            if (!sessionData) {
                console.warn(`Logout: Session UID ${sessionUid} not found in DB.`);
                return;
            }
            const { discordMemberId } = sessionData;
            const token = await this.findDiscordTokenById(discordMemberId);
            if (token) {
                await this.revokeDiscordToken(token.accessToken);
                await this.updateDiscordTokenRevoked(discordMemberId);
            }
            else {
                console.warn(`Logout: Token for member ${discordMemberId} not found in DB.`);
            }
            await this.deactivateSession(sessionUid);
        }
        catch (error) {
            console.error('revokeAndDeactivateSession service error', error);
            throw new SystemError('Failed to process logout', 500);
        }
    }
    /**
     * @desc Discord API로 사용자 정보 조회
     */
    async fetchUser(accessToken) {
        try {
            const userResult = await fetchWithTimeout(`${discordApiBaseUrl}/users/@me`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const userData = await userResult.json();
            return {
                id: userData.id,
                username: userData.username,
                global_name: userData.global_name,
                avatar: userData.avatar,
            };
        }
        catch (error) {
            console.error('fetchUser service error', error);
            if (error instanceof SystemError)
                throw error;
            throw new SystemError('Failed to get user info', 500);
        }
    }
    // --- 2. Public Methods (미들웨어에서 호출) ---
    /**
     * @desc 유효한 액세스 토큰을 반환하는 메서드
     */
    async getValidAccessToken(discordMemberId) {
        const token = await this.findDiscordTokenById(discordMemberId);
        if (!token) {
            throw new BusinessError('Token not found or revoked', 401);
        }
        const now = new Date();
        if (now.getTime() > token.reExpiresDate.getTime()) {
            console.warn(`Refresh token expired for member ${discordMemberId}`);
            throw new BusinessError('Session expired. Please log in again.', 401);
        }
        if (now.getTime() < token.acExpiresDate.getTime()) {
            return token.accessToken;
        }
        // ac토큰 만료 시 재발급
        return this.refreshAndSaveToken(discordMemberId, token);
    }
    // --- 3. Internal Business Logic (Private) ---
    /**
     * @desc 로그인/콜백 트랜잭션 처리 (비공개)
     */
    async handleLoginTransaction(newMember, newToken, newAuthData) {
        try {
            const session = await db.transaction(async (tx) => {
                await this.upsertMember(newMember, tx);
                await this.upsertToken(newToken, tx);
                const sessionResult = await this.insertAuthSession(newAuthData, tx);
                return sessionResult;
            });
            return session.sessionUid;
        }
        catch (error) {
            console.error('[Login Transaction Error]', error);
            throw new SystemError('Login transaction failed', 500);
        }
    }
    /**
     * @desc Discord 토큰 재발급 및 DB 저장 (비공개)
     */
    async refreshAndSaveToken(discordMemberId, currentToken) {
        try {
            const result = await fetchWithTimeout(`${discordApiBaseUrl}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: querystring.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: currentToken.refreshToken,
                }),
            });
            if (!result.ok) {
                throw new BusinessError('Failed to refresh session. Please log in again.', 401);
            }
            const tokenData = await result.json();
            const formattedToken = formatRefreshedToken(tokenData, currentToken.refreshToken);
            await db.update(discordToken).set(formattedToken).where(eq(discordToken.id, discordMemberId));
            return formattedToken.accessToken; // 새 액세스 토큰 반환
        }
        catch (error) {
            if (error instanceof BusinessError)
                throw error;
            throw new SystemError('Error during token refresh', 500);
        }
    }
    /**
     * @desc Discord API에 토큰 폐기 요청 (비공개)
     */
    async revokeDiscordToken(accessToken) {
        try {
            const result = await fetchWithTimeout(`${discordApiBaseUrl}/oauth2/token/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: querystring.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    token: accessToken,
                }),
            });
            if (!result.ok) {
                console.warn('Discord revoke API failed', await result.json());
            }
        }
        catch (fetchError) {
            console.error('Fetch to Discord revoke endpoint failed', fetchError);
        }
    }
    // --- 4. DB Access Layer ---
    /**
     * @desc 디스코드 멤버 저장 (Upsert)
     */
    async upsertMember(newMember, tx) {
        try {
            const result = await tx
                .insert(discordMember)
                .values(newMember)
                .onConflictDoUpdate({
                target: discordMember.id,
                set: {
                    displayName: newMember.displayName,
                    avatarUrl: newMember.avatarUrl,
                    updateDate: new Date(),
                },
                where: sql `${discordMember.displayName} IS DISTINCT FROM ${newMember.displayName}
        OR ${discordMember.avatarUrl} IS DISTINCT FROM ${newMember.avatarUrl}`,
            })
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error upserting discordMember', error);
            throw new SystemError('discordAuth error while upserting discord Member');
        }
    }
    /**
     * @desc 디스코드 토큰 저장 (Upsert)
     */
    async upsertToken(newToken, tx) {
        try {
            const result = await tx
                .insert(discordToken)
                .values(newToken)
                .onConflictDoUpdate({
                target: discordToken.id,
                set: {
                    accessToken: newToken.accessToken,
                    acExpiresDate: newToken.acExpiresDate,
                    refreshToken: newToken.refreshToken,
                    reExpiresDate: newToken.reExpiresDate,
                    scope: newToken.scope,
                    tokenType: newToken.tokenType,
                    rotatedDate: null,
                    revokedDate: null,
                },
            })
                .returning();
            return result[0];
        }
        catch (error) {
            console.error('Error upserting discordToken');
            throw new SystemError('discordAuth error while upserting discord Token');
        }
    }
    /**
     * @desc ID로 discordToken 조회
     */
    async findDiscordTokenById(id) {
        const result = await db
            .select()
            .from(discordToken)
            .where(and(eq(discordToken.id, id), isNull(discordToken.revokedDate)))
            .limit(1);
        return result[0];
    }
    /**
     * @desc Token revoke update
     */
    async updateDiscordTokenRevoked(id) {
        const result = await db
            .update(discordToken)
            .set({
            revokedDate: new Date(),
        })
            .where(eq(discordToken.id, id))
            .returning();
        return result[0];
    }
    /**
     * @desc AuthSession 저장
     */
    async insertAuthSession(newAuthData, tx) {
        const result = await tx.insert(authSession).values(newAuthData).returning();
        return result[0];
    }
    /**
     * @desc Uid로 authSession 조회
     */
    async findAuthSessionByUid(sessionUid) {
        const result = await db
            .select()
            .from(authSession)
            .where(and(eq(authSession.sessionUid, sessionUid), eq(authSession.isActive, true)))
            .limit(1);
        return result[0];
    }
    /**
     * @desc session 비활성화
     */
    async deactivateSession(sessionUid) {
        const result = await db
            .update(authSession)
            .set({
            isActive: false,
            updateDate: new Date(),
        })
            .where(eq(authSession.sessionUid, sessionUid))
            .returning();
        return result[0];
    }
}
//# sourceMappingURL=discordAuth.service.js.map