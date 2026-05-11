import { Request, Response, NextFunction } from 'express';
export declare const testError: (_req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const testValidationError: (_req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const testDatabaseError: (_req: Request, _res: Response, next: NextFunction) => Promise<void>;
