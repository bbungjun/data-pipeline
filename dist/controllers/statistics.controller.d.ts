import { Request, Response } from 'express';
import { StatisticsResponse, UserGameStatistic, StatisticsRequestQuery, ChampionStatistic } from '../types/statistics.js';
/**
 * @desc 유저별 게임 통계 조회
 * @route GET /api/statistics/:guildId/users
 */
export declare const getUserGameStats: (req: Request<{
    guildId: string;
}, StatisticsResponse<UserGameStatistic>, Record<string, never>, StatisticsRequestQuery>, res: Response<StatisticsResponse<UserGameStatistic>>) => Promise<Response<StatisticsResponse<UserGameStatistic>, Record<string, any>>>;
/**
 * @desc 챔피언별 통계 조회
 * @route GET /api/statistics/:guildId/champions
 */
export declare const getChampionStats: (req: Request<{
    guildId: string;
}, StatisticsResponse<ChampionStatistic>, Record<string, never>, StatisticsRequestQuery>, res: Response<StatisticsResponse<ChampionStatistic>>) => Promise<Response<StatisticsResponse<ChampionStatistic>, Record<string, any>>>;
