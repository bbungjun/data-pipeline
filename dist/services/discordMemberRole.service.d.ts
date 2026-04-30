import { DiscordMemberRole } from '../database/schema.js';
/**
 * @desc discord_member_role DB 조작 서비스
 */
export declare class DiscordMemberRoleService {
    /**
     * @desc 활성 role 목록 조회
     */
    getActiveRoles(memberId: string): Promise<{
        id: string;
        memberId: string;
        role: string;
        guildId: string | null;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     * @desc 특정 길드 스코프 + admin(guildId IS NULL) 역할만 조회
     */
    getActiveRolesByGuild(memberId: string, guildId: string): Promise<{
        id: string;
        memberId: string;
        role: string;
        guildId: string | null;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     * @desc 가입한 Gmok 길드 중 권한이 없는 길드에 기본 권한(userNormal) 삽입
     */
    ensureDefaultRolesForGuilds(memberId: string, guildIds: string[], activeRoles: DiscordMemberRole[]): Promise<DiscordMemberRole[]>;
}
export declare const discordMemberRoleService: DiscordMemberRoleService;
