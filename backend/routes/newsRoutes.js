const express = require('express');
const { body, validationResult } = require('express-validator');
const { News, NEWS_STATUS } = require('../models/News');
const { Vote } = require('../models/Vote');
const { authenticate, authorize, isAdmin, isMemberOrAdmin, checkOwnership } = require('../middlewares/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * Get news list (supports pagination, filtering, and searching)
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
        
        // Build filter conditions
        const filters = {
            status: status !== 'all' ? status : undefined,
            search: search.trim(),
            authorId: authorId.trim() || undefined
        };
        
        // Build options
        const options = {
            page: Number(page),
            pageSize: Number(pageSize),
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // Get news list
        const result = await News.getNewsList(filters, options);
        
        // Add user vote information (if logged in)
        if (req.user) {
            // Get IDs of news items on the current page
            const newsIds = result.news.map(item => item._id);
            
            // Query user votes for these news items
            const userVotes = await Vote.find({
                userId: req.user._id,
                newsId: { $in: newsIds }
            });
            
            // Create vote mapping
            const voteMap = {};
            userVotes.forEach(vote => {
                voteMap[vote.newsId.toString()] = vote.voteResult;
            });
            
            // Add user vote information to each news item
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
            return res.status(404).json(errorResponse(404, 'News does not exist'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...news.toObject(),
            authorName: news.authorId ? `${news.authorId.firstName} ${news.authorId.lastName}` : '未知用户',
            authorId: news.authorId?._id || news.authorId,
            userVote: null
        };
        
        // If user is logged in, get user vote information
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
        
        // Create news
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
 * Author or admin: Update news
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
        
        // Extract updatable fields
        const updateData = {};
        if (req.body.title !== undefined) updateData.title = req.body.title;
        if (req.body.content !== undefined) updateData.content = req.body.content;
        if (req.body.images !== undefined) updateData.images = req.body.images;
        
        // Update news
        const updatedNews = await News.findByIdAndUpdate(
            newsId,
            updateData,
            { new: true, runValidators: true }
        ).populate('authorId', 'firstName lastName email');
        
        if (!updatedNews) {
            return res.status(404).json(errorResponse(404, 'News does not exist'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...updatedNews.toObject(),
            authorName: updatedNews.authorId ? `${updatedNews.authorId.firstName} ${updatedNews.authorId.lastName}` : '未知用户',
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
        
        // Find and delete news
        const deletedNews = await News.findByIdAndDelete(newsId);
        
        if (!deletedNews) {
            return res.status(404).json(errorResponse(404, 'News does not exist'));
        }
        
        // Cascade delete logic can be added here, such as deleting related votes and comments
        
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
        
        // Update news status
        const updatedNews = await News.findByIdAndUpdate(
            newsId,
            { status },
            { new: true, runValidators: true }
        ).populate('authorId', 'firstName lastName email');
        
        if (!updatedNews) {
            return res.status(404).json(errorResponse(404, 'News does not exist'));
        }
        
        // 格式化响应数据
        const formattedNews = {
            ...updatedNews.toObject(),
            authorName: updatedNews.authorId ? `${updatedNews.authorId.firstName} ${updatedNews.authorId.lastName}` : '未知用户',
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
        
        // Recalculate votes and update status
        const result = await Vote.recalculateNewsVotes(newsId, { minVotes, fakeThreshold });
        
        if (!result.success) {
            return res.status(400).json(errorResponse(400, result.error));
        }
        
        // Get updated news
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
        
        // Build filter conditions
        const filters = {
            authorId: req.user._id,
            status: status !== 'all' ? status : undefined
        };
        
        // Build options
        const options = {
            page: Number(page),
            pageSize: Number(pageSize),
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        
        // Get news list
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