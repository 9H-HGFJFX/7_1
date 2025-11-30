/**
 * Unified error response format
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} errors - Error details object
 * @returns {Object} Error response object
 */
const errorResponse = (statusCode, message, errors = {}) => {
    return {
        success: false,
        statusCode,
        message,
        errors,
        timestamp: new Date().toISOString()
    };
};

/**
 * Unified success response format
 * @param {any} data - Return data
 * @param {string} message - Success message
 * @returns {Object} Success response object
 */
const successResponse = (data = null, message = 'Operation successful') => {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    };
};

/**
 * Unified pagination response format
 * @param {Array} items - Data items array
 * @param {number} total - Total data count
 * @param {number} page - Current page number
 * @param {number} pageSize - Items per page
 * @param {number} pageCount - Total page count
 * @param {string} message - Response message
 * @returns {Object} Pagination response object
 */
const paginatedResponse = (items, total, page, pageSize, pageCount, message = 'Query successful') => {
    return {
        success: true,
        message,
        data: {
            items,
            pagination: {
                total,
                page,
                pageSize,
                pageCount,
                hasNext: page < pageCount,
                hasPrev: page > 1
            }
        },
        timestamp: new Date().toISOString()
    };
};

/**
 * 404 error handling middleware
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Requested path ${req.originalUrl} does not exist`);
    error.status = 404;
    next(error);
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    // 开发环境下打印错误堆栈
    if (process.env.NODE_ENV === 'development') {
        console.error('Global error handling:', err);
    }
    
    // 初始化错误信息
    let statusCode = 500;
    let message = 'Internal server error';
    let errors = {};
    
    // 根据不同类型的错误设置响应
    if (err.name === 'ValidationError') {
        // Mongoose验证错误
        statusCode = 400;
        message = 'Data validation failed';
        
        // 格式化验证错误
        Object.keys(err.errors).forEach(field => {
            errors[field] = err.errors[field].message;
        });
    } else if (err.code === 11000) {
        // MongoDB duplicate key error
        statusCode = 400;
        message = 'Data duplicate';
        
        // 提取重复字段
        const duplicateField = Object.keys(err.keyValue)[0];
        errors[duplicateField] = `${duplicateField} already exists`;
    } else if (err.name === 'CastError') {
        // MongoDB cast error (e.g. invalid ObjectId)
        statusCode = 400;
        message = 'Invalid data ID';
        errors.id = 'Provided ID format is invalid';
    } else if (err.status) {
        // 自定义错误状态
        statusCode = err.status;
        message = err.message || message;
    } else if (err.message) {
        // 其他错误，使用错误消息
        message = err.message;
    }
    
    // 返回错误响应
    res.status(statusCode).json(errorResponse(statusCode, message, errors));
};

/**
 * Logging middleware
 */
const logger = (req, res, next) => {
    // 开发环境下记录请求信息
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        console.log('Request headers:', req.headers);
        console.log('Request body:', req.body);
    }
    
    // 记录响应时间
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(body) {
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`Response time: ${duration}ms, status code: ${res.statusCode}`);
        }
        
        return originalSend.call(this, body);
    };
    
    next();
};

module.exports = {
    errorResponse,
    successResponse,
    paginatedResponse,
    notFoundHandler,
    globalErrorHandler,
    logger
};