const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const { News } = require('../models/News');
const { authenticate, authorize, isAdmin } = require('../middlewares/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * 获取新闻评论列表
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
            return res.status(404).json(errorResponse(404, '新闻不存在'));
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
            '获取评论列表成功'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * 提交评论
 */
router.post('/', authenticate, [
    body('newsId').notEmpty().withMessage('新闻ID不能为空'),
    body('content').notEmpty().withMessage('评论内容不能为空')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, '验证失败', errors.mapped()));
        }
        
        const { newsId, content, images = [] } = req.body;
        const userId = req.user._id;
        
        // 检查新闻是否存在
        const news = await News.findById(newsId);
        if (!news) {
            return res.status(404).json(errorResponse(404, '新闻不存在'));
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
        
        return res.status(201).json(successResponse(formattedComment, '评论提交成功'));
    } catch (error) {
        next(error);
    }
});

/**
 * 删除评论（用户只能删除自己的评论，管理员可以删除所有评论）
 */
router.delete('/:commentId', authenticate, async (req, res, next) => {
    try {
        const { commentId } = req.params;
        
        // 查找评论
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, '评论不存在'));
        }
        
        // 检查权限：只有评论作者或管理员可以删除评论
        if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'Administrator') {
            return res.status(403).json(errorResponse(403, '权限不足，您只能删除自己的评论'));
        }
        
        // 检查评论是否已经被删除
        if (comment.isDeleted) {
            return res.status(400).json(errorResponse(400, '该评论已被删除'));
        }
        
        // 标记评论为已删除
        const deletedComment = await comment.deleteComment(req.user._id);
        
        return res.json(successResponse(deletedComment, '评论删除成功'));
    } catch (error) {
        next(error);
    }
});

/**
 * 更新评论（用户只能更新自己的评论）
 */
router.put('/:commentId', authenticate, [
    body('content').notEmpty().withMessage('评论内容不能为空')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, '验证失败', errors.mapped()));
        }
        
        const { commentId } = req.params;
        const { content, images = [] } = req.body;
        
        // 查找评论
        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, '评论不存在'));
        }
        
        // 检查权限：只有评论作者可以更新评论
        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json(errorResponse(403, '权限不足，您只能更新自己的评论'));
        }
        
        // 检查评论是否已经被删除
        if (comment.isDeleted) {
            return res.status(400).json(errorResponse(400, '已删除的评论不能更新'));
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
        
        return res.json(successResponse(formattedComment, '评论更新成功'));
    } catch (error) {
        next(error);
    }
});

/**
 * 获取评论详情
 */
router.get('/:commentId', async (req, res, next) => {
    try {
        const { commentId } = req.params;
        
        // 查找评论
        const comment = await Comment.findById(commentId)
            .populate('userId', 'firstName lastName email')
            .populate('deletedBy', 'firstName lastName');
        
        if (!comment) {
            return res.status(404).json(errorResponse(404, '评论不存在'));
        }
        
        // 格式化响应数据
        const formattedComment = {
            ...comment.toObject(),
            userName: comment.userId ? `${comment.userId.firstName} ${comment.userId.lastName}` : '未知用户',
            deletedByUserName: comment.deletedBy ? `${comment.deletedBy.firstName} ${comment.deletedBy.lastName}` : null,
            userId: comment.userId?._id || comment.userId,
            deletedBy: comment.deletedBy?._id || comment.deletedBy
        };
        
        return res.json(successResponse(formattedComment, '获取评论详情成功'));
    } catch (error) {
        next(error);
    }
});

/**
 * 管理员：获取所有评论（带筛选功能）
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
            '获取评论列表成功'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * 获取当前用户的评论列表
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
            '获取我的评论列表成功'
        ));
    } catch (error) {
        next(error);
    }
});

module.exports = router;