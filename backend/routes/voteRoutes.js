const express = require('express');
const { body, validationResult } = require('express-validator');
const { Vote, VOTE_RESULTS } = require('../models/Vote');
const { News } = require('../models/News');
const { authenticate } = require('../middlewares/auth');
const { successResponse, errorResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * Submit vote
 */
router.post('/', authenticate, [
    body('newsId').notEmpty().withMessage('News ID cannot be empty'),
    body('voteResult').isIn(Object.values(VOTE_RESULTS)).withMessage('Invalid vote result')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { newsId, voteResult } = req.body;
        const userId = req.user._id;
        
        // Check if news exists
        const news = await News.findById(newsId);
        if (!news) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 检查用户是否已经投过票
        const existingVote = await Vote.hasUserVoted(userId, newsId);
        if (existingVote) {
            return res.status(400).json(errorResponse(400, 'You have already voted for this news'));
        }
        
        // 创建新投票
        const newVote = new Vote({
            userId,
            newsId,
            voteResult
        });
        
        await newVote.save();
        
        // 更新新闻投票计数
        const voteStats = await Vote.getNewsVoteStats(newsId);
        news.updateVoteCounts(voteStats.fakeCount, voteStats.notFakeCount);
        
        // 根据投票结果更新新闻状态
        news.updateStatusBasedOnVotes();
        
        await news.save();
        
        // 返回更新后的投票统计和新闻状态
        return res.status(201).json(successResponse({
            vote: newVote,
            voteStats: {
                fakeCount: news.fakeVoteCount,
                notFakeVoteCount: news.notFakeVoteCount,
                totalCount: news.getTotalVotes(),
                fakePercentage: news.getFakeVotePercentage().toFixed(1) + '%'
            },
            newsStatus: news.status
        }, 'Vote submitted successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Get user's vote for specific news
 */
router.get('/user/:newsId', authenticate, async (req, res, next) => {
    try {
        const { newsId } = req.params;
        const userId = req.user._id;
        
        // 获取用户投票
        const vote = await Vote.findOne({
            userId,
            newsId
        });
        
        if (!vote) {
            return res.json(successResponse(null, 'User has not voted yet'));
        }
        
        return res.json(successResponse(vote, 'Vote retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Get news vote statistics
 */
router.get('/news/:newsId/stats', async (req, res, next) => {
    try {
        const { newsId } = req.params;
        
        // 检查新闻是否存在
        const news = await News.findById(newsId);
        if (!news) {
            return res.status(404).json(errorResponse(404, 'News not found'));
        }
        
        // 获取投票统计
        const voteStats = await Vote.getNewsVoteStats(newsId);
        
        return res.json(successResponse({
            newsId,
            fakeCount: voteStats.fakeCount,
            notFakeCount: voteStats.notFakeCount,
            totalCount: voteStats.totalCount,
            fakePercentage: voteStats.totalCount > 0 
                ? ((voteStats.fakeCount / voteStats.totalCount) * 100).toFixed(1) + '%'
                : '0%',
            notFakePercentage: voteStats.totalCount > 0
                ? ((voteStats.notFakeCount / voteStats.totalCount) * 100).toFixed(1) + '%'
                : '0%',
            newsStatus: news.status
        }, 'Vote statistics retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Get all vote records for news
 */
router.get('/news/:newsId', authenticate, (req, res, next) => {
    // 检查用户是否为管理员
    if (req.user.role !== 'Administrator') {
        return res.status(403).json(errorResponse(403, 'Insufficient permissions, administrator role required'));
    }
    
    const { newsId } = req.params;
    const { page = 1, pageSize = 50, includeInvalid = false } = req.query;
    
    Vote.find({
        newsId,
        ...(!includeInvalid && { isInvalid: false })
    })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(Number(pageSize))
    .then(votes => {
        return Vote.countDocuments({
            newsId,
            ...(!includeInvalid && { isInvalid: false })
        }).then(total => {
            return res.json(successResponse({
                votes,
                pagination: {
                    total,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    pageCount: Math.ceil(total / pageSize)
                }
            }, 'Vote records retrieved successfully'));
        });
    })
    .catch(error => next(error));
});

/**
 * Admin: Mark vote as invalid
 */
router.put('/:voteId/invalidate', authenticate, (req, res, next) => {
    // 检查用户是否为管理员
    if (req.user.role !== 'Administrator') {
        return res.status(403).json(errorResponse(403, 'Insufficient permissions, administrator role required'));
    }
    
    const { voteId } = req.params;
    
    // 标记投票为无效
    Vote.invalidateVote(voteId)
        .then(invalidatedVote => {
            if (!invalidatedVote) {
                return res.status(404).json(errorResponse(404, 'Vote record not found'));
            }
            
            // 重新计算新闻投票
            return Vote.recalculateNewsVotes(invalidatedVote.newsId)
                .then(recalcResult => {
                    return res.json(successResponse({
                        vote: invalidatedVote,
                        recalculation: recalcResult
                    }, 'Vote marked as invalid'));
                });
        })
        .catch(error => next(error));
});

/**
 * Get user vote history
 */
router.get('/user-history', authenticate, async (req, res, next) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const userId = req.user._id;
        
        // 计算总数
        const total = await Vote.countDocuments({ userId });
        
        // 计算分页参数
        const skip = (page - 1) * pageSize;
        const pageCount = Math.ceil(total / pageSize);
        
        // 获取用户投票历史
        const votes = await Vote.find({ userId })
            .populate('newsId', 'title status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(pageSize));
        
        return res.json({
            success: true,
            message: 'Vote history retrieved successfully',
            data: {
                votes,
                pagination: {
                    total,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    pageCount
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;