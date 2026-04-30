import { eq } from 'drizzle-orm';
import { db } from '../database/connectionPool.js';
import { systemConfig } from '../database/schema.js';
export class SystemConfigService {
    /**
     * @desc 단일 설정값 조회
     */
    async getConfig(key) {
        const result = await db
            .select({ value: systemConfig.value })
            .from(systemConfig)
            .where(eq(systemConfig.key, key))
            .limit(1);
        return result[0]?.value ?? null;
    }
    /**
     * @desc 단일 설정값 조회 (없으면 기본값 반환)
     */
    async getConfigOrDefault(key, defaultValue) {
        const value = await this.getConfig(key);
        return value ?? defaultValue;
    }
    /**
     * @desc 숫자 설정값 조회
     */
    async getNumberConfig(key, defaultValue) {
        const value = await this.getConfig(key);
        return value ? Number(value) : defaultValue;
    }
    /**
     * @desc 쉼표 구분 설정값을 배열로 조회
     */
    async getListConfig(key) {
        const value = await this.getConfig(key);
        return value ? value.split(',').map((v) => v.trim()) : [];
    }
    /**
     * @desc 전체 설정값 조회
     */
    async getAllConfigs() {
        const results = await db.select().from(systemConfig);
        const configMap = {};
        for (const row of results) {
            configMap[row.key] = row.value;
        }
        return configMap;
    }
}
export const systemConfigService = new SystemConfigService();
//# sourceMappingURL=systemConfig.service.js.map