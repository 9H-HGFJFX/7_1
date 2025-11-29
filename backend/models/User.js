const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 用户角色枚举
const ROLES = {
    READER: 'Reader',
    MEMBER: 'Member',
    ADMINISTRATOR: 'Administrator'
};

// 用户模型Schema
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, '名字不能为空'],
        trim: true,
        minlength: [2, '名字至少需要2个字符'],
        maxlength: [50, '名字不能超过50个字符']
    },
    lastName: {
        type: String,
        required: [true, '姓氏不能为空'],
        trim: true,
        minlength: [2, '姓氏至少需要2个字符'],
        maxlength: [50, '姓氏不能超过50个字符']
    },
    email: {
        type: String,
        required: [true, '邮箱不能为空'],
        trim: true,
        lowercase: true,
        unique: [true, '该邮箱已被注册'],
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, '请输入有效的邮箱地址']
    },
    password: {
        type: String,
        required: [true, '密码不能为空'],
        minlength: [6, '密码至少需要6个字符'],
        // 不返回密码到客户端
        select: false
    },
    avatar: {
        type: String,
        default: null // 默认头像URL，可为null
    },
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.READER
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

// 密码加密中间件
userSchema.pre('save', async function(next) {
    // 只有当密码被修改时才重新加密
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // 生成盐并加密密码
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 更新时间中间件
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 验证密码方法
userSchema.methods.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// 获取完整用户名方法
userSchema.methods.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
};

// 检查用户角色方法
userSchema.methods.hasRole = function(role) {
    const roleHierarchy = {
        [ROLES.READER]: 1,
        [ROLES.MEMBER]: 2,
        [ROLES.ADMINISTRATOR]: 3
    };
    
    return roleHierarchy[this.role] >= roleHierarchy[role];
};

// 创建用户模型
const User = mongoose.model('User', userSchema);

// 导出模型和常量
module.exports = {
    User,
    ROLES
};