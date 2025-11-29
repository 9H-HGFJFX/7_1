// 导入新的数据库服务
const dbService = require('../services/dbService');
const config = require('./config');

/**
 * 连接到MongoDB数据库
 * @returns {Promise<void>}
 * @deprecated 使用新的dbService模块替代
 */
async function connectDB() {
    console.log('⚠️  注意: connectDB函数已弃用，请使用dbService.connect()');
    return dbService.connect();
}

/**
 * 断开数据库连接
 * @returns {Promise<void>}
 * @deprecated 使用新的dbService模块替代
 */
async function disconnectDB() {
    console.log('⚠️  注意: disconnectDB函数已弃用，请使用dbService.disconnect()');
    return dbService.disconnect();
}

/**
 * 获取数据库连接状态
 * @returns {Object} 数据库连接信息
 * @deprecated 使用新的dbService模块替代
 */
function getConnectionStatus() {
    console.log('⚠️  注意: getConnectionStatus函数已弃用，请使用dbService.getConnectionStatus()');
    return dbService.getConnectionStatus();
}

/**
 * 初始化数据库，创建默认管理员用户
 * @returns {Promise<void>}
 * @deprecated 使用新的dbService模块替代
 */
async function initializeDB() {
    console.log('⚠️  注意: initializeDB函数已弃用，请使用dbService.initialize()');
    const result = await dbService.initialize();
    if (!result.success) {
        throw new Error(result.error);
    }
}

/**
 * 检查数据库连接健康状态
 * @returns {Promise<Object>}
 * @deprecated 使用新的dbService模块替代
 */
async function checkDBHealth() {
    console.log('⚠️  注意: checkDBHealth函数已弃用，请使用dbService.checkHealth()');
    return dbService.checkHealth();
}

module.exports = {
    connectDB,
    disconnectDB,
    getConnectionStatus,
    initializeDB,
    checkDBHealth
};