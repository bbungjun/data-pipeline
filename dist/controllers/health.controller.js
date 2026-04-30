/**
 * @desc 헬스 체크 엔드포인트
 * @access Public
 */
export const getHealth = (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
    });
};
//# sourceMappingURL=health.controller.js.map