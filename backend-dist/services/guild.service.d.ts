import { TransactionType } from '../database/connectionPool.js';
import { InsertGuild } from '../database/schema.js';
import { GetGuildsQuery, UpdateGuildRequest } from '../types/guild.js';
/**
 * @desc 길드 데이터의 생성, 조회, 수정, 삭제를 담당하는 서비스 클래스
 */
export declare class GuildService {
    /**
     * @desc 새로운 길드를 데이터베이스에 생성
     */
    insertGuild(newGuildData: InsertGuild): Promise<{
        id: string;
        name: string;
        languageCode: string;
        allowAllUploads: boolean;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
    /**
     * @desc 새로운 길드가 있으면 생성, 아니면 update
     */
    upsertGuild(newGuildData: InsertGuild, tx: TransactionType): Promise<{
        id: string;
        name: string;
        languageCode: string;
        allowAllUploads: boolean;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     * @desc ID로 길드 조회
     */
    findGuildById(id: string): Promise<{
        id: string;
        name: string;
        languageCode: string;
        allowAllUploads: boolean;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
    /**
     * @desc 모든 길드를 페이지네이션 및 검색 조건에 따라 조회
     */
    findAllGuilds({ page, limit, search }: GetGuildsQuery): Promise<{
        result: {
            id: string;
            name: string;
            languageCode: string;
            allowAllUploads: boolean;
            createDate: Date;
            updateDate: Date;
            isDeleted: boolean;
        }[];
        totalCount: number;
    }>;
    /**
     * @desc ID로 길드 정보 수정
     */
    updateGuild(id: string, updateData: UpdateGuildRequest): Promise<{
        id: string;
        name: string;
        languageCode: string;
        allowAllUploads: boolean;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
    /**
     * @desc ID로 길드 논리적 삭제
     */
    softDeleteGuild(id: string): Promise<{
        id: string;
        name: string;
        languageCode: string;
        allowAllUploads: boolean;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
}
export declare const guildService: GuildService;
