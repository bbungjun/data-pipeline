import { Request, Response, NextFunction } from 'express';
/**
 * req 객체의 다양한 위치에서 guild ID를 찾아 Base64 디코딩하는 Express 미들웨어
 */
export declare const decodeGuildIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
