const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Role Enums
const ROLES = {
    READER: 'Reader',
    MEMBER: 'Member',
    ADMINISTRATOR: 'Administrator'
};

// User Model Schema
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name cannot be empty'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters'],
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name cannot be empty'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters'],
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email cannot be empty'],
        trim: true,
        lowercase: true,
        unique: [true, 'This email is already registered'],
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password cannot be empty'],
        minlength: [6, 'Password must be at least 6 characters'],
        // 不返回密码到客户端
        select: false
    },
    avatar: {
        type: String,
        default: null // Default avatar URL, can be null
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

// Password encryption middleware
userSchema.pre('save', async function(next) {
    // Only re-encrypt when password is modified
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // Generate salt and encrypt password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update time middleware
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Validate password method
userSchema.methods.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// Get full name method
userSchema.methods.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
};

// Check user role method
userSchema.methods.hasRole = function(role) {
    const roleHierarchy = {
        [ROLES.READER]: 1,
        [ROLES.MEMBER]: 2,
        [ROLES.ADMINISTRATOR]: 3
    };
    
    return roleHierarchy[this.role] >= roleHierarchy[role];
};

// Create user model
const User = mongoose.model('User', userSchema);

// Export model and constants
module.exports = {
    User,
    ROLES
};