import { nanoid } from 'nanoid';
import { db } from '../database/connectionPool.js';
import { errorLog } from '../database/schema.js';
import { BusinessError, SystemError } from '../types/error.js';
/**
 * @desc 고유한 에러 코드 생성 (ERR-YYMMDD-xxxxxx 형식)
 * - nanoid 6자리 사용으로 충돌 방지
 */
const generateErrorCode = () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const uniqueId = nanoid(6);
    return `ERR-${dateStr}-${uniqueId}`;
};
/**
 * @desc Request 객체에서 로깅용 데이터 추출
 */
export const extractRequestData = (req) => ({
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
        accept: req.get('accept'),
        authorization: req.get('authorization') ? '[HIDDEN]' : undefined,
    },
    body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
    params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
});
/**
 * @desc 에러를 데이터베이스에 로깅하고 추적 코드 반환
 */
export const logError = async (errorData) => {
    const errorCode = generateErrorCode();
    await db.insert(errorLog).values({
        errorCode,
        error: errorData.error,
        request: errorData.request,
        userAgent: errorData.userAgent,
        ipAddress: errorData.ipAddress,
        userId: errorData.userId,
        severity: errorData.severity || 'error',
        status: errorData.status || 500,
    });
    return errorCode;
};
/**
 * @desc Express Request와 Error로부터 에러 로깅 수행
 */
export const logErrorFromRequest = async (error, req, status) => {
    const requestData = extractRequestData(req);
    // 에러 타입 판별
    let errorType = 'unknown';
    if (error instanceof BusinessError) {
        errorType = 'business';
    }
    else if (error instanceof SystemError) {
        errorType = 'system';
    }
    // IP 주소 추출
    const ipAddress = req.ip ||
        req.socket.remoteAddress ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim();
    const errorData = {
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            errorType, // 에러 타입 추가
        },
        request: requestData,
        userAgent: req.get('user-agent'),
        ipAddress,
        userId: req.user?.id,
        severity: status && status < 500 ? 'warning' : 'error',
        status: status || 500,
    };
    return logError(errorData);
};
//# sourceMappingURL=errorLog.service.js.map