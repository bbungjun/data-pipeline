import { db } from '../database/connectionPool.js';
import { guildService } from '../services/guild.service.js';
import { replayService } from '../services/replay.service.js';
import { riotAccountService } from '../services/riotAccount.service.js';
import { customMatchService } from '../services/customMatch.service.js';
import { matchParticipantService } from '../services/matchParticipant.service.js';
import { guildMemberService } from '../services/guildMember.service.js';
import { SystemError } from '../types/error.js';
/**
 * @desc 여러 저장 Service 로직 관리
 */
export class ReplaySaveFacade {
    /**
     * 디스코드 봇 리플레이 업로드
     * (파일 다운로드 + 길드 upsert + 저장)
     */
    async allSave(fileData) {
        return db.transaction(async (tx) => {
            const { rawData, patchVersion } = await replayService.getRawData(fileData);
            // 1. 길드 저장
            await guildService.upsertGuild(fileData.guild, tx);
            // 2. 리플레이 저장
            const savedReplay = await replayService.replaySave(fileData, rawData, tx, patchVersion);
            await this.saveMatchData(rawData, savedReplay, tx);
            return savedReplay;
        });
    }
    /**
     * 웹 리플레이 업로드
     * (파싱된 rawData를 직접 받아서 저장, 길드 upsert 생략)
     */
    async webSave(rawData, fileName, guildId, gameType, nick, patchVersion) {
        return db.transaction(async (tx) => {
            const savedReplay = await replayService.replaySave({ fileName, fileUrl: 'web', gameType, createUser: nick, guildId }, rawData, tx, patchVersion);
            await this.saveMatchData(rawData, savedReplay, tx);
            return savedReplay;
        });
    }
    /**
     * 공통: riot 계정, 내전, 참여자, 길드멤버 저장
     */
    async saveMatchData(rawData, savedReplay, tx) {
        await riotAccountService.upsertRiotAccount(rawData, tx);
        const rawDataPuuids = new Set(rawData.map((d) => d.PUUID));
        const riotAccounts = await riotAccountService.findRiotAccountsByPuuids(rawData, tx);
        const foundPuuids = new Set(riotAccounts.map((acc) => acc.puuid));
        const missingPuuids = [...rawDataPuuids].filter((p) => !foundPuuids.has(p));
        if (missingPuuids.length > 0) {
            throw new SystemError(`Missing riot accounts for PUUIDs: ${missingPuuids.join(', ')}. ` +
                `Expected ${rawDataPuuids.size}, found ${foundPuuids.size}.`, 500);
        }
        const playerCodes = riotAccounts.map((acc) => acc.playerCode);
        const subAccountLinks = await guildMemberService.findMainAccountsForSubMembers(playerCodes, savedReplay.guildId, tx);
        const subToMainMap = new Map();
        subAccountLinks.forEach((link) => {
            if (link.mainAccount) {
                subToMainMap.set(link.account, link.mainAccount);
            }
        });
        const puuidToPlayerCodeMap = new Map();
        riotAccounts.forEach((acc) => {
            const targetPlayerCode = subToMainMap.get(acc.playerCode) || acc.playerCode;
            puuidToPlayerCodeMap.set(acc.puuid, targetPlayerCode);
        });
        const customMatchData = {
            id: savedReplay.replayCode,
            gameType: savedReplay.gameType,
            guildId: savedReplay.guildId,
            season: savedReplay.season,
        };
        await customMatchService.insertCustomMatch(customMatchData, tx);
        await matchParticipantService.insertMatchParticipants(rawData, customMatchData.id, tx, puuidToPlayerCodeMap);
        await guildMemberService.insertGuildMember(riotAccounts, savedReplay.guildId, tx);
    }
}
export const replaySaveFacade = new ReplaySaveFacade();
//# sourceMappingURL=replaySave.facade.js.map