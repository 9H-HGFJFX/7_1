const mongoose = require('mongoose');

// News status enumeration
const NEWS_STATUS = {
    FAKE: 'Fake',
    NOT_FAKE: 'Not Fake',
    PENDING: 'Pending'
};

// News model Schema
const newsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'News title cannot be empty'],
        trim: true,
        minlength: [5, 'News title must be at least 5 characters'],
        maxlength: [200, 'News title cannot exceed 200 characters']
    },
    content: {
        type: String,
        required: [true, 'News content cannot be empty'],
        trim: true,
        minlength: [10, 'News content must be at least 10 characters']
    },
    status: {
        type: String,
        enum: Object.values(NEWS_STATUS),
        default: NEWS_STATUS.PENDING
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Author ID cannot be empty']
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

// Update time middleware
newsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Get total votes method
newsSchema.methods.getTotalVotes = function() {
    return this.fakeVoteCount + this.notFakeVoteCount;
};

// Get fake vote percentage method
newsSchema.methods.getFakeVotePercentage = function() {
    const totalVotes = this.getTotalVotes();
    return totalVotes > 0 ? (this.fakeVoteCount / totalVotes) * 100 : 0;
};

// Update vote counts method
newsSchema.methods.updateVoteCounts = function(fakeCount, notFakeCount) {
    this.fakeVoteCount = fakeCount;
    this.notFakeVoteCount = notFakeCount;
};

// Update news status based on votes method
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

// Static method: Get news list (supports pagination, filtering, searching)
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
            authorName: item.authorId ? `${item.authorId.firstName} ${item.authorId.lastName}` : 'Unknown User',
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

// Create news model
const News = mongoose.model('News', newsSchema);

// Export model and constants
module.exports = {
    News,
    NEWS_STATUS
};