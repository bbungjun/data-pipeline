import { MatchStats } from './matchParticipant.js';
export type StatisticsDatePreset = 'recent' | 'season' | 'range';
export interface UserGameStatistic extends MatchStats {
    riotName: string;
    riotNameTag: string;
    position?: string;
}
export interface ChampionStatistic extends MatchStats {
    champName: string;
    champNameEng: string;
    position?: string;
}
export interface StatisticsResponse<T> {
    status: 'success' | 'error';
    message: string;
    data: T | T[] | null;
}
export interface StatisticsRequestQuery {
    datePreset?: StatisticsDatePreset;
    fromMonth?: string;
    toMonth?: string;
    championName?: string;
    position?: string;
    page?: string;
    season?: string;
    limit?: string;
    sortBy?: 'totalCount' | 'winRate';
}
export interface StatisticsServiceOptions extends Pick<StatisticsRequestQuery, 'datePreset' | 'fromMonth' | 'toMonth' | 'championName' | 'position' | 'season'> {
    sortBy?: 'totalCount' | 'winRate';
    page?: number;
    limit?: number;
}
