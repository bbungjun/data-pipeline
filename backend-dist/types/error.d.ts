export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    errors?: Record<string, unknown>[];
}
/**
 * 비즈니스 에러 타입
 * - DB에는 저장하되, 클라이언트에는 에러 메시지를 노출해야 하는 에러
 */
export declare class BusinessError extends Error {
    readonly status: number;
    readonly type: string;
    readonly title: string;
    readonly isLoggable: boolean;
    readonly showMessage: boolean;
    constructor(message: string, status?: number, options?: {
        type?: string;
        title?: string;
        isLoggable?: boolean;
        showMessage?: boolean;
    });
}
/**
 * 시스템 에러 타입
 * - DB에 저장하고, 클라이언트에는 에러코드만 노출
 */
export declare class SystemError extends Error {
    readonly status: number;
    readonly type: string;
    readonly title: string;
    readonly isLoggable: boolean;
    readonly showMessage: boolean;
    constructor(message: string, status?: number, options?: {
        type?: string;
        title?: string;
        isLoggable?: boolean;
    });
}
