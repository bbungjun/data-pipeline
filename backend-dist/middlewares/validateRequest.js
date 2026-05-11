import { ZodError } from 'zod';
export const validateRequest = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    }
    catch (error) {
        if (error instanceof ZodError) {
            const problem = {
                type: 'https://example.com/problems/validation-error',
                title: 'Validation Failed',
                status: 400,
                detail: 'The request payload failed validation',
                instance: req.originalUrl,
                errors: error.errors.map((err) => ({
                    code: err.code,
                    path: err.path.join('.'),
                    message: err.message,
                    value: 'received' in err ? err.received : undefined,
                })),
            };
            res.status(400).setHeader('Content-Type', 'application/problem+json').json(problem);
        }
        else {
            next(error);
        }
    }
};
//# sourceMappingURL=validateRequest.js.map