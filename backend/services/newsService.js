const { News, NEWS_STATUS } = require('../models/News');
const { Vote } = require('../models/Vote');
const { Comment } = require('../models/Comment');

/**
 * News Service Class
 */
class NewsService {
    /**
     * Create news
     * @param {Object} newsData - News data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Created news object
     */
    static async createNews(newsData, userId) {
        try {
            // 创建新闻实例
            const news = new News({
                title: newsData.title,
                content: newsData.content,
                status: NEWS_STATUS.PENDING, // Initial status is pending for review
                author: userId,
                imageUrl: newsData.imageUrl || null
            });
            
            // 保存新闻
            await news.save();
            
            // 填充作者信息
            await news.populate('author', 'firstName lastName email role');
            
            return news;
        } catch (error) {
            throw new Error(`Failed to create news: ${error.message}`);
        }
    }
    
    /**
     * Get news list
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} News list and pagination info
     */
    static async getNewsList(query = {}) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                status = 'all', 
                search = '',
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = query;
            
            // 构建查询条件
            const searchQuery = {};
            
            // 状态筛选
            if (status && status !== 'all') {
                searchQuery.status = status;
            }
            
            // 搜索功能（按标题、内容、作者信息）
            if (search) {
                searchQuery.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { content: { $regex: search, $options: 'i' } },
                    // 作者信息需要通过populate后过滤
                ];
            }
            
            // 排序条件
            const sortCriteria = {};
            sortCriteria[sortBy] = sortOrder === 'asc' ? 1 : -1;
            
            // 计算总数
            const total = await News.countDocuments(searchQuery);
            
            // 分页查询
            const newsList = await News.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort(sortCriteria)
                .populate('author', 'firstName lastName email role');
            
            // 对于每条新闻，获取投票统计
            const newsWithVoteStats = await Promise.all(
                newsList.map(async news => {
                    const newsObj = news.toObject();
                    
                    // 获取投票统计
                    const voteStats = await Vote.getNewsVoteStats(news._id);
                    newsObj.voteStats = voteStats;
                    
                    // 获取评论数
                    const commentCount = await Comment.countDocuments({
                        newsId: news._id,
                        isDeleted: false
                    });
                    newsObj.commentCount = commentCount;
                    
                    return newsObj;
                })
            );
            
            return {
                news: newsWithVoteStats,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get news list: ${error.message}`);
        }
    }
    
    /**
     * Get news details
     * @param {string} newsId - News ID
     * @returns {Promise<Object>} News details
     */
    static async getNewsDetail(newsId) {
        try {
            // 查询新闻
            const news = await News.findById(newsId)
                .populate('author', 'firstName lastName email role');
            
            if (!news) {
                throw new Error('News not found');
            }
            
            // 转换为普通对象
            const newsObj = news.toObject();
            
            // 获取投票统计
            const voteStats = await Vote.getNewsVoteStats(newsId);
            newsObj.voteStats = voteStats;
            
            // 获取评论数
            const commentCount = await Comment.countDocuments({
                newsId: newsId,
                isDeleted: false
            });
            newsObj.commentCount = commentCount;
            
            return newsObj;
        } catch (error) {
            throw new Error(`Failed to get news details: ${error.message}`);
        }
    }
    
    /**
     * Update news
     * @param {string} newsId - News ID
     * @param {Object} updateData - Update data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Updated news
     */
    static async updateNews(newsId, updateData, userId) {
        try {
            // 查找新闻
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('News not found');
            }
            
            // 检查是否为新闻作者
            if (news.author.toString() !== userId) {
                throw new Error('No permission to modify this news');
            }
            
            // 更新字段
            const allowedUpdates = ['title', 'content', 'imageUrl'];
            allowedUpdates.forEach(field => {
                if (updateData[field] !== undefined) {
                    news[field] = updateData[field];
                }
            });
            
            // 保存更新
            await news.save();
            
            // 重新填充作者信息
            await news.populate('author', 'firstName lastName email role');
            
            return news;
        } catch (error) {
            throw new Error(`Failed to update news: ${error.message}`);
        }
    }
    
    /**
     * Delete news
     * @param {string} newsId - News ID
     * @param {string} userId - User ID
     * @param {boolean} isAdmin - Whether it's admin operation
     * @returns {Promise<Object>} Delete result
     */
    static async deleteNews(newsId, userId, isAdmin = false) {
        try {
            // 查找新闻
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('News not found');
            }
            
            // 检查权限
            if (!isAdmin && news.author.toString() !== userId) {
                throw new Error('No permission to delete this news');
            }
            
            // 删除新闻相关的投票和评论
            await Vote.deleteMany({ newsId });
            await Comment.deleteMany({ newsId });
            
            // 删除新闻
            await News.findByIdAndDelete(newsId);
            
            return { success: true, message: 'News deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete news: ${error.message}`);
        }
    }
    
    /**
     * Update news status (admin operation)
     * @param {string} newsId - News ID
     * @param {string} status - New status
     * @returns {Promise<Object>} Updated news
     */
    static async updateNewsStatus(newsId, status) {
        try {
            // 验证状态是否有效
            const validStatuses = Object.values(NEWS_STATUS);
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid news status');
            }
            
            // 更新状态
            const news = await News.findByIdAndUpdate(
                newsId,
                { status },
                { new: true, runValidators: true }
            ).populate('author', 'firstName lastName email role');
            
            if (!news) {
                throw new Error('News not found');
            }
            
            return news;
        } catch (error) {
            throw new Error(`Failed to update news status: ${error.message}`);
        }
    }
    
    /**
     * Recalculate news vote status
     * @param {string} newsId - News ID
     * @returns {Promise<Object>} Updated news status and vote statistics
     */
    static async recalculateNewsStatus(newsId) {
        try {
            // 查找新闻
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('News not found');
            }
            
            // 获取投票统计
            const voteStats = await Vote.getNewsVoteStats(newsId);
            
            // 重新计算状态
            let newStatus = NEWS_STATUS.PENDING;
            const totalVotes = voteStats.fakeCount + voteStats.notFakeCount;
            
            // 只有当投票数达到阈值时才改变状态
            if (totalVotes >= 5) {
                // 计算假新闻投票比例
                const fakeRatio = voteStats.fakeCount / totalVotes;
                
                if (fakeRatio >= 0.6) {
                    newStatus = NEWS_STATUS.FAKE;
                } else if (fakeRatio <= 0.4) {
                    newStatus = NEWS_STATUS.NOT_FAKE;
                }
                // 如果比例在0.4-0.6之间，保持PENDING状态
            }
            
            // 更新新闻状态
            news.status = newStatus;
            await news.save();
            
            return {
                newsId,
                status: newStatus,
                voteStats
            };
        } catch (error) {
            throw new Error(`Failed to recalculate news status: ${error.message}`);
        }
    }
    
    /**
     * Get user's news list
     * @param {string} userId - User ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} News list and pagination info
     */
    static async getUserNews(userId, query = {}) {
        try {
            const { page = 1, limit = 10, status = 'all' } = query;
            
            // 构建查询条件
            const searchQuery = { author: userId };
            
            // 状态筛选
            if (status && status !== 'all') {
                searchQuery.status = status;
            }
            
            // 计算总数
            const total = await News.countDocuments(searchQuery);
            
            // 分页查询
            const newsList = await News.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('author', 'firstName lastName email role');
            
            // 添加投票统计
            const newsWithVoteStats = await Promise.all(
                newsList.map(async news => {
                    const newsObj = news.toObject();
                    const voteStats = await Vote.getNewsVoteStats(news._id);
                    newsObj.voteStats = voteStats;
                    return newsObj;
                })
            );
            
            return {
                news: newsWithVoteStats,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get user news list: ${error.message}`);
        }
    }
}

module.exports = NewsService;