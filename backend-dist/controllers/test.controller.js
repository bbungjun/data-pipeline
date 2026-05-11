export const testError = async (_req, _res, next) => {
    try {
        // 의도적으로 에러 발생
        throw new Error('This is a test error for logging system');
    }
    catch (error) {
        next(error);
    }
};
export const testValidationError = async (_req, _res, next) => {
    try {
        // 커스텀 에러 객체
        const customError = {
            status: 400,
            title: 'Validation Error',
            detail: 'Test validation failed',
            type: 'validation-error',
        };
        throw customError;
    }
    catch (error) {
        next(error);
    }
};
export const testDatabaseError = async (_req, _res, next) => {
    try {
        // 데이터베이스 관련 에러 시뮬레이션
        const dbError = new Error('Database connection failed');
        dbError.code = 'ECONNREFUSED';
        throw dbError;
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=test.controller.js.map