import { Request, Response } from 'express';
import { CreateGuildRequest, UpdateGuildRequest, GetGuildsQuery, GuildResponse } from '../types/guild.js';
/**
 * @desc 새로운 길드 생성
 * @route POST /api/guilds
 * @access Public
 */
export declare const createGuild: (req: Request<Record<string, never>, GuildResponse, CreateGuildRequest>, res: Response<GuildResponse>) => Promise<void>;
/**
 * @desc ID로 길드 조회
 * @route GET /api/guilds/:id
 * @access Public
 */
export declare const getGuildById: (req: Request<{
    id: string;
}>, res: Response<GuildResponse>) => Promise<Response<GuildResponse, Record<string, any>>>;
/**
 * @desc 페이지네이션과 검색으로 모든 길드 조회
 * @route GET /api/guilds
 * @access Public
 */
export declare const getAllGuilds: (req: Request<Record<string, never>, GuildResponse, Record<string, never>, GetGuildsQuery>, res: Response<GuildResponse>) => Promise<void>;
/**
 * @desc ID로 길드 수정
 * @route PUT /api/guilds/:id
 * @access Public
 */
export declare const updateGuild: (req: Request<{
    id: string;
}, GuildResponse, UpdateGuildRequest>, res: Response<GuildResponse>) => Promise<Response<GuildResponse, Record<string, any>>>;
/**
 * @desc ID로 길드 삭제 (소프트 삭제)
 * @route DELETE /api/guilds/:id
 * @access Public
 */
export declare const deleteGuild: (req: Request<{
    id: string;
}>, res: Response<GuildResponse>) => Promise<Response<GuildResponse, Record<string, any>>>;
