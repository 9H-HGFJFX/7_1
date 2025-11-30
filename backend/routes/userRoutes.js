const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, ROLES } = require('../models/User');
const { authenticate, authorize, generateToken, isAdmin } = require('../middlewares/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * User Registration
 */
router.post('/register', [
    // 验证请求数据
    body('firstName').notEmpty().withMessage('First name cannot be empty'),
    body('lastName').notEmpty().withMessage('Last name cannot be empty'),
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { firstName, lastName, email, password } = req.body;
        
        // 检查邮箱是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json(errorResponse(400, 'Email already registered', { email: 'This email already exists' }));
        }
        
        // 创建新用户（默认角色为Reader）
        const newUser = new User({
            firstName,
            lastName,
            email,
            password,
            role: ROLES.READER
        });
        
        await newUser.save();
        
        // 生成JWT令牌
        const token = generateToken(newUser);
        
        // 返回用户信息和令牌（不包含密码）
        return res.status(201).json(successResponse({
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                role: newUser.role,
                avatar: newUser.avatar,
                createdAt: newUser.createdAt
            },
            token
        }, 'Registration successful'));
    } catch (error) {
        next(error);
    }
});

/**
 * User Login
 */
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        const { email, password } = req.body;
        
        // 查找用户并包含密码字段
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            return res.status(401).json(errorResponse(401, 'Invalid email or password', { credentials: 'Authentication failed' }));
        }
        
        // 验证密码
        const isPasswordValid = await user.validatePassword(password);
        
        if (!isPasswordValid) {
            return res.status(401).json(errorResponse(401, '邮箱或密码错误', { credentials: '验证失败' }));
        }
        
        // 生成JWT令牌
        const token = generateToken(user);
        
        // 返回用户信息和令牌
        return res.json(successResponse({
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                createdAt: user.createdAt
            },
            token
        }, 'Login successful'));
    } catch (error) {
        next(error);
    }
});

/**
 * Get Current User Information
 */
router.get('/me', authenticate, async (req, res, next) => {
    try {
        return res.json(successResponse({
            id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email,
            role: req.user.role,
            avatar: req.user.avatar,
            createdAt: req.user.createdAt
        }, 'User information retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Update Current User Information
 */
router.put('/me', authenticate, [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, 'Validation failed', errors.mapped()));
        }
        
        // 提取可更新字段
        const updateData = {};
        if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName;
        if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName;
        if (req.body.avatar !== undefined) updateData.avatar = req.body.avatar;
        
        // 更新用户信息
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!updatedUser) {
            return res.status(404).json(errorResponse(404, 'User not found'));
        }
        
        return res.json(successResponse({
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role,
            avatar: updatedUser.avatar,
            createdAt: updatedUser.createdAt
        }, 'User information updated successfully'));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Get User List
 */
router.get('/', authenticate, isAdmin, async (req, res, next) => {
    try {
        const { page = 1, pageSize = 10, role, search } = req.query;
        
        // 构建查询条件
        const query = {};
        
        // Role filtering
        if (role && Object.values(ROLES).includes(role)) {
            query.role = role;
        }
        
        // Search functionality
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex }
            ];
        }
        
        // Calculate total count
        const total = await User.countDocuments(query);
        
        // Calculate pagination parameters
        const skip = (page - 1) * pageSize;
        const pageCount = Math.ceil(total / pageSize);
        
        // Query data
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .select('-password');
        
        return res.json(paginatedResponse(
            users,
            total,
            Number(page),
            Number(pageSize),
            pageCount,
            'User list retrieved successfully'
        ));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Set User Role (Upgrade to Member)
 */
router.put('/:userId/role', authenticate, isAdmin, [
    body('role').isIn([ROLES.MEMBER, ROLES.READER]).withMessage('Invalid role')
], async (req, res, next) => {
    try {
        // 检查验证错误
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(400, '验证失败', errors.mapped()));
        }
        
        const { userId } = req.params;
        const { role } = req.body;
        
        // Cannot set user as administrator, administrator can only be set directly in the database
        if (role === ROLES.ADMINISTRATOR) {
            return res.status(403).json(errorResponse(403, 'Cannot set administrator role via API'));
        }
        
        // 查找并更新用户
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true, runValidators: true }
        );
        
        if (!updatedUser) {
            return res.status(404).json(errorResponse(404, 'User not found'));
        }
        
        return res.json(successResponse({
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role
        }, `User role has been updated to ${role}`));
    } catch (error) {
        next(error);
    }
});

/**
 * Admin: Get User Details
 */
router.get('/:userId', authenticate, isAdmin, async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json(errorResponse(404, 'User not found'));
        }
        
        return res.json(successResponse(user, 'User details retrieved successfully'));
    } catch (error) {
        next(error);
    }
});

module.exports = router;