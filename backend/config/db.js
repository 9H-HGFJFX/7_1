// Import new database service
const dbService = require('../services/dbService');
const config = require('./config');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 * @deprecated Use new dbService module instead
 */
async function connectDB() {
    console.log('⚠️  Note: connectDB function is deprecated, please use dbService.connect()');
    return dbService.connect();
}

/**
 * Disconnect from database
 * @returns {Promise<void>}
 * @deprecated Use new dbService module instead
 */
async function disconnectDB() {
    console.log('⚠️  Note: disconnectDB function is deprecated, please use dbService.disconnect()');
    return dbService.disconnect();
}

/**
 * Get database connection status
 * @returns {Object} Database connection information
 * @deprecated Use new dbService module instead
 */
function getConnectionStatus() {
    console.log('⚠️  Note: getConnectionStatus function is deprecated, please use dbService.getConnectionStatus()');
    return dbService.getConnectionStatus();
}

/**
 * Initialize database, create default admin user
 * @returns {Promise<void>}
 * @deprecated Use new dbService module instead
 */
async function initializeDB() {
    console.log('⚠️  Note: initializeDB function is deprecated, please use dbService.initialize()');
    const result = await dbService.initialize();
    if (!result.success) {
        throw new Error(result.error);
    }
}

/**
 * Check database connection health status
 * @returns {Promise<Object>}
 * @deprecated Use new dbService module instead
 */
async function checkDBHealth() {
    console.log('⚠️  Note: checkDBHealth function is deprecated, please use dbService.checkHealth()');
    return dbService.checkHealth();
}

module.exports = {
    connectDB,
    disconnectDB,
    getConnectionStatus,
    initializeDB,
    checkDBHealth
};