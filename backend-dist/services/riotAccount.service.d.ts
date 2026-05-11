import { TransactionType } from '../database/connectionPool.js';
/**
 * @desc Riot 계정 서비스
 */
export declare class RiotAccountService {
    /**
     * @desc 라이엇계정 기존 puuid 가 있으면 update // 없으면 insert
     * 트랜잭션
     */
    upsertRiotAccount(rawData: any[], tx: TransactionType): Promise<{
        id: number;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
        puuid: string;
        playerCode: string;
        riotName: string;
        riotNameTag: string;
    }[]>;
    /**
     *
     * @desc RiotAccount player_code 조회
     * rawData puuid로 player_code 조회
     * 트랜잭션
     */
    findRiotAccountsByPuuids(rawData: any[], tx: TransactionType): Promise<{
        id: number;
        puuid: string;
        playerCode: string;
        riotName: string;
        riotNameTag: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     * @desc RiotName과 RiotNameTag으로 RiotAccount를 조회
     */
    findAccountByRiotId({ riotName, riotNameTag }: {
        riotName: string;
        riotNameTag: string;
    }, tx: TransactionType): Promise<{
        id: number;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
        puuid: string;
        playerCode: string;
        riotName: string;
        riotNameTag: string;
    } | undefined>;
    /**
     * @desc rawData 에서 riotAccount 추출 및 Zod 유효성 검사
     */
    private parsedRawData;
}
export declare const riotAccountService: RiotAccountService;
