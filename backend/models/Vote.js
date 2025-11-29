const mongoose = require('mongoose');

// 投票结果枚举
const VOTE_RESULTS = {
    FAKE: 'Fake',
    NOT_FAKE: 'Not Fake'
};

// 投票模型Schema
const voteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, '用户ID不能为空']
    },
    newsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'News',
        required: [true, '新闻ID不能为空']
    },
    voteResult: {
        type: String,
        enum: Object.values(VOTE_RESULTS),
        required: [true, '投票结果不能为空']
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

// 创建唯一索引，确保一个用户对一篇新闻只能投一次票
voteSchema.index({ userId: 1, newsId: 1 }, { unique: true });

// 检查用户是否已经投过票的静态方法
voteSchema.statics.hasUserVoted = async function(userId, newsId) {
    const vote = await this.findOne({
        userId,
        newsId
    });
    return !!vote;
};

// 获取用户投票记录的静态方法
voteSchema.statics.getUserVote = async function(userId, newsId) {
    return await this.findOne({
        userId,
        newsId
    });
};

// 获取新闻有效投票统计的静态方法
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

// 将投票标记为无效的静态方法
voteSchema.statics.invalidateVote = async function(voteId) {
    return await this.findByIdAndUpdate(voteId, {
        isInvalid: true
    }, { new: true });
};

// 重新计算新闻投票并更新新闻状态的静态方法
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
            throw new Error('新闻不存在');
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

// 创建投票模型
const Vote = mongoose.model('Vote', voteSchema);

// 导出模型和常量
module.exports = {
    Vote,
    VOTE_RESULTS
};