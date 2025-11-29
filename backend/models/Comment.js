const mongoose = require('mongoose');

// 评论模型Schema
const commentSchema = new mongoose.Schema({
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
    content: {
        type: String,
        required: [true, '评论内容不能为空'],
        trim: true,
        minlength: [1, '评论内容至少需要1个字符'],
        maxlength: [1000, '评论内容不能超过1000个字符']
    },
    images: [{
        type: String,
        trim: true
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deletedAt: {
        type: Date,
        default: null
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
commentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 删除评论的实例方法
commentSchema.methods.deleteComment = function(deletedByUserId) {
    this.isDeleted = true;
    this.deletedBy = deletedByUserId;
    this.deletedAt = Date.now();
    return this.save();
};

// 静态方法：获取新闻评论列表（支持分页）
commentSchema.statics.getCommentsByNewsId = async function(newsId, options = {}) {
    const {
        page = 1,
        pageSize = 10,
        includeDeleted = false
    } = options;
    
    // 构建查询条件
    const query = {
        newsId
    };
    
    // 控制是否包含已删除评论
    if (!includeDeleted) {
        query.isDeleted = false;
    }
    
    // 计算总数
    const total = await this.countDocuments(query);
    
    // 计算分页参数
    const skip = (page - 1) * pageSize;
    const pageCount = Math.ceil(total / pageSize);
    
    // 查询数据
    const comments = await this.find(query)
        .populate('userId', 'firstName lastName email avatar')
        .populate('deletedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();
    
    // 格式化返回数据
    const formattedComments = comments.map(comment => {
        return {
            ...comment,
            userName: comment.userId ? `${comment.userId.firstName} ${comment.userId.lastName}` : '未知用户',
            deletedByUserName: comment.deletedBy ? `${comment.deletedBy.firstName} ${comment.deletedBy.lastName}` : null,
            userId: comment.userId?._id || comment.userId,
            deletedBy: comment.deletedBy?._id || comment.deletedBy
        };
    });
    
    return {
        comments: formattedComments,
        total,
        page,
        pageSize,
        pageCount
    };
};

// 静态方法：获取用户的评论列表
commentSchema.statics.getCommentsByUserId = async function(userId, options = {}) {
    const {
        page = 1,
        pageSize = 10,
        includeDeleted = false
    } = options;
    
    // 构建查询条件
    const query = {
        userId
    };
    
    // 控制是否包含已删除评论
    if (!includeDeleted) {
        query.isDeleted = false;
    }
    
    // 计算总数
    const total = await this.countDocuments(query);
    
    // 计算分页参数
    const skip = (page - 1) * pageSize;
    const pageCount = Math.ceil(total / pageSize);
    
    // 查询数据
    const comments = await this.find(query)
        .populate('newsId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();
    
    return {
        comments,
        total,
        page,
        pageSize,
        pageCount
    };
};

// 静态方法：删除用户的所有评论
commentSchema.statics.deleteUserComments = async function(userId) {
    return await this.updateMany(
        { userId, isDeleted: false },
        { isDeleted: true, deletedAt: Date.now() },
        { multi: true }
    );
};

// 静态方法：统计新闻有效评论数
commentSchema.statics.countActiveCommentsByNewsId = async function(newsId) {
    return await this.countDocuments({
        newsId,
        isDeleted: false
    });
};

// 创建评论模型
const Comment = mongoose.model('Comment', commentSchema);

// 导出模型
module.exports = Comment;