import { Request, Response } from 'express';
import { CustomMatch, MatchResponse, MatchQuery, RecentGame, DashboardData, MostPick, GameDetail } from '../types/matchParticipant.js';
/**
 * @desc 최근 게임 목록 상세 조회 (페이지네이션)
 * @route GET /api/matches/:guildId/:riotName/games
 * @access Public
 */
export declare const getRecentGames: (req: Request<{
    guildId: string;
    riotName: string;
}, MatchResponse<RecentGame[]>, Record<string, never>, MatchQuery>, res: Response<MatchResponse<RecentGame[]>>) => Promise<Response<MatchResponse<RecentGame[]>, Record<string, any>>>;
/**
 * @desc 전적 대시보드 데이터 조회 (요약 + 라인별 + 모스트)
 * @route GET /api/matches/:guildId/:riotName/dashboard
 * @access Public
 */
export declare const getMatchDashboard: (req: Request<{
    guildId: string;
    riotName: string;
}, MatchResponse<DashboardData>, Record<string, never>, MatchQuery>, res: Response<MatchResponse<DashboardData>>) => Promise<Response<MatchResponse<DashboardData>, Record<string, any>>>;
/**
 * @desc 모스트 픽 상세 목록 조회 (페이징 가능)
 * @route GET /api/matches/:guildId/:riotName/most-picks
 * @access Public
 */
export declare const getMostPicks: (req: Request<{
    guildId: string;
    riotName: string;
}, MatchResponse<MostPick[]>, Record<string, never>, MatchQuery>, res: Response<MatchResponse<MostPick[]>>) => Promise<Response<MatchResponse<MostPick[]>, Record<string, any>>>;
/**
 * @desc 게임 상세 정보 조회 (10인 데이터)
 * @route GET /api/matches/:guildId/games/:gameId
 */
export declare const getGameDetail: (req: Request<{
    guildId: string;
    gameId: string;
}, MatchResponse<GameDetail[]>, Record<string, never>, Record<string, never>>, res: Response<MatchResponse<GameDetail[]>>) => Promise<Response<MatchResponse<RecentGame[]>, Record<string, any>>>;
/**
 * @desc 게임 기록 삭제 (소프트 삭제)
 * @route DELETE /api/matches/:guildId/games/:gameId
 */
export declare const deleteMatch: (req: Request<{
    guildId: string;
    gameId: string;
}>, res: Response<MatchResponse<CustomMatch>>) => Promise<Response<MatchResponse<{
    id: string;
    createDate: Date;
    updateDate: Date;
    isDeleted: boolean;
    gameType: string;
    season: string;
    guildId: string;
}>, Record<string, any>>>;
