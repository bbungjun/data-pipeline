import { StatisticsServiceOptions } from '../types/statistics.js';
export declare class StatisticsService {
    /**
     * @desc 통계 조회에 공통으로 사용하는 집계 SQL 조각을 생성
     */
    private getStatSqlChunks;
    /**
     * @desc 조회 방식에 따라 최근 1개월, 시즌 전체, 월 범위용 날짜 조건을 생성
     */
    private buildDateCondition;
    /**
     * @desc 시즌 필터 값 또는 기본 시즌 설정을 바탕으로 시즌 조건을 생성
     */
    private buildSeasonCondition;
    /**
     * @desc 유저별 게임 통계 조회
     */
    getUserGameStatistics(guildId: string, options: StatisticsServiceOptions): Promise<{
        result: {
            totalCount: number;
            win: number;
            lose: number;
            winRate: number;
            kda: number;
            position?: string | undefined;
            playerCode: string;
            riotName: string;
            riotNameTag: string;
        }[];
        totalCount: number;
    }>;
    /**
     * @desc 챔피언별 통계 조회
     */
    getChampionStatistics(guildId: string, options: StatisticsServiceOptions): Promise<{
        result: {
            totalCount: number;
            win: number;
            lose: number;
            winRate: number;
            kda: number;
            position?: string | undefined;
            champName: string;
            champNameEng: string;
        }[];
        totalCount: number;
    }>;
}
export declare const statisticsService: StatisticsService;
