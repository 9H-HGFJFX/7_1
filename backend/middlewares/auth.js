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
        // 从请求头获取令牌
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        // 验证令牌
        const decoded = await verifyToken(token);
        
        // 获取用户信息
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在或已被删除'
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
            // 确保用户已通过认证
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: '请先登录'
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
            
            // 查找资源
            const resource = await model.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: resourceType + '不存在'
                });
            }
            
            // 检查用户是否为资源所有者或管理员
            if (resource.authorId && resource.authorId.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMINISTRATOR) {
                return res.status(403).json({
                    success: false,
                    message: '您没有权限修改此' + resourceType
                });
            }
            
            // 将资源附加到请求对象
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