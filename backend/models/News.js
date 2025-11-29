const mongoose = require('mongoose');

// 新闻状态枚举
const NEWS_STATUS = {
    FAKE: 'Fake',
    NOT_FAKE: 'Not Fake',
    PENDING: 'Pending'
};

// 新闻模型Schema
const newsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, '新闻主题不能为空'],
        trim: true,
        minlength: [5, '新闻主题至少需要5个字符'],
        maxlength: [200, '新闻主题不能超过200个字符']
    },
    content: {
        type: String,
        required: [true, '新闻详情不能为空'],
        trim: true,
        minlength: [10, '新闻详情至少需要10个字符']
    },
    status: {
        type: String,
        enum: Object.values(NEWS_STATUS),
        default: NEWS_STATUS.PENDING
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, '提交人ID不能为空']
    },
    images: [{
        type: String,
        trim: true
    }],
    fakeVoteCount: {
        type: Number,
        default: 0,
        min: 0
    },
    notFakeVoteCount: {
        type: Number,
        default: 0,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 更新时间中间件
newsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 计算总投票数方法
newsSchema.methods.getTotalVotes = function() {
    return this.fakeVoteCount + this.notFakeVoteCount;
};

// 计算假新闻投票百分比方法
newsSchema.methods.getFakeVotePercentage = function() {
    const totalVotes = this.getTotalVotes();
    return totalVotes > 0 ? (this.fakeVoteCount / totalVotes) * 100 : 0;
};

// 更新投票计数方法
newsSchema.methods.updateVoteCounts = function(fakeCount, notFakeCount) {
    this.fakeVoteCount = fakeCount;
    this.notFakeVoteCount = notFakeCount;
};

// 根据投票结果更新新闻状态方法
newsSchema.methods.updateStatusBasedOnVotes = function(minVotes = 10, fakeThreshold = 0.6) {
    const totalVotes = this.getTotalVotes();
    
    // 如果投票数达到阈值，根据比例判断新闻真假
    if (totalVotes >= minVotes) {
        const fakePercentage = this.getFakeVotePercentage();
        
        if (fakePercentage >= fakeThreshold * 100) {
            this.status = NEWS_STATUS.FAKE;
        } else {
            this.status = NEWS_STATUS.NOT_FAKE;
        }
    } else {
        this.status = NEWS_STATUS.PENDING;
    }
    
    return this.status;
};

// 静态方法：获取新闻列表（支持分页、筛选、搜索）
newsSchema.statics.getNewsList = async function(filters = {}, options = {}) {
    const {
        page = 1,
        pageSize = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = options;
    
    // 构建查询条件
    const query = {};
    
    // 状态筛选
    if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
    }
    
    // 提交人筛选
    if (filters.authorId) {
        query.authorId = filters.authorId;
    }
    
    // 搜索功能
    if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
            { title: searchRegex },
            { content: searchRegex }
        ];
    }
    
    // 计算总数
    const total = await this.countDocuments(query);
    
    // 计算分页参数
    const skip = (page - 1) * pageSize;
    const pageCount = Math.ceil(total / pageSize);
    
    // 构建排序对象
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // 查询数据
    const news = await this.find(query)
        .populate('authorId', 'firstName lastName email')
        .sort(sortObject)
        .skip(skip)
        .limit(pageSize)
        .lean();
    
    // 格式化返回数据
    const formattedNews = news.map(item => {
        return {
            ...item,
            authorName: item.authorId ? `${item.authorId.firstName} ${item.authorId.lastName}` : '未知用户',
            authorId: item.authorId?._id || item.authorId
        };
    });
    
    return {
        news: formattedNews,
        total,
        page,
        pageSize,
        pageCount
    };
};

// 创建新闻模型
const News = mongoose.model('News', newsSchema);

// 导出模型和常量
module.exports = {
    News,
    NEWS_STATUS
};