const mongoose = require('mongoose');

// Vote result enumeration
const VOTE_RESULTS = {
    FAKE: 'Fake',
    NOT_FAKE: 'Not Fake'
};

// Vote model Schema
const voteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID cannot be empty']
    },
    newsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'News',
        required: [true, 'News ID cannot be empty']
    },
    voteResult: {
        type: String,
        enum: Object.values(VOTE_RESULTS),
        required: [true, 'Vote result cannot be empty']
    },
    isInvalid: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create unique index to ensure a user can vote only once per news item
voteSchema.index({ userId: 1, newsId: 1 }, { unique: true });

// Static method to check if user has voted
voteSchema.statics.hasUserVoted = async function(userId, newsId) {
    const vote = await this.findOne({
        userId,
        newsId
    });
    return !!vote;
};

// Static method to get user vote record
voteSchema.statics.getUserVote = async function(userId, newsId) {
    return await this.findOne({
        userId,
        newsId
    });
};

// Static method to get news vote statistics
voteSchema.statics.getNewsVoteStats = async function(newsId) {
    const votes = await this.find({
        newsId,
        isInvalid: false
    });
    
    let fakeCount = 0;
    let notFakeCount = 0;
    
    votes.forEach(vote => {
        if (vote.voteResult === VOTE_RESULTS.FAKE) {
            fakeCount++;
        } else if (vote.voteResult === VOTE_RESULTS.NOT_FAKE) {
            notFakeCount++;
        }
    });
    
    return {
        fakeCount,
        notFakeCount,
        totalCount: fakeCount + notFakeCount
    };
};

// Static method to invalidate a vote
voteSchema.statics.invalidateVote = async function(voteId) {
    return await this.findByIdAndUpdate(voteId, {
        isInvalid: true
    }, { new: true });
};

// Static method to recalculate news votes and update news status
voteSchema.statics.recalculateNewsVotes = async function(newsId, options = {}) {
    const { minVotes = 10, fakeThreshold = 0.6 } = options;
    
    try {
        // 导入News模型（避免循环依赖）
        const { News } = require('./News');
        
        // 获取投票统计
        const voteStats = await this.getNewsVoteStats(newsId);
        
        // 更新新闻的投票计数
        const news = await News.findById(newsId);
        if (!news) {
            throw new Error('News not found');
        }
        
        news.updateVoteCounts(voteStats.fakeCount, voteStats.notFakeCount);
        
        // 根据投票结果更新状态
        const newStatus = news.updateStatusBasedOnVotes(minVotes, fakeThreshold);
        
        // 保存新闻
        await news.save();
        
        return {
            success: true,
            newsId,
            voteStats,
            newStatus
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Create vote model
const Vote = mongoose.model('Vote', voteSchema);

// Export model and constants
module.exports = {
    Vote,
    VOTE_RESULTS
};