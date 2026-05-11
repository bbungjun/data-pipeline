import { ADMIN_ROLES, hasMinRole } from '../types/role.js';
import { BusinessError } from '../types/error.js';
import { discordMemberRoleService } from '../services/discordMemberRole.service.js';
import { guildService } from '../services/guild.service.js';
/** 요청에서 guildId를 추출 */
const extractGuildId = (req, source) => {
    const target = req[source.from];
    const value = target?.[source.key];
    return typeof value === 'string' ? value : undefined;
};
/**
 * 전역 Admin 검증 미들웨어
 * @param minRole - 최소 요구 권한 ('adminNormal' | 'adminSuper')
 *
 * @example
 * router.post('/', requireAdmin('adminNormal'), createGuild);
 */
export const requireAdmin = (minRole) => async (req, res, next) => {
    try {
        if (req.isBot)
            return next();
        const memberId = req.discordMemberId;
        if (!memberId) {
            throw new BusinessError('Unauthorized', 401, { isLoggable: true });
        }
        const roles = await discordMemberRoleService.getActiveRoles(memberId);
        const adminRoles = roles.filter((r) => ADMIN_ROLES.includes(r.role));
        const hasPermission = adminRoles.some((r) => hasMinRole(r.role, minRole));
        if (!hasPermission) {
            throw new BusinessError('Forbidden: insufficient admin role', 403, { isLoggable: true });
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
/**
 * Guild 스코프 역할 검증 미들웨어
 * - adminNormal 이상은 자동 bypass
 * @param minRole - 최소 요구 권한
 * @param source  - 요청에서 guildId를 읽을 위치
 *
 * @example
 * router.put('/status', requireGuildRole('guildManager', { from: 'body', key: 'guildId' }), handler);
 */
export const requireGuildRole = (minRole, source) => async (req, res, next) => {
    try {
        if (req.isBot)
            return next();
        const memberId = req.discordMemberId;
        if (!memberId) {
            throw new BusinessError('Unauthorized', 401, { isLoggable: true });
        }
        const guildId = extractGuildId(req, source);
        if (!guildId) {
            throw new BusinessError('guildId is required', 400, { isLoggable: true });
        }
        const roles = await discordMemberRoleService.getActiveRolesByGuild(memberId, guildId);
        // Admin bypass: adminNormal 이상이면 guildId 무관하게 통과
        const isAdmin = roles
            .filter((r) => ADMIN_ROLES.includes(r.role))
            .some((r) => hasMinRole(r.role, 'adminNormal'));
        if (isAdmin)
            return next();
        // Guild 스코프 권한 검증
        const hasPermission = roles.some((r) => hasMinRole(r.role, minRole));
        if (!hasPermission) {
            throw new BusinessError('Forbidden: insufficient guild role', 403, { isLoggable: true });
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
/**
 * 웹 리플레이 업로드 권한 검증 미들웨어
 * - guild.allowAllUploads = true → 인증된 유저면 모두 허용
 * - guild.allowAllUploads = false → userUploader 이상 필요
 * - adminNormal 이상 → bypass
 * @param source - 요청에서 guildId를 읽을 위치
 */
export const requireUploadPermission = (source) => async (req, res, next) => {
    try {
        if (req.isBot)
            return next();
        const memberId = req.discordMemberId;
        if (!memberId) {
            throw new BusinessError('Unauthorized', 401, { isLoggable: true });
        }
        const guildId = extractGuildId(req, source);
        if (!guildId) {
            throw new BusinessError('guildId is required', 400, { isLoggable: false });
        }
        const guildData = await guildService.findGuildById(guildId);
        if (!guildData) {
            throw new BusinessError('Guild not found', 400, { isLoggable: false });
        }
        const roles = await discordMemberRoleService.getActiveRolesByGuild(memberId, guildId);
        // Admin bypass: adminNormal 이상이면 무조건 통과
        const isAdmin = roles
            .filter((r) => ADMIN_ROLES.includes(r.role))
            .some((r) => hasMinRole(r.role, 'adminNormal'));
        if (isAdmin)
            return next();
        // allowAllUploads = true → 인증된 유저면 통과
        if (guildData.allowAllUploads)
            return next();
        // allowAllUploads = false → userUploader 이상 필요
        const hasPermission = roles.some((r) => hasMinRole(r.role, 'userUploader'));
        if (!hasPermission) {
            throw new BusinessError('Forbidden: insufficient upload permission', 403, { isLoggable: true });
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
//# sourceMappingURL=requireRole.js.map