const { Comment } = require('../models/Comment');
const { News } = require('../models/News');

/**
 * 评论服务类
 */
class CommentService {
    /**
     * 创建评论
     * @param {Object} commentData - 评论数据
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 创建的评论对象
     */
    static async createComment(commentData, userId) {
        try {
            // 验证新闻是否存在
            const news = await News.findById(commentData.newsId);
            if (!news) {
                throw new Error('新闻不存在');
            }
            
            // 创建评论实例
            const comment = new Comment({
                content: commentData.content,
                userId,
                newsId: commentData.newsId,
                imageUrl: commentData.imageUrl || null,
                isDeleted: false
            });
            
            // 保存评论
            await comment.save();
            
            // 填充用户信息
            await comment.populate('userId', 'firstName lastName email role');
            
            return comment;
        } catch (error) {
            throw new Error(`创建评论失败: ${error.message}`);
        }
    }
    
    /**
     * 获取新闻的评论列表
     * @param {string} newsId - 新闻ID
     * @param {Object} query - 查询参数
     * @returns {Promise<Object>} 评论列表和分页信息
     */
    static async getNewsComments(newsId, query = {}) {
        try {
            const { page = 1, limit = 10, includeDeleted = false } = query;
            
            // 验证新闻是否存在
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('新闻不存在');
            }
            
            // 构建查询条件
            const searchQuery = { newsId };
            
            // 是否包含已删除的评论
            if (!includeDeleted) {
                searchQuery.isDeleted = false;
            }
            
            // 计算总数
            const total = await Comment.countDocuments(searchQuery);
            
            // 分页查询
            const comments = await Comment.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('userId', 'firstName lastName email role');
            
            return {
                comments,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`获取评论列表失败: ${error.message}`);
        }
    }
    
    /**
     * 获取评论详情
     * @param {string} commentId - 评论ID
     * @returns {Promise<Object>} 评论详情
     */
    static async getCommentById(commentId) {
        try {
            const comment = await Comment.findById(commentId)
                .populate('userId', 'firstName lastName email role')
                .populate('newsId', 'title');
            
            if (!comment) {
                throw new Error('评论不存在');
            }
            
            return comment;
        } catch (error) {
            throw new Error(`获取评论详情失败: ${error.message}`);
        }
    }
    
    /**
     * 更新评论
     * @param {string} commentId - 评论ID
     * @param {Object} updateData - 更新数据
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 更新后的评论
     */
    static async updateComment(commentId, updateData, userId) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('评论不存在');
            }
            
            // 检查是否为评论作者
            if (comment.userId.toString() !== userId) {
                throw new Error('无权限修改此评论');
            }
            
            // 检查评论是否已被删除
            if (comment.isDeleted) {
                throw new Error('评论已被删除，无法修改');
            }
            
            // 更新字段
            const allowedUpdates = ['content', 'imageUrl'];
            allowedUpdates.forEach(field => {
                if (updateData[field] !== undefined) {
                    comment[field] = updateData[field];
                }
            });
            
            // 保存更新
            await comment.save();
            
            // 重新填充用户信息
            await comment.populate('userId', 'firstName lastName email role');
            
            return comment;
        } catch (error) {
            throw new Error(`更新评论失败: ${error.message}`);
        }
    }
    
    /**
     * 删除评论（软删除）
     * @param {string} commentId - 评论ID
     * @param {string} userId - 用户ID
     * @param {boolean} isAdmin - 是否为管理员操作
     * @returns {Promise<Object>} 删除结果
     */
    static async deleteComment(commentId, userId, isAdmin = false) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('评论不存在');
            }
            
            // 检查权限
            if (!isAdmin && comment.userId.toString() !== userId) {
                throw new Error('无权限删除此评论');
            }
            
            // 检查是否已经删除
            if (comment.isDeleted) {
                throw new Error('评论已经被删除');
            }
            
            // 软删除
            comment.isDeleted = true;
            await comment.save();
            
            return { success: true, message: '评论删除成功' };
        } catch (error) {
            throw new Error(`删除评论失败: ${error.message}`);
        }
    }
    
    /**
     * 恢复已删除的评论（管理员权限）
     * @param {string} commentId - 评论ID
     * @returns {Promise<Object>} 恢复结果
     */
    static async restoreComment(commentId) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('评论不存在');
            }
            
            // 检查是否已删除
            if (!comment.isDeleted) {
                throw new Error('评论未被删除，无需恢复');
            }
            
            // 恢复评论
            comment.isDeleted = false;
            await comment.save();
            
            // 重新填充用户信息
            await comment.populate('userId', 'firstName lastName email role');
            
            return {
                success: true,
                message: '评论恢复成功',
                comment
            };
        } catch (error) {
            throw new Error(`恢复评论失败: ${error.message}`);
        }
    }
    
    /**
     * 获取用户的评论列表
     * @param {string} userId - 用户ID
     * @param {Object} query - 查询参数
     * @returns {Promise<Object>} 评论列表和分页信息
     */
    static async getUserComments(userId, query = {}) {
        try {
            const { page = 1, limit = 10, includeDeleted = false } = query;
            
            // 构建查询条件
            const searchQuery = { userId };
            
            // 是否包含已删除的评论
            if (!includeDeleted) {
                searchQuery.isDeleted = false;
            }
            
            // 计算总数
            const total = await Comment.countDocuments(searchQuery);
            
            // 分页查询
            const comments = await Comment.find(searchQuery)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('newsId', 'title status');
            
            return {
                comments,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`获取用户评论列表失败: ${error.message}`);
        }
    }
    
    /**
     * 批量删除评论（管理员权限）
     * @param {Array<string>} commentIds - 评论ID数组
     * @returns {Promise<Object>} 批量操作结果
     */
    static async batchDeleteComments(commentIds) {
        try {
            // 批量更新（软删除）
            const result = await Comment.updateMany(
                { _id: { $in: commentIds }, isDeleted: false },
                { $set: { isDeleted: true } }
            );
            
            if (result.nModified === 0) {
                throw new Error('未找到可删除的评论');
            }
            
            return {
                success: true,
                message: `成功删除了 ${result.nModified} 条评论`,
                deletedCount: result.nModified
            };
        } catch (error) {
            throw new Error(`批量删除评论失败: ${error.message}`);
        }
    }
    
    /**
     * 获取评论统计信息
     * @param {string} newsId - 新闻ID
     * @returns {Promise<Object>} 评论统计
     */
    static async getCommentStats(newsId) {
        try {
            // 获取有效评论数
            const validCount = await Comment.countDocuments({
                newsId,
                isDeleted: false
            });
            
            // 获取总评论数
            const totalCount = await Comment.countDocuments({ newsId });
            
            // 获取最新评论
            const latestComment = await Comment.findOne({
                newsId,
                isDeleted: false
            })
                .sort({ createdAt: -1 })
                .populate('userId', 'firstName lastName');
            
            return {
                totalCount,
                validCount,
                deletedCount: totalCount - validCount,
                latestComment: latestComment ? {
                    id: latestComment._id,
                    content: latestComment.content.substring(0, 100) + (latestComment.content.length > 100 ? '...' : ''),
                    createdAt: latestComment.createdAt,
                    author: latestComment.userId
                } : null
            };
        } catch (error) {
            throw new Error(`获取评论统计失败: ${error.message}`);
        }
    }
}

module.exports = CommentService;