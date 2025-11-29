const { Vote, VOTE_RESULT } = require('../models/Vote');
const { News, NEWS_STATUS } = require('../models/News');
const NewsService = require('./newsService');

/**
 * 投票服务类
 */
class VoteService {
    /**
     * 提交投票
     * @param {string} userId - 用户ID
     * @param {string} newsId - 新闻ID
     * @param {string} result - 投票结果（FAKE或NOT_FAKE）
     * @returns {Promise<Object>} 投票结果
     */
    static async submitVote(userId, newsId, result) {
        try {
            // 验证新闻是否存在
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('新闻不存在');
            }
            
            // 验证投票结果是否有效
            const validResults = Object.values(VOTE_RESULT);
            if (!validResults.includes(result)) {
                throw new Error('无效的投票结果');
            }
            
            // 检查用户是否已经对该新闻投过票
            const existingVote = await Vote.findOne({
                userId,
                newsId
            });
            
            if (existingVote) {
                throw new Error('您已经对该新闻投过票了');
            }
            
            // 创建新投票
            const vote = new Vote({
                userId,
                newsId,
                result,
                isInvalid: false
            });
            
            await vote.save();
            
            // 重新计算新闻状态
            const statusUpdate = await NewsService.recalculateNewsStatus(newsId);
            
            return {
                success: true,
                message: '投票成功',
                vote: {
                    id: vote._id,
                    result: vote.result,
                    createdAt: vote.createdAt
                },
                newsStatus: statusUpdate.status,
                voteStats: statusUpdate.voteStats
            };
        } catch (error) {
            throw new Error(`投票失败: ${error.message}`);
        }
    }
    
    /**
     * 获取用户对特定新闻的投票
     * @param {string} userId - 用户ID
     * @param {string} newsId - 新闻ID
     * @returns {Promise<Object|null>} 用户投票信息或null
     */
    static async getUserVoteForNews(userId, newsId) {
        try {
            const vote = await Vote.findOne({
                userId,
                newsId
            }).select('result createdAt isInvalid');
            
            return vote ? vote.toObject() : null;
        } catch (error) {
            throw new Error(`获取用户投票信息失败: ${error.message}`);
        }
    }
    
    /**
     * 获取新闻的投票统计
     * @param {string} newsId - 新闻ID
     * @returns {Promise<Object>} 投票统计
     */
    static async getNewsVoteStats(newsId) {
        try {
            // 直接使用Vote模型的静态方法
            const stats = await Vote.getNewsVoteStats(newsId);
            return stats;
        } catch (error) {
            throw new Error(`获取投票统计失败: ${error.message}`);
        }
    }
    
    /**
     * 获取新闻的所有投票记录（管理员权限）
     * @param {string} newsId - 新闻ID
     * @param {Object} query - 查询参数
     * @returns {Promise<Object>} 投票记录列表和分页信息
     */
    static async getNewsVotes(newsId, query = {}) {
        try {
            const { page = 1, limit = 20, includeInvalid = false } = query;
            
            // 构建查询条件
            const searchQuery = { newsId };
            
            // 是否包含无效投票
            if (!includeInvalid) {
                searchQuery.isInvalid = false;
            }
            
            // 计算总数
            const total = await Vote.countDocuments(searchQuery);
            
            // 分页查询
            const votes = await Vote.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('userId', 'firstName lastName email');
            
            return {
                votes,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`获取新闻投票记录失败: ${error.message}`);
        }
    }
    
    /**
     * 标记投票为无效（管理员权限）
     * @param {string} voteId - 投票ID
     * @param {boolean} isInvalid - 是否无效
     * @returns {Promise<Object>} 更新后的投票信息和重新计算的新闻状态
     */
    static async markVoteInvalid(voteId, isInvalid = true) {
        try {
            // 查找投票
            const vote = await Vote.findById(voteId);
            if (!vote) {
                throw new Error('投票不存在');
            }
            
            // 更新投票状态
            vote.isInvalid = isInvalid;
            await vote.save();
            
            // 重新计算新闻状态
            const statusUpdate = await NewsService.recalculateNewsStatus(vote.newsId);
            
            return {
                success: true,
                message: isInvalid ? '投票已标记为无效' : '投票已恢复有效',
                vote: {
                    id: vote._id,
                    isInvalid: vote.isInvalid
                },
                newsStatus: statusUpdate.status,
                voteStats: statusUpdate.voteStats
            };
        } catch (error) {
            throw new Error(`更新投票状态失败: ${error.message}`);
        }
    }
    
    /**
     * 获取用户的投票历史
     * @param {string} userId - 用户ID
     * @param {Object} query - 查询参数
     * @returns {Promise<Object>} 投票历史列表和分页信息
     */
    static async getUserVoteHistory(userId, query = {}) {
        try {
            const { page = 1, limit = 10, includeInvalid = false } = query;
            
            // 构建查询条件
            const searchQuery = { userId };
            
            // 是否包含无效投票
            if (!includeInvalid) {
                searchQuery.isInvalid = false;
            }
            
            // 计算总数
            const total = await Vote.countDocuments(searchQuery);
            
            // 分页查询
            const votes = await Vote.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('newsId', 'title status createdAt');
            
            return {
                votes,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`获取用户投票历史失败: ${error.message}`);
        }
    }
    
    /**
     * 批量标记投票为无效（管理员权限）
     * @param {Array<string>} voteIds - 投票ID数组
     * @param {boolean} isInvalid - 是否无效
     * @returns {Promise<Object>} 批量操作结果
     */
    static async batchMarkVotesInvalid(voteIds, isInvalid = true) {
        try {
            // 找出需要更新的投票
            const votes = await Vote.find({ _id: { $in: voteIds } });
            
            if (votes.length === 0) {
                throw new Error('未找到要更新的投票');
            }
            
            // 收集涉及的新闻ID
            const newsIds = [...new Set(votes.map(vote => vote.newsId.toString()))];
            
            // 批量更新
            await Vote.updateMany(
                { _id: { $in: voteIds } },
                { $set: { isInvalid } }
            );
            
            // 对涉及的每条新闻重新计算状态
            const statusUpdates = await Promise.all(
                newsIds.map(newsId => NewsService.recalculateNewsStatus(newsId))
            );
            
            return {
                success: true,
                message: `成功更新了 ${votes.length} 条投票记录`,
                updatedCount: votes.length,
                statusUpdates
            };
        } catch (error) {
            throw new Error(`批量更新投票状态失败: ${error.message}`);
        }
    }
    
    /**
     * 获取投票统计汇总（管理员权限）
     * @param {Object} query - 查询参数
     * @returns {Promise<Object>} 投票统计汇总
     */
    static async getVoteSummary(query = {}) {
        try {
            const { startDate, endDate } = query;
            
            // 构建查询条件
            const searchQuery = {};
            
            // 日期范围筛选
            if (startDate || endDate) {
                searchQuery.createdAt = {};
                if (startDate) {
                    searchQuery.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    searchQuery.createdAt.$lte = new Date(endDate);
                }
            }
            
            // 聚合查询
            const summary = await Vote.aggregate([
                { $match: searchQuery },
                {
                    $group: {
                        _id: null,
                        totalVotes: { $sum: 1 },
                        validVotes: { $sum: { $cond: [{ $eq: ['$isInvalid', false] }, 1, 0] } },
                        invalidVotes: { $sum: { $cond: [{ $eq: ['$isInvalid', true] }, 1, 0] } },
                        fakeVotes: { $sum: { $cond: [{ $and: [{ $eq: ['$result', VOTE_RESULT.FAKE] }, { $eq: ['$isInvalid', false] }] }, 1, 0] } },
                        notFakeVotes: { $sum: { $cond: [{ $and: [{ $eq: ['$result', VOTE_RESULT.NOT_FAKE] }, { $eq: ['$isInvalid', false] }] }, 1, 0] } }
                    }
                }
            ]);
            
            return summary.length > 0 ? summary[0] : {
                totalVotes: 0,
                validVotes: 0,
                invalidVotes: 0,
                fakeVotes: 0,
                notFakeVotes: 0
            };
        } catch (error) {
            throw new Error(`获取投票统计汇总失败: ${error.message}`);
        }
    }
}

module.exports = VoteService;