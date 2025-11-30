const express = require('express');
const { body, validationResult } = require('express-validator');
const { News, NEWS_STATUS } = require('../models/News');
const { Vote } = require('../models/Vote');
const { authenticate, authorize, isAdmin, isMemberOrAdmin, checkOwnership } = require('../middlewares/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * Get news list (supports pagination, filtering, searching)
 */
router.get('/', async (req, res, next) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            status = 'all',
            search = '',
            authorId = ''
        } = req.query;
        
        // 构建筛选条件
        const filters = {
            status: status !== 'all' ? status : undefined,
            search: search.trim(),
            authorId: authorId.trim() || undefined
        };
        
        // 构建选项
        const options = {
            page: Number(page),
            pageSize: Number(pageSize),
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // 获取新闻列表
        const result = await News.getNewsList(filters, options);
        
        // 添加用户投票信息（如果已登录）
        if (req.user) {
            // 获取当前页新闻的ID列表
            const newsIds = result.news.map(item => item._id);
            
            // 查询用户对这些新闻的投票
            const userVotes = await Vote.find({
                userId: req.user._id,
                newsId: { $in: newsIds }
            });
            
            // 创建投票映射
            const voteMap = {};
            userVotes.forEach(vote => {
                voteMap[vote.newsId.toString()] = vote.voteResult;
            });
            
            // 将用户投票信息添加到每条新闻
            result.news = result.news.map(news => ({
                ...news,
                userVote: voteMap[news._id.toString()] || null
            }));
        }
        
        return res.json(paginatedResponse(
            result.news,
            result.total,
            result.page,
            result.pageSize,
            result.pageCount,
            'News list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * Get news details
 */
router.get('/:newsId', async (req, res, next) => {
    try {
        const { newsId } = req.params;
        
        // 查找新闻
        const news = await News.findById(newsId).populate('authorId', 'firstName lastName email');
        
        if (!news) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...news.toObject(),
            authorName: news.authorId ? `${news.authorId.firstName} ${news.authorId.lastName}` : 'Unknown User',
            authorId: news.authorId?._id || news.authorId,
            userVote: null
        };
        
        // 如果用户已登录，获取用户投票信息
        if (req.user) {
            const userVote = await Vote.findOne({
                userId: req.user._id,
                newsId
            });
            
            formattedNews.userVote = userVote?.voteResult || null;
        }
        
        return res.json(successResponse(formattedNews, 'News details retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Member: Submit news
 */
router.post('/', authenticate, isMemberOrAdmin, [
    body('title').notEmpty().withMessage('News title cannot be empty'),
    body('content').notEmpty().withMessage('News content cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { title, content, images = [] } = req.body;
        
        // 创建新闻
        const newNews = new News({
            title,
            content,
            authorId: req.user._id,
            images,
            status: NEWS_STATUS.PENDING
        });
        
        await newNews.save();
        
        // 获取完整的新闻信息
        const savedNews = await News.findById(newNews._id).populate('authorId', 'firstName lastName email');
        
        // 格式化响应数据
        const formattedNews = {
            ...savedNews.toObject(),
            authorName: `${req.user.firstName} ${req.user.lastName}`
        };
        
        return res.status(201).json(successResponse(formattedNews, 'News submitted successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Author or Admin: Update news
 */
router.put('/:newsId', authenticate, checkOwnership('News', 'newsId', News), [
    body('title').optional().notEmpty().withMessage('News title cannot be empty'),
    body('content').optional().notEmpty().withMessage('News content cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { newsId } = req.params;
        
        // 提取可更新字段
        const updateData = {};
        if (req.body.title !== undefined) updateData.title = req.body.title;
        if (req.body.content !== undefined) updateData.content = req.body.content;
        if (req.body.images !== undefined) updateData.images = req.body.images;
        
        // 更新新闻
        const updatedNews = await News.findByIdAndUpdate(
            newsId,
            updateData,
            { new: true, runValidators: true }
        ).populate('authorId', 'firstName lastName email');
        
        if (!updatedNews) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...updatedNews.toObject(),
            authorName: updatedNews.authorId ? `${updatedNews.authorId.firstName} ${updatedNews.authorId.lastName}` : 'Unknown User',
            authorId: updatedNews.authorId?._id || updatedNews.authorId
        };
        
        return res.json(successResponse(formattedNews, 'News updated successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Delete news
 */
router.delete('/:newsId', authenticate, isAdmin, async (req, res, next) => {
    try {
        const { newsId } = req.params;
        
        // 查找并删除新闻
        const deletedNews = await News.findByIdAndDelete(newsId);
        
        if (!deletedNews) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 此处可以添加级联删除逻辑，如删除相关投票和评论
        
        return res.json(successResponse(null, 'News deleted successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Manually set news status
 */
router.put('/:newsId/status', authenticate, isAdmin, [
    body('status').isIn(Object.values(NEWS_STATUS)).withMessage('Invalid news status')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { newsId } = req.params;
        const { status } = req.body;
        
        // 更新新闻状态
        const updatedNews = await News.findByIdAndUpdate(
            newsId,
            { status },
            { new: true, runValidators: true }
        ).populate('authorId', 'firstName lastName email');
        
        if (!updatedNews) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...updatedNews.toObject(),
            authorName: updatedNews.authorId ? `${updatedNews.authorId.firstName} ${updatedNews.authorId.lastName}` : 'Unknown User',
            authorId: updatedNews.authorId?._id || updatedNews.authorId
        };
        
        return res.json(successResponse(formattedNews, `News status updated to ${status}`));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Recalculate news votes and update status
 */
router.post('/:newsId/recalculate-votes', authenticate, isAdmin, async (req, res, next) => {
    try {
        const { newsId } = req.params;
        const { minVotes = 10, fakeThreshold = 0.6 } = req.body;
        
        // 重新计算投票并更新状态
        const result = await Vote.recalculateNewsVotes(newsId, { minVotes, fakeThreshold });
        
        if (!result.success) {
            return res.status(400).json(errorResponse(400, result.error));
        }
        
        // 获取更新后的新闻
        const updatedNews = await News.findById(newsId);
        
        return res.json(successResponse({
            newsId,
            voteStats: result.voteStats,
            newStatus: result.newStatus,
            news: updatedNews
        }, 'Vote recalculation completed'));
    } catch (error) {
        next(error);
    }
});

/**
 * Get current user's news list
 */
router.get('/my-news', authenticate, async (req, res, next) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            status = 'all'
        } = req.query;
        
        // 构建筛选条件
        const filters = {
            authorId: req.user._id,
            status: status !== 'all' ? status : undefined
        };
        
        // 构建选项
        const options = {
            page: Number(page),
            pageSize: Number(pageSize),
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // 获取新闻列表
        const result = await News.getNewsList(filters, options);
        
        return res.json(paginatedResponse(
            result.news,
            result.total,
            result.page,
            result.pageSize,
            result.pageCount,
            'My news list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

module.exports = router;