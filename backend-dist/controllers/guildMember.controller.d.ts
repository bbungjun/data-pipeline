import { NextFunction, Request, Response } from 'express';
import { GuildMemberResponse, GuildMemberAccountResponse, LinkSubAccountRequest, SubAccountsAPIResponse, UpdateGuildMemberStatusRequest } from '../types/guildMember.js';
/**
 * @desc 길드 멤버 및 라이엇 계정 정보 통합 검색
 * @route GET /api/guildMember/:guildId/:riotName
 * @access Public
 */
export declare const searchGuildMembers: (req: Request<{
    guildId: string;
    riotName: string;
}, GuildMemberAccountResponse, Record<string, never>, {
    riotNameTag?: string;
    limit?: number;
}>, res: Response<GuildMemberAccountResponse>) => Promise<Response<GuildMemberAccountResponse, Record<string, any>>>;
/**
 * @desc 부계정을 본계정에 연결하고 DB 정보 업데이트
 * @route POST /api/guildMember/sub-account
 * @access Public
 */
export declare const linkSubAccount: (req: Request<Record<string, never>, GuildMemberResponse, LinkSubAccountRequest, Record<string, never>>, res: Response<GuildMemberResponse>, next: NextFunction) => Promise<void>;
/**
 * @desc 특정 길드의 부계정 목록을 조회
 * @route GET /api/guildMember/:guildId/sub-accounts
 * @access Public
 */
export declare const getSubAccounts: (req: Request<{
    guildId: string;
}>, res: Response<SubAccountsAPIResponse>) => Promise<Response<SubAccountsAPIResponse, Record<string, any>>>;
/**
 * @desc 길드 멤버 상태 변경 (활동/탈퇴) - 부캐 포함
 * @route PUT /api/guildMember/status
 * @access Public
 */
export declare const updateMemberStatus: (req: Request<Record<string, never>, GuildMemberResponse, UpdateGuildMemberStatusRequest>, res: Response<GuildMemberResponse>) => Promise<Response<GuildMemberResponse, Record<string, any>>>;
/**
 * @desc 부계정 연결 해제 (부계정이 본계정과의 연결을 해제)
 * @route DELETE /api/guildMember/sub-account
 * @access Public
 */
export declare const removeSubAccount: (req: Request<Record<string, never>, GuildMemberResponse, {
    guildId: string;
    riotName: string;
    riotNameTag: string;
}>, res: Response<GuildMemberResponse>) => Promise<Response<GuildMemberResponse, Record<string, any>>>;
