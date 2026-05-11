import { Response, NextFunction } from 'express';
import { Role } from '../types/role.js';
import { AuthRequest } from './authHandler.js';
type GuildIdSource = {
    from: 'body' | 'params' | 'query';
    key: string;
};
/**
 * 전역 Admin 검증 미들웨어
 * @param minRole - 최소 요구 권한 ('adminNormal' | 'adminSuper')
 *
 * @example
 * router.post('/', requireAdmin('adminNormal'), createGuild);
 */
export declare const requireAdmin: (minRole: Extract<Role, 'adminNormal' | 'adminSuper'>) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Guild 스코프 역할 검증 미들웨어
 * - adminNormal 이상은 자동 bypass
 * @param minRole - 최소 요구 권한
 * @param source  - 요청에서 guildId를 읽을 위치
 *
 * @example
 * router.put('/status', requireGuildRole('guildManager', { from: 'body', key: 'guildId' }), handler);
 */
export declare const requireGuildRole: (minRole: Role, source: GuildIdSource) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * 웹 리플레이 업로드 권한 검증 미들웨어
 * - guild.allowAllUploads = true → 인증된 유저면 모두 허용
 * - guild.allowAllUploads = false → userUploader 이상 필요
 * - adminNormal 이상 → bypass
 * @param source - 요청에서 guildId를 읽을 위치
 */
export declare const requireUploadPermission: (source: GuildIdSource) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export {};
