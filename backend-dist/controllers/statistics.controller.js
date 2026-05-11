import { statisticsService } from '../services/statistics.service.js';
/**
 * @desc 유저별 게임 통계 조회
 * @route GET /api/statistics/:guildId/users
 */
export const getUserGameStats = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { datePreset, fromMonth, toMonth, championName, position, season, sortBy, page, limit } = req.query;
        const { result, totalCount } = await statisticsService.getUserGameStatistics(guildId, {
            datePreset,
            fromMonth,
            toMonth,
            championName,
            position,
            season,
            sortBy: sortBy || 'totalCount',
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        res.setHeader('X-Total-Count', totalCount.toString());
        res.setHeader('X-Page', (page ?? 1).toString());
        res.setHeader('X-Limit', (limit ?? 50).toString());
        res.setHeader('X-Total-Pages', Math.ceil(totalCount / (Number(limit) ?? 50)).toString());
        return res.status(200).json({
            status: 'success',
            message: 'User game statistics retrieved successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Error retrieving user game stats:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error while retrieving user game stats',
            data: null,
        });
    }
};
/**
 * @desc 챔피언별 통계 조회
 * @route GET /api/statistics/:guildId/champions
 */
export const getChampionStats = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { datePreset, fromMonth, toMonth, position, season, sortBy, page, limit } = req.query;
        const { result, totalCount } = await statisticsService.getChampionStatistics(guildId, {
            datePreset,
            fromMonth,
            toMonth,
            position,
            season,
            sortBy: sortBy || 'totalCount',
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        res.setHeader('X-Total-Count', totalCount.toString());
        res.setHeader('X-Page', (page ?? 1).toString());
        res.setHeader('X-Limit', (limit ?? 50).toString());
        res.setHeader('X-Total-Pages', Math.ceil(totalCount / (Number(limit) ?? 50)).toString());
        return res.status(200).json({
            status: 'success',
            message: 'Champion statistics retrieved successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Error retrieving champion stats:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error while retrieving champion stats',
            data: null,
        });
    }
};
//# sourceMappingURL=statistics.controller.js.map