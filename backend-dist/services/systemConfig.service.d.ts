export declare class SystemConfigService {
    /**
     * @desc 단일 설정값 조회
     */
    getConfig(key: string): Promise<string | null>;
    /**
     * @desc 단일 설정값 조회 (없으면 기본값 반환)
     */
    getConfigOrDefault(key: string, defaultValue: string): Promise<string>;
    /**
     * @desc 숫자 설정값 조회
     */
    getNumberConfig(key: string, defaultValue: number): Promise<number>;
    /**
     * @desc 쉼표 구분 설정값을 배열로 조회
     */
    getListConfig(key: string): Promise<string[]>;
    /**
     * @desc 전체 설정값 조회
     */
    getAllConfigs(): Promise<Record<string, string>>;
}
export declare const systemConfigService: SystemConfigService;
