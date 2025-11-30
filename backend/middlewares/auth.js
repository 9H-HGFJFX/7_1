const jwt = require('jsonwebtoken');
const { User, ROLES } = require('../models/User');
const config = require('../config/config');

/**
 * 生成JWT令牌
 * @param {Object} user - 用户对象
 * @returns {string} JWT令牌
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
 * 验证JWT令牌
 * @param {string} token - JWT令牌
 * @returns {Promise<Object>} 解码后的令牌数据
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
 * 认证中间件 - 验证用户是否已登录
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from request header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        // Validate token
        const decoded = await verifyToken(token);
        
        // Get user information
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在或已被删除'
            });
        }
        
        // Attach user information to request object
        req.user = user;
        req.userToken = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '令牌已过期'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: '认证失败: ' + error.message
        });
    }
};

/**
 * 角色权限检查中间件
 * @param {string} requiredRole - 需要的角色
 */
const authorize = (requiredRole) => {
    return (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: '请先登录'
                });
            }
            
            // Check if user role meets requirements
            const userRole = req.user.role;
            const roleHierarchy = {
                [ROLES.READER]: 1,
                [ROLES.MEMBER]: 2,
                [ROLES.ADMINISTRATOR]: 3
            };
            
            if (!roleHierarchy[userRole] || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
                return res.status(403).json({
                    success: false,
                    message: '权限不足，需要' + requiredRole + '角色'
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: '权限检查失败: ' + error.message
            });
        }
    };
};

/**
 * 可选认证中间件 - 不强制要求登录，但如果提供了令牌则验证
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        // Get token from request header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // No token provided, continue execution without setting user info
            return next();
        }
        
        // Validate token
        const decoded = await verifyToken(token);
        
        // Get user information
        const user = await User.findById(decoded.id);
        
        if (user) {
            // Attach user information to request object
            req.user = user;
            req.userToken = decoded;
        }
        
        next();
    } catch (error) {
        // Token is invalid, but do not prevent request from continuing
        next();
    }
};

/**
 * 检查用户是否为管理员
 */
const isAdmin = authorize(ROLES.ADMINISTRATOR);

/**
 * 检查用户是否为成员或管理员
 */
const isMemberOrAdmin = authorize(ROLES.MEMBER);

/**
 * 检查资源所有权
 * @param {string} resourceType - 资源类型
 * @param {string} resourceIdParam - 请求参数名
 * @param {string} model - Mongoose模型
 */
const checkOwnership = (resourceType, resourceIdParam, model) => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[resourceIdParam];
            
            if (!resourceId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少资源ID'
                });
            }
            
            // Find resource
            const resource = await model.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: resourceType + '不存在'
                });
            }
            
            // Check if user is resource owner or administrator
            if (resource.authorId && resource.authorId.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMINISTRATOR) {
                return res.status(403).json({
                    success: false,
                    message: '您没有权限修改此' + resourceType
                });
            }
            
            // Attach resource to request object
            req[resourceType.toLowerCase()] = resource;
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: '所有权检查失败: ' + error.message
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