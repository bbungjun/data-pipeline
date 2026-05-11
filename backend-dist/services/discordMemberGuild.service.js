import { GuildService } from './guild.service.js';
import { ADMIN_ROLES } from '../types/role.js';
import { SystemError } from '../types/error.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
const guildService = new GuildService();
const discordApiBaseUrl = 'https://discord.com/api';
/**
 * @desc discord_member ↔ guild 관계 서비스
 * Discord 멤버가 속한 길드와 Gmok에 등록된 길드 간의 관계를 처리합니다.
 */
export class DiscordMemberGuildService {
    /**
     * @desc Discord API로 사용자의 길드 목록 조회
     */
    async fetchUserGuilds(accessToken) {
        try {
            const result = await fetchWithTimeout(`${discordApiBaseUrl}/users/@me/guilds`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!result.ok) {
                throw new SystemError('Failed to fetch Discord guilds', 500);
            }
            const fullGuilds = await result.json();
            return fullGuilds.map((guild) => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                banner: guild.banner,
            }));
        }
        catch (error) {
            console.error('fetchUserGuilds service error', error);
            if (error instanceof SystemError)
                throw error;
            throw new SystemError('Failed to get guilds', 500);
        }
    }
    /**
     * @desc Gmok 길드에 대해서만 멤버 nickname 조회
     */
    async enrichWithNick(guilds, accessToken) {
        return Promise.all(guilds.map(async (guild) => {
            let nick = undefined;
            try {
                const memberResult = await fetchWithTimeout(`${discordApiBaseUrl}/users/@me/guilds/${guild.id}/member`, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (memberResult.ok) {
                    const member = await memberResult.json();
                    const fallbackName = member.user?.username?.replace(/\s/g, '');
                    nick = member.nick?.replace(/\s/g, '') ?? fallbackName;
                }
            }
            catch {
                // nick은 부가 정보이므로 조회 실패 시 undefined로 둠
            }
            return { ...guild, nick };
        }));
    }
    /**
     * @desc 사용자가 가입한 Discord 길드 중 Gmok에 등록된 길드 목록 조회
     */
    async findJoinedGmokGuilds(accessToken) {
        const [gmokGuildsResponse, userDiscordGuilds] = await Promise.all([
            guildService.findAllGuilds({ page: 1, limit: 1000 }),
            this.fetchUserGuilds(accessToken),
        ]);
        const gmokGuildIdSet = new Set(gmokGuildsResponse.result.map((g) => g.id));
        const gmokGuilds = userDiscordGuilds.filter((g) => gmokGuildIdSet.has(g.id));
        return this.enrichWithNick(gmokGuilds, accessToken);
    }
    /**
     * @desc Admin 권한 사용자가 접근 가능한 전체 Gmok 길드 목록 조회
     */
    async findAdminGmokGuilds(activeRoles) {
        const gmokGuildsResponse = await guildService.findAllGuilds({ page: 1, limit: 1000 });
        const roleByGuildId = new Map(activeRoles.map((r) => [r.guildId, r.role]));
        const adminRole = roleByGuildId.get(null) ?? 'adminNormal';
        return gmokGuildsResponse.result.map((g) => ({
            id: g.id,
            name: g.name,
            icon: '',
            banner: '',
            role: adminRole,
        }));
    }
    /**
     * @desc Gmok 길드 목록에 길드별 권한 정보 적용
     */
    applyRolesToGuilds(guilds, activeRoles) {
        const roleByGuildId = new Map(activeRoles.map((r) => [r.guildId, r.role]));
        return guilds.map((g) => ({
            ...g,
            role: roleByGuildId.get(g.id) ?? 'userNormal',
        }));
    }
    /**
     * @desc 사용자가 접근 가능한 Gmok 길드 목록과 길드별 권한 반환
     */
    async findUserGmokGuilds(accessToken, activeRoles) {
        const isAdmin = activeRoles.some((r) => ADMIN_ROLES.includes(r.role));
        if (isAdmin) {
            return this.findAdminGmokGuilds(activeRoles);
        }
        const guilds = await this.findJoinedGmokGuilds(accessToken);
        return this.applyRolesToGuilds(guilds, activeRoles);
    }
}
export const discordMemberGuildService = new DiscordMemberGuildService();
//# sourceMappingURL=discordMemberGuild.service.js.map