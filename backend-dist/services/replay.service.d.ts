/// <reference types="node" />
/// <reference types="node" />
import { TransactionType } from '../database/connectionPool.js';
import { ReplayFileRequest } from '../types/replay.js';
/**
 * @desc 리플레이 파일 서비스
 */
export declare class ReplayService {
    /**
     * @desc 주어진 데이터를 사용하여 SHA-256 해시를 생성
     */
    generateHash: (data: string | Buffer) => string;
    /**
     * @desc 파일의 해시값과 길드 ID가 일치하는 중복 레코드의 존재 여부를 확인
     * @returns 중복된 레코드가 존재하면 true, 존재하지 않으면 false
     */
    checkDuplicateByHash(hashData: string, guildId: string): Promise<boolean>;
    /**
     * @desc 디스코드 파일 데이터 가져오기 (메모리 제한 적용)
     */
    private getInputStreamDiscordFile;
    /**
     * @desc replay_code 생성 (RPY-YYMMDD-filename-id) 형식
     */
    private generateReplayCode;
    /**
     * @desc 리플레이 데이터 파싱
     */
    parseReplayData(byte: Buffer): Promise<{
        patchVersion: string;
        stats: any[];
    }>;
    /**
     * @desc get rawdataes
     */
    getRawData(fileData: ReplayFileRequest): Promise<{
        rawData: any[];
        patchVersion: string;
    }>;
    /**
     * @desc 리플레이 저장
     * @param {ReplayFileRequest} fileData
     */
    /**
     * @desc .rofl 파일의 magic bytes 검증 (첫 4바이트가 "RIOT"인지 확인)
     */
    validateMagicBytes(buffer: Buffer): boolean;
    replaySave(fileData: ReplayFileRequest | {
        fileName: string;
        fileUrl: string;
        gameType?: string;
        createUser: string;
        guildId: string;
    }, rawData: any, tx: TransactionType, patchVersion?: string | null): Promise<{
        id: number;
        replayCode: string;
        fileName: string;
        fileUrl: string;
        hashData: string;
        gameType: string;
        season: string;
        patchVersion: string | null;
        createUser: string;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
    /**
     * @desc 길드별 리플레이 목록 조회 (최신순, 페이지네이션)
     */
    findReplaysByGuild(guildId: string, page?: number, limit?: number): Promise<{
        result: {
            id: number;
            replayCode: string;
            fileName: string;
            gameType: string;
            season: string;
            patchVersion: string | null;
            createUser: string;
            guildId: string;
            createDate: Date;
        }[];
        totalCount: number;
    }>;
    /**
     * @desc 리플레이 코드를 사용하여 리플레이를 논리적으로 삭제
     */
    softDeleteReplayByCode(replayCode: string, tx: TransactionType): Promise<{
        id: number;
        replayCode: string;
        fileName: string;
        fileUrl: string;
        rawData: unknown;
        hashData: string;
        gameType: string;
        season: string;
        patchVersion: string | null;
        createUser: string;
        guildId: string;
        createDate: Date;
        updateDate: Date;
        isDeleted: boolean;
    }>;
}
export declare const replayService: ReplayService;
