const jwt = require('jsonwebtoken');
const { User, ROLES } = require('../models/User');
const config = require('../config/config');

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        config.jwtSecret,
        {
            expiresIn: config.jwtExpiration
        }
    );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token data
 */
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, config.jwtSecret, (err, decoded) => {
            if (err) {
                return reject(err);
            }
            resolve(decoded);
        });
    });
};

/**
 * Authentication middleware - Verify if user is logged in
 */
const authenticate = async (req, res, next) => {
    try {
        // 从请求头获取令牌
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token not provided'
            });
        }
        
        // 验证令牌
        const decoded = await verifyToken(token);
        
        // 获取用户信息
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User does not exist or has been deleted'
            });
        }
        
        // 将用户信息附加到请求对象
        req.user = user;
        req.userToken = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Authentication failed: ' + error.message
        });
    }
};

/**
 * Role permission check middleware
 * @param {string} requiredRole - Required role
 */
const authorize = (requiredRole) => {
    return (req, res, next) => {
        try {
            // 确保用户已通过认证
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Please log in first'
                });
            }
            
            // 检查用户角色是否满足要求
            const userRole = req.user.role;
            const roleHierarchy = {
                [ROLES.READER]: 1,
                [ROLES.MEMBER]: 2,
                [ROLES.ADMINISTRATOR]: 3
            };
            
            if (!roleHierarchy[userRole] || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions, requires ' + requiredRole + ' role'
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Permission check failed: ' + error.message
            });
        }
    };
};

/**
 * Optional authentication middleware - Not mandatory to log in, but verifies token if provided
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        // 从请求头获取令牌
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // 没有提供令牌，继续执行但不设置用户信息
            return next();
        }
        
        // 验证令牌
        const decoded = await verifyToken(token);
        
        // 获取用户信息
        const user = await User.findById(decoded.id);
        
        if (user) {
            // 将用户信息附加到请求对象
            req.user = user;
            req.userToken = decoded;
        }
        
        next();
    } catch (error) {
        // 令牌无效，但不阻止请求继续
        next();
    }
};

/**
 * Check if user is administrator
 */
const isAdmin = authorize(ROLES.ADMINISTRATOR);

/**
 * Check if user is member or administrator
 */
const isMemberOrAdmin = authorize(ROLES.MEMBER);

/**
 * Check resource ownership
 * @param {string} resourceType - Resource type
 * @param {string} resourceIdParam - Request parameter name
 * @param {string} model - Mongoose model
 */
const checkOwnership = (resourceType, resourceIdParam, model) => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[resourceIdParam];
            
            if (!resourceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource ID missing'
                });
            }
            
            // 查找资源
            const resource = await model.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: resourceType + ' does not exist'
                });
            }
            
            // 检查用户是否为资源所有者或管理员
            if (resource.authorId && resource.authorId.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMINISTRATOR) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to modify this ' + resourceType
                });
            }
            
            // 将资源附加到请求对象
            req[resourceType.toLowerCase()] = resource;
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Ownership check failed: ' + error.message
            });
        }
    };
};

module.exports = {
    generateToken,
    verifyToken,
    authenticate,
    authorize,
    optionalAuthenticate,
    isAdmin,
    isMemberOrAdmin,
    checkOwnership
};