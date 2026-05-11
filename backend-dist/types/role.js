export const ROLES = [
    'userNormal',
    'userUploader',
    'guildManager',
    'adminNormal',
    'adminSuper',
];
/** 전역 권한 (guild_id 불필요) */
export const ADMIN_ROLES = ['adminNormal', 'adminSuper'];
/** 역할 계층 순서 — index가 높을수록 상위 권한 */
export const ROLE_HIERARCHY = {
    userNormal: 0,
    userUploader: 1,
    guildManager: 2,
    adminNormal: 3,
    adminSuper: 4,
};
/** minRole 이상의 권한인지 확인 */
export const hasMinRole = (role, minRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
//# sourceMappingURL=role.js.map