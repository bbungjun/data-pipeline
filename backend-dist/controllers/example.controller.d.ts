import { Request, Response } from 'express';
/**
 * @desc 새로운 예제 생성
 * @access Public
 */
export declare const createExample: (req: Request, res: Response) => void;
/**
 * @desc ID로 예제 조회
 * @access Public
 */
export declare const getExampleById: (req: Request, res: Response) => void;
/**
 * @desc 모든 예제 조회
 * @access Public
 */
export declare const getAllExamples: (req: Request, res: Response) => void;
