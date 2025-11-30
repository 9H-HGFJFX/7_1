const { Vote, VOTE_RESULT } = require('../models/Vote');
const { News, NEWS_STATUS } = require('../models/News');
const NewsService = require('./newsService');

/**
 * Vote Service Class
 */
class VoteService {
    /**
     * Submit vote
     * @param {string} userId - User ID
     * @param {string} newsId - News ID
     * @param {string} result - Vote result (FAKE or NOT_FAKE)
     * @returns {Promise<Object>} Vote result
     */
    static async submitVote(userId, newsId, result) {
        try {
            // 验证新闻是否存在
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('News does not exist');
            }
            
            // 验证投票结果是否有效
            const validResults = Object.values(VOTE_RESULT);
            if (!validResults.includes(result)) {
                throw new Error('Invalid vote result');
            }
            
            // 检查用户是否已经对该新闻投过票
            const existingVote = await Vote.findOne({
                userId,
                newsId
            });
            
            if (existingVote) {
                throw new Error('You have already voted on this news');
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
                message: 'Vote successful',
                vote: {
                    id: vote._id,
                    result: vote.result,
                    createdAt: vote.createdAt
                },
                newsStatus: statusUpdate.status,
                voteStats: statusUpdate.voteStats
            };
        } catch (error) {
            throw new Error(`Vote failed: ${error.message}`);
        }
    }
    
    /**
     * Get user's vote for specific news
     * @param {string} userId - User ID
     * @param {string} newsId - News ID
     * @returns {Promise<Object|null>} User vote information or null
     */
    static async getUserVoteForNews(userId, newsId) {
        try {
            const vote = await Vote.findOne({
                userId,
                newsId
            }).select('result createdAt isInvalid');
            
            return vote ? vote.toObject() : null;
        } catch (error) {
            throw new Error(`Failed to get user vote information: ${error.message}`);
        }
    }
    
    /**
     * Get vote statistics for news
     * @param {string} newsId - News ID
     * @returns {Promise<Object>} Vote statistics
     */
    static async getNewsVoteStats(newsId) {
        try {
            // 直接使用Vote模型的静态方法
            const stats = await Vote.getNewsVoteStats(newsId);
            return stats;
        } catch (error) {
            throw new Error(`Failed to get vote statistics: ${error.message}`);
        }
    }
    
    /**
     * Get all vote records for news (Admin permission)
     * @param {string} newsId - News ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote records list and pagination info
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
            throw new Error(`Failed to get news vote records: ${error.message}`);
        }
    }
    
    /**
     * Mark vote as invalid (Admin permission)
     * @param {string} voteId - Vote ID
     * @param {boolean} isInvalid - Whether invalid
     * @returns {Promise<Object>} Updated vote info and recalculated news status
     */
    static async markVoteInvalid(voteId, isInvalid = true) {
        try {
            // 查找投票
            const vote = await Vote.findById(voteId);
            if (!vote) {
                throw new Error('Vote does not exist');
            }
            
            // 更新投票状态
            vote.isInvalid = isInvalid;
            await vote.save();
            
            // 重新计算新闻状态
            const statusUpdate = await NewsService.recalculateNewsStatus(vote.newsId);
            
            return {
                success: true,
                message: isInvalid ? 'Vote has been marked as invalid' : 'Vote has been restored as valid',
                vote: {
                    id: vote._id,
                    isInvalid: vote.isInvalid
                },
                newsStatus: statusUpdate.status,
                voteStats: statusUpdate.voteStats
            };
        } catch (error) {
            throw new Error(`Failed to update vote status: ${error.message}`);
        }
    }
    
    /**
     * Get user's vote history
     * @param {string} userId - User ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote history list and pagination info
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
            throw new Error(`Failed to get user vote history: ${error.message}`);
        }
    }
    
    /**
     * Batch mark votes as invalid (Admin permission)
     * @param {Array<string>} voteIds - Array of vote IDs
     * @param {boolean} isInvalid - Whether invalid
     * @returns {Promise<Object>} Batch operation result
     */
    static async batchMarkVotesInvalid(voteIds, isInvalid = true) {
        try {
            // 找出需要更新的投票
            const votes = await Vote.find({ _id: { $in: voteIds } });
            
            if (votes.length === 0) {
                throw new Error('No votes found to update');
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
                message: `Successfully updated ${votes.length} vote records`,
                updatedCount: votes.length,
                statusUpdates
            };
        } catch (error) {
            throw new Error(`Failed to batch update vote status: ${error.message}`);
        }
    }
    
    /**
     * Get vote summary statistics (Admin permission)
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote summary statistics
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
            throw new Error(`Failed to get vote summary statistics: ${error.message}`);
        }
    }
}

module.exports = VoteService;