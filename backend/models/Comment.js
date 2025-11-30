const mongoose = require('mongoose');

// Comment Model Schema
const commentSchema = new mongoose.Schema({
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
    content: {
        type: String,
        required: [true, 'Comment content cannot be empty'],
        trim: true,
        minlength: [1, 'Comment content must be at least 1 character'],
        maxlength: [1000, 'Comment content cannot exceed 1000 characters']
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

// Update time middleware
commentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Instance method to delete comment
commentSchema.methods.deleteComment = function(deletedByUserId) {
    this.isDeleted = true;
    this.deletedBy = deletedByUserId;
    this.deletedAt = Date.now();
    return this.save();
};

// Static method: Get comments by news ID (with pagination)
commentSchema.statics.getCommentsByNewsId = async function(newsId, options = {}) {
    const {
        page = 1,
        pageSize = 10,
        includeDeleted = false
    } = options;
    
    // Build query conditions
    const query = {
        newsId
    };
    
    // Control whether to include deleted comments
    if (!includeDeleted) {
        query.isDeleted = false;
    }
    
    // Calculate total count
    const total = await this.countDocuments(query);
    
    // Calculate pagination parameters
    const skip = (page - 1) * pageSize;
    const pageCount = Math.ceil(total / pageSize);
    
    // Query data
    const comments = await this.find(query)
        .populate('userId', 'firstName lastName email avatar')
        .populate('deletedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();
    
    // Format return data
    const formattedComments = comments.map(comment => {
        return {
            ...comment,
            userName: comment.userId ? `${comment.userId.firstName} ${comment.userId.lastName}` : 'Unknown User',
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

// Static method: Get comments by user ID
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

// Static method: Delete all comments by user ID
commentSchema.statics.deleteUserComments = async function(userId) {
    return await this.updateMany(
        { userId, isDeleted: false },
        { isDeleted: true, deletedAt: Date.now() },
        { multi: true }
    );
};

// Static method: Count active comments by news ID
commentSchema.statics.countActiveCommentsByNewsId = async function(newsId) {
    return await this.countDocuments({
        newsId,
        isDeleted: false
    });
};

// Create comment model
const Comment = mongoose.model('Comment', commentSchema);

// Export model
module.exports = Comment;