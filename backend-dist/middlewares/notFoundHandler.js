export const notFoundHandler = (req, res, next) => {
    const problem = {
        type: 'https://example.com/problems/not-found',
        title: 'Resource Not Found',
        status: 404,
        detail: `The requested resource ${req.originalUrl} was not found`,
        instance: req.originalUrl,
    };
    next(problem);
};
//# sourceMappingURL=notFoundHandler.js.map