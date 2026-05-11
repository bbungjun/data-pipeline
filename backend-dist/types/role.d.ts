export declare const ROLES: readonly ["userNormal", "userUploader", "guildManager", "adminNormal", "adminSuper"];
export type Role = (typeof ROLES)[number];
/** 전역 권한 (guild_id 불필요) */
export declare const ADMIN_ROLES: readonly Role[];
/** 역할 계층 순서 — index가 높을수록 상위 권한 */
export declare const ROLE_HIERARCHY: Record<Role, number>;
/** minRole 이상의 권한인지 확인 */
export declare const hasMinRole: (role: Role, minRole: Role) => boolean;
