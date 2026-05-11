import { TransactionType } from '../database/connectionPool.js';
import { RiotAccount } from '../database/schema.js';
import { GetGuildMemberQuery, LinkSubAccountRequest } from '../types/guildMember.js';
export declare const primaryRiotAccount: import("drizzle-orm/pg-core/table.js").PgTableWithColumns<Required<import("drizzle-orm").Update<{
    name: "riot_account";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "id";
            tableName: "riot_account";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: "always";
            generated: undefined;
        }, {}, {}>;
        puuid: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "puuid";
            tableName: "riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 128;
        }>;
        playerCode: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "player_code";
            tableName: "riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: {
                type: "always";
            };
        }, {}, {
            length: 64;
        }>;
        riotName: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "riot_name";
            tableName: "riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 128;
        }>;
        riotNameTag: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "riot_name_tag";
            tableName: "riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 128;
        }>;
        createDate: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "create_date";
            tableName: "riot_account";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updateDate: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "update_date";
            tableName: "riot_account";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        isDeleted: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "is_deleted";
            tableName: "riot_account";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}, {
    name: "primary_riot_account";
    columns: {
        id: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "id";
            tableName: "primary_riot_account";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: "always";
            generated: undefined;
        }, {}, {}>;
        puuid: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "puuid";
            tableName: "primary_riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        playerCode: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "player_code";
            tableName: "primary_riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: {
                type: "always";
            } & import("drizzle-orm").GeneratedColumnConfig<string>;
        }, {}, {}>;
        riotName: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "riot_name";
            tableName: "primary_riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        riotNameTag: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "riot_name_tag";
            tableName: "primary_riot_account";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createDate: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "create_date";
            tableName: "primary_riot_account";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updateDate: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "update_date";
            tableName: "primary_riot_account";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        isDeleted: import("drizzle-orm/pg-core/index.js").PgColumn<{
            name: "is_deleted";
            tableName: "primary_riot_account";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
}>>>;
/**
 * @desc 길드 멤버 서비스 클래스
 */
export declare class GuildMemberService {
    /**
     * @desc LIKE 검색 패턴 이스케이프 처리
     * %, _, \ 문자를 이스케이프하여 와일드카드 주입 방지
     */
    private escapeLikePattern;
    /**
     * @desc 리플레이 참여 계정들을 길드 멤버로 등록
     * 'UNIQUE(guild_id, account)' 제약 조건에 따라
     * 이미 길드에 등록된 계정은 무시
     *
     */
    insertGuildMember(riotAccounts: RiotAccount[], guildId: string, tx: TransactionType): Promise<{
        id: number;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
        guildId: string;
        status: string;
        account: string;
        mainAccount: string | null;
        isMain: boolean;
    }[]>;
    /**
     * @desc 정확히 일치하는 계정 검색
     */
    private findExactGuildMember;
    /**
     * @desc 비슷한 계정 검색
     * 1. 대소문자 제거 2. 띄어쓰기, 공백 제거
     * [Security] LIKE 패턴 이스케이프 적용
     */
    private findSimilarGuildMember;
    /**
     * @desc 계정 조회 API
     * 1. 정확한 계정 검색 2. 비슷한 계정 검색
     */
    searchGuildMemberByRiotId(guildId: string, params: GetGuildMemberQuery): Promise<{
        playerCode: string;
        riotName: string;
        riotNameTag: string;
        isMain: boolean;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     *
     * @desc 부계정 본계정 연결 (!부캐저장)
     * 1. 부계정 조회, 본계정 조회
     * 2. 부계정이 이미 다른 본계정의 부계정인지 확인
     * 3. 본계정이 이미 다른 본계정의 부계정인지 확인
     * 4. 부계정 is_main, main_account 업데이트
     * 5. 부계정 경기 기록 player_code 본계정으로 변경
     */
    linkSubAccount({ guildId, subRiotName, subRiotTag, mainRiotName, mainRiotTag, }: LinkSubAccountRequest): Promise<{
        id: number;
        status: string;
        account: string;
        mainAccount: string | null;
        isMain: boolean;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
    /**
     * @desc 특정 길드의 모든 부계정 목록 조회
     */
    findSubAccountsByGuildId(guildId: string): Promise<{
        guildId: string;
        subRiotName: string;
        subRiotNameTag: string;
        mainRiotName: string | null;
        mainRiotNameTag: string | null;
    }[]>;
    /**
     * @desc 참여자 목록 중 부캐인 경우 본캐 정보 조회
     */
    findMainAccountsForSubMembers(playerCodes: string[], guildId: string, tx: TransactionType): Promise<{
        account: string;
        mainAccount: string | null;
    }[]>;
    /**
     * @desc GuildMember 복귀, 탈퇴 업데이트
     */
    updateGuildMemberStatusByRiotId(guildId: string, riotName: string, riotNameTag: string, status: '1' | '2'): Promise<{
        id: number;
        status: string;
        account: string;
        mainAccount: string | null;
        isMain: boolean;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }[]>;
    /**
     * @desc 닉네임/태그로 부계정을 찾아 본계정 연동 해제
     */
    deleteSubAccountByRiotId(guildId: string, riotName: string, riotNameTag: string): Promise<{
        id: number;
        status: string;
        account: string;
        mainAccount: string | null;
        isMain: boolean;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    } | null>;
}
export declare const guildMemberService: GuildMemberService;
