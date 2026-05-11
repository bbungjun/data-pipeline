/// <reference types="cookie-parser" />
import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    discordMemberId?: string;
    accessToken?: string;
    isBot?: boolean;
}
/**
 * @desc 봇 접근 제한 (Localhost Only)
 * 봇과 서버가 같으므로, 외부 IP에서의 접근은 무조건 차단하고
 * 오직 내부(Localhost)에서 온 요청만 허용합니다.
 */
export declare const restrictBotToLocalhost: (req: Request, res: Response, next: NextFunction) => void;
/**
 * @desc 인증 미들웨어 (봇/유저 통합)
 */
export declare const verifyAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
