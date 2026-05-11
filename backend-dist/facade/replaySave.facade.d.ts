import { ReplaySaveResult, ReplayFileRequest } from '../types/replay.js';
/**
 * @desc 여러 저장 Service 로직 관리
 */
export declare class ReplaySaveFacade {
    /**
     * 디스코드 봇 리플레이 업로드
     * (파일 다운로드 + 길드 upsert + 저장)
     */
    allSave(fileData: ReplayFileRequest): Promise<ReplaySaveResult>;
    /**
     * 웹 리플레이 업로드
     * (파싱된 rawData를 직접 받아서 저장, 길드 upsert 생략)
     */
    webSave(rawData: any[], fileName: string, guildId: string, gameType: string | undefined, nick: string, patchVersion: string): Promise<ReplaySaveResult>;
    /**
     * 공통: riot 계정, 내전, 참여자, 길드멤버 저장
     */
    private saveMatchData;
}
export declare const replaySaveFacade: ReplaySaveFacade;
