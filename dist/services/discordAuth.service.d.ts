import { TransactionType } from '../database/connectionPool.js';
import { InsertDiscordMember, InsertDiscordToken, InsertAuthSession } from '../types/discordAuth.js';
/**
 * @desc discord API 호출 및 DB 작업 처리
 */
export declare class DiscordAuthService {
    /**
     * @desc Discord OAuth2 인증 URL 생성 (로그인용)
     */
    getDiscordAuthorizeUrl(): Promise<string>;
    /**
     * @desc Discord 콜백 로직 처리 (Callback)
     * (토큰 교환, 유저 정보 조회, DB 트랜잭션)
     */
    handleDiscordCallback(code: string, userAgent: string | undefined, ipAddr: string): Promise<string>;
    /**
     * @desc 로그아웃 로직 (Logout)
     * (API 폐기, 세션 비활성화, 토큰 폐기)
     */
    revokeAndDeactivateSession(sessionUid: string): Promise<void>;
    /**
     * @desc Discord API로 사용자 정보 조회
     */
    fetchUser(accessToken: string): Promise<{
        id: any;
        username: any;
        global_name: any;
        avatar: any;
    }>;
    /**
     * @desc 유효한 액세스 토큰을 반환하는 메서드
     */
    getValidAccessToken(discordMemberId: string): Promise<string>;
    /**
     * @desc 로그인/콜백 트랜잭션 처리 (비공개)
     */
    private handleLoginTransaction;
    /**
     * @desc Discord 토큰 재발급 및 DB 저장 (비공개)
     */
    private refreshAndSaveToken;
    /**
     * @desc Discord API에 토큰 폐기 요청 (비공개)
     */
    private revokeDiscordToken;
    /**
     * @desc 디스코드 멤버 저장 (Upsert)
     */
    upsertMember(newMember: InsertDiscordMember, tx: TransactionType): Promise<{
        id: string;
        createDate: Date | null;
        updateDate: Date | null;
        isDeleted: boolean;
        displayName: string | null;
        avatarUrl: string | null;
    }[]>;
    /**
     * @desc 디스코드 토큰 저장 (Upsert)
     */
    upsertToken(newToken: InsertDiscordToken, tx: TransactionType): Promise<{
        id: string;
        createDate: Date | null;
        accessToken: string;
        acExpiresDate: Date;
        refreshToken: string;
        reExpiresDate: Date;
        scope: string;
        tokenType: string;
        rotatedDate: Date | null;
        revokedDate: Date | null;
    }>;
    /**
     * @desc ID로 discordToken 조회
     */
    findDiscordTokenById(id: string): Promise<{
        id: string;
        accessToken: string;
        acExpiresDate: Date;
        refreshToken: string;
        reExpiresDate: Date;
        scope: string;
        tokenType: string;
        rotatedDate: Date | null;
        revokedDate: Date | null;
        createDate: Date | null;
    }>;
    /**
     * @desc Token revoke update
     */
    updateDiscordTokenRevoked(id: string): Promise<{
        id: string;
        accessToken: string;
        acExpiresDate: Date;
        refreshToken: string;
        reExpiresDate: Date;
        scope: string;
        tokenType: string;
        rotatedDate: Date | null;
        revokedDate: Date | null;
        createDate: Date | null;
    }>;
    /**
     * @desc AuthSession 저장
     */
    insertAuthSession(newAuthData: InsertAuthSession, tx: TransactionType): Promise<{
        id: number;
        createDate: Date | null;
        updateDate: Date | null;
        userAgent: string | null;
        discordMemberId: string;
        sessionUid: string;
        ipAddr: string | null;
        deviceName: string | null;
        isActive: boolean | null;
    }>;
    /**
     * @desc Uid로 authSession 조회
     */
    findAuthSessionByUid(sessionUid: string): Promise<{
        id: number;
        discordMemberId: string;
        sessionUid: string;
        userAgent: string | null;
        ipAddr: string | null;
        deviceName: string | null;
        isActive: boolean | null;
        createDate: Date | null;
        updateDate: Date | null;
    }>;
    /**
     * @desc session 비활성화
     */
    deactivateSession(sessionUid: string): Promise<{
        id: number;
        discordMemberId: string;
        sessionUid: string;
        userAgent: string | null;
        ipAddr: string | null;
        deviceName: string | null;
        isActive: boolean | null;
        createDate: Date | null;
        updateDate: Date | null;
    }>;
}
