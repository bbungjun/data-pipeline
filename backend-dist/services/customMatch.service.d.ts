import { TransactionType } from '../database/connectionPool.js';
import { InsertCustomMatch } from '../database/schema.js';
/**
 * @desc 내전 커스텀 게임정보
 *
 */
export declare class CustomMatchService {
    /**
     * @desc 새로운 내전 매치 데이터베이스에 저장
     */
    insertCustomMatch(newCustomMatchData: InsertCustomMatch, tx: TransactionType): Promise<{
        id: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
        gameType: string;
        season: string;
        guildId: string;
    }>;
}
export declare const customMatchService: CustomMatchService;
