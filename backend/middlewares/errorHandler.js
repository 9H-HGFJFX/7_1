/**
 * 统一错误响应格式
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {Object} errors - 错误详情对象
 * @returns {Object} 错误响应对象
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
 * 统一成功响应格式
 * @param {any} data - 返回数据
 * @param {string} message - 成功消息
 * @returns {Object} 成功响应对象
 */
const successResponse = (data = null, message = '操作成功') => {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    };
};

/**
 * 统一分页响应格式
 * @param {Array} items - 数据项数组
 * @param {number} total - 总数据量
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页数量
 * @param {number} pageCount - 总页数
 * @param {string} message - 响应消息
 * @returns {Object} 分页响应对象
 */
const paginatedResponse = (items, total, page, pageSize, pageCount, message = '查询成功') => {
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
 * 404错误处理中间件
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`请求的路径 ${req.originalUrl} 不存在`);
    error.status = 404;
    next(error);
};

/**
 * 全局错误处理中间件
 */
const globalErrorHandler = (err, req, res, next) => {
    // 开发环境下打印错误堆栈
    if (process.env.NODE_ENV === 'development') {
        console.error('全局错误处理:', err);
    }
    
    // 初始化错误信息
    let statusCode = 500;
    let message = '服务器内部错误';
    let errors = {};
    
    // 根据不同类型的错误设置响应
    if (err.name === 'ValidationError') {
        // Mongoose验证错误
        statusCode = 400;
        message = '数据验证失败';
        
        // 格式化验证错误
        Object.keys(err.errors).forEach(field => {
            errors[field] = err.errors[field].message;
        });
    } else if (err.code === 11000) {
        // MongoDB重复键错误
        statusCode = 400;
        message = '数据重复';
        
        // 提取重复字段
        const duplicateField = Object.keys(err.keyValue)[0];
        errors[duplicateField] = `${duplicateField}已存在`;
    } else if (err.name === 'CastError') {
        // MongoDB类型转换错误（如无效的ObjectId）
        statusCode = 400;
        message = '无效的数据ID';
        errors.id = '提供的ID格式无效';
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
 * 日志记录中间件
 */
const logger = (req, res, next) => {
    // 开发环境下记录请求信息
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        console.log('请求头:', req.headers);
        console.log('请求体:', req.body);
    }
    
    // 记录响应时间
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(body) {
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`响应时间: ${duration}ms, 状态码: ${res.statusCode}`);
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