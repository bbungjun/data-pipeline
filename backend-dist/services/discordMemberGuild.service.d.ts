import { DiscordMemberRole } from '../database/schema.js';
import { DiscordGuildAPI, DiscordGuildWithoutRole } from '../types/discordAuth.js';
/**
 * @desc discord_member ↔ guild 관계 서비스
 * Discord 멤버가 속한 길드와 Gmok에 등록된 길드 간의 관계를 처리합니다.
 */
export declare class DiscordMemberGuildService {
    /**
     * @desc Discord API로 사용자의 길드 목록 조회
     */
    fetchUserGuilds(accessToken: string): Promise<Omit<DiscordGuildAPI, 'role' | 'nick'>[]>;
    /**
     * @desc Gmok 길드에 대해서만 멤버 nickname 조회
     */
    private enrichWithNick;
    /**
     * @desc 사용자가 가입한 Discord 길드 중 Gmok에 등록된 길드 목록 조회
     */
    findJoinedGmokGuilds(accessToken: string): Promise<DiscordGuildWithoutRole[]>;
    /**
     * @desc Admin 권한 사용자가 접근 가능한 전체 Gmok 길드 목록 조회
     */
    findAdminGmokGuilds(activeRoles: DiscordMemberRole[]): Promise<DiscordGuildAPI[]>;
    /**
     * @desc Gmok 길드 목록에 길드별 권한 정보 적용
     */
    applyRolesToGuilds(guilds: DiscordGuildWithoutRole[], activeRoles: DiscordMemberRole[]): DiscordGuildAPI[];
    /**
     * @desc 사용자가 접근 가능한 Gmok 길드 목록과 길드별 권한 반환
     */
    findUserGmokGuilds(accessToken: string, activeRoles: DiscordMemberRole[]): Promise<DiscordGuildAPI[]>;
}
export declare const discordMemberGuildService: DiscordMemberGuildService;
