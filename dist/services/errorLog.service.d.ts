import { Request } from 'express';
export interface ErrorLogData {
    error: {
        message: string;
        stack?: string;
        name?: string;
        code?: string;
        errorType?: 'business' | 'system' | 'unknown';
    };
    request?: {
        method: string;
        url: string;
        originalUrl: string;
        headers?: Record<string, any>;
        body?: any;
        query?: any;
        params?: any;
    };
    userAgent?: string;
    ipAddress?: string;
    userId?: string;
    severity?: 'error' | 'warning' | 'info';
    status?: number;
}
/**
 * @desc Request 객체에서 로깅용 데이터 추출
 */
export declare const extractRequestData: (req: Request) => ErrorLogData['request'];
/**
 * @desc 에러를 데이터베이스에 로깅하고 추적 코드 반환
 */
export declare const logError: (errorData: ErrorLogData) => Promise<string>;
/**
 * @desc Express Request와 Error로부터 에러 로깅 수행
 */
export declare const logErrorFromRequest: (error: Error, req: Request, status?: number) => Promise<string>;
