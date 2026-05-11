import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authHandler.js';
import { DiscordGuildAPIResponse } from '../types/discordAuth.js';
/**
 * @route GET /api/auth/login
 * @desc 디스코드 로그인 시작 (디스코드로 리디렉션)
 * @access Public
 */
export declare const login: (req: Request, res: Response<void>, next: NextFunction) => Promise<void>;
/**
 * @route GET /api/auth/callback/:code
 * @desc 디스코드 로그인 콜백 처리
 * @access Public
 */
export declare const callback: (req: Request<Record<string, never>, void, never, {
    code?: string;
    error?: string;
}>, res: Response<void>, next: NextFunction) => Promise<void>;
/**
 * @route POST /api/auth/logout
 * @desc  로그아웃 (디스코드 토큰 폐기)
 * @access Public
 */
export declare const logout: (req: Request, res: Response<void>) => Promise<void>;
/**
 * @route GET /api/auth/guilds
 * @desc (Protected) 현재 인증된 유저의 gmok이 있는 길드 목록 가져오기
 * @access Private (auth.middleware를 통과해야 함)
 */
export declare const getGmokGuilds: (req: AuthRequest, res: Response<DiscordGuildAPIResponse>) => Promise<void>;
/**
 * @route GET /api/auth/me
 * @desc [(Protected) 현재 세션의 유저 ID 조회 (세션 체크용)
 * @access Private
 */
export declare const getSelfProfile: (req: AuthRequest, res: Response) => Promise<void>;
