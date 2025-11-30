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
        // Get token from request header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token not provided'
            });
        }
        
        // Validate token
        const decoded = await verifyToken(token);
        
        // Get user information
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User does not exist or has been deleted'
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
            // Ensure user is authenticated
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Please log in first'
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
            
            // Find resource
            const resource = await model.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: resourceType + ' does not exist'
                });
            }
            
            // Check if user is resource owner or administrator
            if (resource.authorId && resource.authorId.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMINISTRATOR) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to modify this ' + resourceType
                });
            }
            
            // Attach resource to request object
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