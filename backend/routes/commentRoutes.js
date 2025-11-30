const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const { News } = require('../models/News');
const { authenticate, authorize, isAdmin } = require('../middlewares/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * Get news comments list
 */
router.get('/news/:newsId', async (req, res, next) => {
    try {
        const { newsId } = req.params;
        const {
            page = 1,
            pageSize = 10,
            includeDeleted = false
        } = req.query;
        
        // 检查新闻是否存在
        const news = await News.findById(newsId);
        if (!news) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 获取评论列表
        const result = await Comment.getCommentsByNewsId(newsId, {
            page: Number(page),
            pageSize: Number(pageSize),
            includeDeleted: includeDeleted === 'true'
        });
        
        return res.json(paginatedResponse(
            result.comments,
            result.total,
            result.page,
            result.pageSize,
            result.pageCount,
            'Comment list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * Submit comment
 */
router.post('/', authenticate, [
    body('newsId').notEmpty().withMessage('News ID cannot be empty'),
    body('content').notEmpty().withMessage('Comment content cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { newsId, content, images = [] } = req.body;
        const userId = req.user._id;
        
        // 检查新闻是否存在
        const news = await News.findById(newsId);
        if (!news) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 创建评论
        const newComment = new Comment({
            userId,
            newsId,
            content,
            images
        });
        
        await newComment.save();
        
        // 获取完整的评论信息
        const savedComment = await Comment.findById(newComment._id).populate('userId', 'firstName lastName email');
        
        // 格式化响应数据
        const formattedComment = {
            ...savedComment.toObject(),
            userName: `${req.user.firstName} ${req.user.lastName}`,
            userId: savedComment.userId?._id || savedComment.userId
        };
        
        return res.status(201).json(successResponse(formattedComment, 'Comment submitted successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Delete comment (user can only delete their own comments, admin can delete all comments)
 */
router.delete('/:commentId', authenticate, async (req, res, next) => {
    try {
        const { commentId } = req.params;
        
        // 查找评论
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, 'Comment not found'));
        }
        
        // 检查权限：只有评论作者或管理员可以删除评论
        if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'Administrator') {
            return res.status(403).json(errorResponse(403, 'Insufficient permissions, you can only delete your own comments'));
        }
        
        // 检查评论是否已经被删除
        if (comment.isDeleted) {
            return res.status(400).json(errorResponse(400, 'This comment has already been deleted'));
        }
        
        // 标记评论为已删除
        const deletedComment = await comment.deleteComment(req.user._id);
        
        return res.json(successResponse(deletedComment, 'Comment deleted successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Update comment (user can only update their own comments)
 */
router.put('/:commentId', authenticate, [
    body('content').notEmpty().withMessage('Comment content cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { commentId } = req.params;
        const { content, images = [] } = req.body;
        
        // 查找评论
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, 'Comment not found'));
        }
        
        // 检查权限：只有评论作者可以更新评论
        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json(errorResponse(403, 'Insufficient permissions, you can only update your own comments'));
        }
        
        // 检查评论是否已经被删除
        if (comment.isDeleted) {
            return res.status(400).json(errorResponse(400, 'Deleted comments cannot be updated'));
        }
        
        // 更新评论
        comment.content = content;
        comment.images = images;
        comment.updatedAt = Date.now();
        
        await comment.save();
        
        // 获取更新后的评论信息
        const updatedComment = await Comment.findById(comment._id).populate('userId', 'firstName lastName email');
        
        // 格式化响应数据
        const formattedComment = {
            ...updatedComment.toObject(),
            userName: `${req.user.firstName} ${req.user.lastName}`,
            userId: updatedComment.userId?._id || updatedComment.userId
        };
        
        return res.json(successResponse(formattedComment, 'Comment updated successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Get comment details
 */
router.get('/:commentId', async (req, res, next) => {
    try {
        const { commentId } = req.params;
        
        // 查找评论
        const comment = await Comment.findById(commentId)
            .populate('userId', 'firstName lastName email')
            .populate('deletedBy', 'firstName lastName');
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, 'Comment not found'));
        }
        
        // 格式化响应数据
        const formattedComment = {
            ...comment.toObject(),
            userName: comment.userId ? `${comment.userId.firstName} ${comment.userId.lastName}` : 'Unknown User',
            deletedByUserName: comment.deletedBy ? `${comment.deletedBy.firstName} ${comment.deletedBy.lastName}` : null,
            userId: comment.userId?._id || comment.userId,
            deletedBy: comment.deletedBy?._id || comment.deletedBy
        };
        
        return res.json(successResponse(formattedComment, 'Comment details retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Get all comments (with filtering)
 */
router.get('/', authenticate, isAdmin, async (req, res, next) => {
    try {
        const {
            page = 1,
            pageSize = 20,
            includeDeleted = false,
            userId = '',
            newsId = ''
        } = req.query;
        
        // 构建查询条件
        const query = {};
        
        // 用户ID筛选
        if (userId) {
            query.userId = userId;
        }
        
        // 新闻ID筛选
        if (newsId) {
            query.newsId = newsId;
        }
        
        // 是否包含已删除评论
        if (!includeDeleted) {
            query.isDeleted = false;
        }
        
        // 计算总数
        const total = await Comment.countDocuments(query);
        
        // 计算分页参数
        const skip = (page - 1) * pageSize;
        const pageCount = Math.ceil(total / pageSize);
        
        // 查询数据
        const comments = await Comment.find(query)
            .populate('userId', 'firstName lastName email')
            .populate('newsId', 'title')
            .populate('deletedBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(pageSize));
        
        return res.json(paginatedResponse(
            comments,
            total,
            Number(page),
            Number(pageSize),
            pageCount,
            'Comment list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * Get current user's comments list
 */
router.get('/user/my-comments', authenticate, async (req, res, next) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            includeDeleted = false
        } = req.query;
        
        // 获取用户评论列表
        const result = await Comment.getCommentsByUserId(req.user._id, {
            page: Number(page),
            pageSize: Number(pageSize),
            includeDeleted: includeDeleted === 'true'
        });
        
        return res.json(paginatedResponse(
            result.comments,
            result.total,
            result.page,
            result.pageSize,
            result.pageCount,
            'My comments list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

module.exports = router;