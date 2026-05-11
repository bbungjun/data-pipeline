import { TransactionType } from '../database/connectionPool.js';
/**
 * @desc 내전 참여자 서비스
 */
export declare class MatchParticipantService {
    /**
     * 여러 참가자 데이터를 DB에 삽입합니다.
     * @param rawData - API로부터 받은 원본 데이터 배열
     * @param customMatchId - 이 참가자들이 속한 custom_match의 ID
     * @param tx - Drizzle 트랜잭션 객체
     */
    insertMatchParticipants(rawData: any[], customMatchId: string, tx: TransactionType, puuidToPlayerCodeMap: Map<string, string>): Promise<{
        id: number;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
        playerCode: string;
        customMatchId: string;
        championId: string;
        gameTeam: string;
        gameResult: string;
        position: string;
        kill: number;
        death: number;
        assist: number;
        gold: number;
        ccing: number;
        exp: number;
        timePlayed: number;
        totalDamageChampions: number;
        totalDamageDealtToBuildings: number;
        totalDamageTaken: number;
        visionScore: number;
        visionBought: number;
        pentaKills: number | null;
        level: number;
        item0: number;
        item1: number;
        item2: number;
        item3: number;
        item4: number;
        item5: number;
        item6: number;
        summonerSpell1: number | null;
        summonerSpell2: number | null;
        perk0: number | null;
        perk1: number | null;
        perk2: number | null;
        perk3: number | null;
        perk4: number | null;
        perk5: number | null;
        keyStoneId: number;
        perkSubStyle: number;
        minionsKilled: number | null;
        neutralMinionsKilled: number | null;
        neutralMinionsKilledYourJungle: number | null;
        neutralMinionsKilledEnemyJungle: number | null;
    }[]>;
    /**
     * @desc rawData 배열을 Drizzle 삽입용 InsertMatchParticipant 배열로 파싱하고 변환
     * @param rawData
     * @param customMatchId - 이 참가자들이 속한 custom_match의 ID
     * @returns InsertMatchParticipant 타입의 객체 배열 Promise
     */
    private parsedMatchParticipant;
    /**
     * @desc 승률 및 KDA 계산용 SQL 조각 생성 (Helper)
     */
    private getStatSqlChunks;
    /**
     * @desc 최근 한 달 전적 요약 조회
     */
    getRecentMonthRecord(playerCode: string, guildId: string): Promise<{
        totalCount: number;
        win: number;
        lose: number;
        winRate: number;
        kda: number;
    }>;
    /**
     * @desc 전체 라인별(포지션별) 전적 조회
     * 정렬 순서: TOP -> JUG -> MID -> ADC -> SUP
     */
    getLineRecord(playerCode: string, season: string, guildId: string): Promise<{
        totalCount: number;
        win: number;
        lose: number;
        winRate: number;
        kda: number;
        position: string;
    }[]>;
    /**
     * @desc 모스트 픽 조회 (챔피언별 통계)
     * 정렬: 플레이 횟수(totalCount) 많은 순 (DESC)
     * 페이지네이션 적용
     */
    getMostPicks(playerCode: string, season: string, guildId: string, page?: number, limit?: number): Promise<{
        mostPicks: {
            totalCount: number;
            win: number;
            lose: number;
            winRate: number;
            kda: number;
            champName: string;
            champNameEng: string;
        }[];
        totalCount: number;
    }>;
    /**
     * @desc 최근게임목록 상세 조회
     */
    getRecentGamesByRiotName(playerCode: string, season: string, guildId: string, page?: number, limit?: number): Promise<{
        games: {
            gameId: string;
            season: string;
            createDate: Date;
            gameResult: string;
            gameTeam: string;
            timePlayed: number;
            riotName: string;
            riotNameTag: string;
            champName: string;
            champNameEng: string;
            position: string;
            level: number;
            kill: number;
            death: number;
            assist: number;
            pentaKills: number | null;
            totalDamageChampions: number;
            totalDamageTaken: number;
            visionScore: number;
            visionBought: number;
            item0: number;
            item1: number;
            item2: number;
            item3: number;
            item4: number;
            item5: number;
            item6: number;
            summonerSpell1Key: string | null;
            summonerSpell1Name: string | null;
            summonerSpell2Key: string | null;
            summonerSpell2Name: string | null;
            keystoneIcon: string | null;
            keystoneName: string | null;
            substyleIcon: string | null;
            substyleName: string | null;
        }[];
        totalCount: number;
    }>;
    /**
     * @desc 게임 상세 조회 (특정 게임의 모든 참가자 정보)
     * 정렬: 팀 -> 포지션(TOP-JUG-MID-ADC-SUP)
     */
    getGameDetail(gameId: string, guildId: string): Promise<{
        gameId: string;
        season: string;
        createDate: Date;
        gameResult: string;
        gameTeam: string;
        timePlayed: number;
        riotName: string;
        riotNameTag: string;
        champName: string;
        champNameEng: string;
        position: string;
        level: number;
        kill: number;
        death: number;
        assist: number;
        pentaKills: number | null;
        totalDamageChampions: number;
        totalDamageTaken: number;
        visionScore: number;
        visionBought: number;
        item0: number;
        item1: number;
        item2: number;
        item3: number;
        item4: number;
        item5: number;
        item6: number;
        summonerSpell1Key: string | null;
        summonerSpell1Name: string | null;
        summonerSpell2Key: string | null;
        summonerSpell2Name: string | null;
        keystoneIcon: string | null;
        keystoneName: string | null;
        substyleIcon: string | null;
        substyleName: string | null;
    }[]>;
    /**
     * @desc 시너지 팀원 조회 (함께한 게임 승률 분석)
     * 조건: 같은 팀, 5판 이상 같이 함
     * 필터: 시즌 (Season) 기준
     */
    getSynergisticTeammates(playerCode: string, season: string, guildId: string): Promise<{
        totalCount: number;
        win: number;
        lose: number;
        winRate: number;
        kda: number;
        riotName: string;
        riotNameTag: string;
    }[]>;
    /**
     * @desc 게임 기록 소프트 삭제
     * customMatch와 연관된 matchParticipant를 모두 isDeleted = true 처리
     */
    deleteMatch(gameId: string, guildId: string): Promise<{
        id: string;
        gameType: string;
        guildId: string;
        season: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    } | null>;
}
export declare const matchParticipantService: MatchParticipantService;
