import { Request, Response, NextFunction } from 'express';
import { ReplayResponse, ReplayFileRequest, WebUploadResponse, ReplayListResponse, GetReplaysQuery } from '../types/replay.js';
import { AuthRequest } from '../middlewares/authHandler.js';
/**
 * @route POST /api/replays
 * @desc 리플레이 파일 저장 API
 * @access Public
 */
export declare const createReplay: (req: Request<Record<string, never>, ReplayResponse, ReplayFileRequest>, res: Response<ReplayResponse>, next: NextFunction) => Promise<void | Response<ReplayResponse, Record<string, any>>>;
/**
 * @route GET /api/replays/:guildId
 * @desc 길드별 리플레이 목록 조회
 */
export declare const getReplayList: (req: Request<{
    guildId: string;
}, ReplayListResponse, Record<string, never>, GetReplaysQuery>, res: Response<ReplayListResponse>, next: NextFunction) => Promise<void | Response<ReplayListResponse, Record<string, any>>>;
/**
 * @route POST /api/replays/web
 * @desc 웹에서 .rofl 파일 직접 업로드
 */
export declare const webCreateReplay: (req: AuthRequest, res: Response<WebUploadResponse>, next: NextFunction) => Promise<void | Response<WebUploadResponse, Record<string, any>>>;
