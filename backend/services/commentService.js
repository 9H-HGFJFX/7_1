const { Comment } = require('../models/Comment');
const { News } = require('../models/News');

/**
 * Comment Service Class
 */
class CommentService {
    /**
     * Create comment
     * @param {Object} commentData - Comment data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Created comment object
     */
    static async createComment(commentData, userId) {
        try {
            // 验证新闻是否存在
            const news = await News.findById(commentData.newsId);
            if (!news) {
                throw new Error('News not found');
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
            throw new Error(`Failed to create comment: ${error.message}`);
        }
    }
    
    /**
     * Get news comments list
     * @param {string} newsId - News ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Comments list and pagination info
     */
    static async getNewsComments(newsId, query = {}) {
        try {
            const { page = 1, limit = 10, includeDeleted = false } = query;
            
            // 验证新闻是否存在
            const news = await News.findById(newsId);
            if (!news) {
                throw new Error('News not found');
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
            throw new Error(`Failed to get comments list: ${error.message}`);
        }
    }
    
    /**
     * Get comment details
     * @param {string} commentId - Comment ID
     * @returns {Promise<Object>} Comment details
     */
    static async getCommentById(commentId) {
        try {
            const comment = await Comment.findById(commentId)
                .populate('userId', 'firstName lastName email role')
                .populate('newsId', 'title');
            
            if (!comment) {
                throw new Error('Comment not found');
            }
            
            return comment;
        } catch (error) {
            throw new Error(`Failed to get comment details: ${error.message}`);
        }
    }
    
    /**
     * Update comment
     * @param {string} commentId - Comment ID
     * @param {Object} updateData - Update data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Updated comment
     */
    static async updateComment(commentId, updateData, userId) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('Comment not found');
            }
            
            // 检查是否为评论作者
            if (comment.userId.toString() !== userId) {
                throw new Error('No permission to modify this comment');
            }
            
            // 检查评论是否已被删除
            if (comment.isDeleted) {
                throw new Error('Comment has been deleted, cannot modify');
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
            throw new Error(`Failed to update comment: ${error.message}`);
        }
    }
    
    /**
     * Delete comment (soft delete)
     * @param {string} commentId - Comment ID
     * @param {string} userId - User ID
     * @param {boolean} isAdmin - Whether it's admin operation
     * @returns {Promise<Object>} Delete result
     */
    static async deleteComment(commentId, userId, isAdmin = false) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('Comment not found');
            }
            
            // 检查权限
            if (!isAdmin && comment.userId.toString() !== userId) {
                throw new Error('No permission to delete this comment');
            }
            
            // 检查是否已经删除
            if (comment.isDeleted) {
                throw new Error('Comment has already been deleted');
            }
            
            // 软删除
            comment.isDeleted = true;
            await comment.save();
            
            return { success: true, message: 'Comment deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete comment: ${error.message}`);
        }
    }
    
    /**
     * Restore deleted comment (admin permission)
     * @param {string} commentId - Comment ID
     * @returns {Promise<Object>} Restore result
     */
    static async restoreComment(commentId) {
        try {
            // 查找评论
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new Error('Comment not found');
            }
            
            // 检查是否已删除
            if (!comment.isDeleted) {
                throw new Error('Comment is not deleted, no need to restore');
            }
            
            // 恢复评论
            comment.isDeleted = false;
            await comment.save();
            
            // 重新填充用户信息
            await comment.populate('userId', 'firstName lastName email role');
            
            return {
                success: true,
                message: 'Comment restored successfully',
                comment
            };
        } catch (error) {
            throw new Error(`Failed to restore comment: ${error.message}`);
        }
    }
    
    /**
     * Get user's comments list
     * @param {string} userId - User ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Comments list and pagination info
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
            throw new Error(`Failed to get user comments list: ${error.message}`);
        }
    }
    
    /**
     * Batch delete comments (admin permission)
     * @param {Array<string>} commentIds - Array of comment IDs
     * @returns {Promise<Object>} Batch operation result
     */
    static async batchDeleteComments(commentIds) {
        try {
            // 批量更新（软删除）
            const result = await Comment.updateMany(
                { _id: { $in: commentIds }, isDeleted: false },
                { $set: { isDeleted: true } }
            );
            
            if (result.nModified === 0) {
                throw new Error('No comments found for deletion');
            }
            
            return {
                success: true,
                message: `Successfully deleted ${result.nModified} comments`,
                deletedCount: result.nModified
            };
        } catch (error) {
            throw new Error(`Failed to batch delete comments: ${error.message}`);
        }
    }
    
    /**
     * Get comment statistics
     * @param {string} newsId - News ID
     * @returns {Promise<Object>} Comment statistics
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
            throw new Error(`Failed to get comment statistics: ${error.message}`);
        }
    }
}

module.exports = CommentService;