/**
 * Database Service Module
 * Responsible for unified management of database connection, initialization, health check, etc.
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { User, ROLES } = require('../models/User');
const { News, NEWS_STATUS } = require('../models/News');
const { Vote, VOTE_RESULTS } = require('../models/Vote');
const Comment = require('../models/Comment');

class DatabaseService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.isInitializing = false;
        this.initializationPromise = null;
        this.lastConnectionTime = null;
    }

    /**
     * Get mongoose connection options - further optimized for serverless environment
     */
    getMongooseOptions() {
        return {
            serverSelectionTimeoutMS: 8000, // 增加超时时间，确保连接有足够时间
            socketTimeoutMS: 30000, // 减少超时时间，避免长时间阻塞
            family: 4,
            // 针对无服务器环境的优化配置
            keepAlive: true,
            keepAliveInitialDelay: 5000,
            // 使用小型连接池，适合无服务器环境
            poolSize: 2,
            // 启用自动索引创建（但会在控制台显示警告）
            autoIndex: false
        };
    }

    /**
     * Connect to MongoDB database - simplified version, suitable for serverless environment
     */
    async connect() {
        // 避免重复连接
        if (mongoose.connection.readyState === 1) {
            console.log('ℹ️  Database already connected, using existing connection');
            this.isConnected = true;
            return mongoose.connection;
        }
        
        if (mongoose.connection.readyState === 2) {
            console.log('ℹ️  Database is connecting, waiting for completion...');
            // 等待现有连接完成
            return new Promise((resolve, reject) => {
                mongoose.connection.once('connected', () => {
                    this.isConnected = true;
                    this.lastConnectionTime = new Date();
                    resolve(mongoose.connection);
                });
                mongoose.connection.once('error', (err) => {
                    this.isConnected = false;
                    reject(err);
                });
            });
        }
        
        try {
            console.log('🔄 Starting database connection...');
            this.connectionStartTime = Date.now();
            
            // 检查环境变量
            const mongoUri = process.env.MONGODB_URI;
            if (!mongoUri) {
                console.error('❌ Error: MONGODB_URI environment variable not set');
                return null; // 返回null而不是抛出错误，允许服务器继续运行
            }
            
            const mongoUri = process.env.MONGODB_URI;
            
            // 添加连接超时控制
            const connectionTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('数据库连接超时')), 15000)
            );
            
            this.connection = await Promise.race([
                mongoose.connect(mongoUri, this.getMongooseOptions()),
                connectionTimeout
            ]);
            
            this.isConnected = true;
            this.lastConnectionTime = new Date();
            
            console.log(`✅ Database connection successful! (Time taken: ${connectTime}ms)`);
            console.log(`✅ Database host: ${mongoose.connection.host || 'unknown'}`);
            console.log(`✅ Database name: ${mongoose.connection.name || 'unknown'}`);
            
            // 设置最小化的连接事件监听
            this.setupConnectionEvents();
            
            return this.connection;
        } catch (error) {
            console.error(`❌ Database connection failed: ${error.message}`);
            console.error('❌ Connection error details:', error);
            this.isConnected = false;
            // 在无服务器环境中，我们不尝试重连，让Vercel重新创建实例
            throw error;
        }
    }

    /**
     * Set up database connection event listeners - minimal version
     */
    setupConnectionEvents() {
        // 仅保留必要的事件监听
        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB connection error: ${err.message}`);
            this.isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('🔌 MongoDB connection disconnected');
            this.isConnected = false;
        });
        
        // 只在本地开发环境处理进程终止
        if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development') {
            process.on('SIGINT', async () => {
                await this.disconnect();
                console.log('👋 MongoDB连接已关闭（进程终止）');
                process.exit(0);
            });
        }
    }

    /**
     * Handle connection error - serverless environment version
     */
    handleConnectionError(error) {
        console.error(`❌ Database connection error handling: ${error.message}`);
        this.isConnected = false;
    }

    /**
     * Disconnect database connection - safe version
     */
    async disconnect() {
        try {
            // 检查连接状态
            if (!mongoose.connection || mongoose.connection.readyState === 0) {
                console.log('ℹ️  Database not connected, no need to disconnect');
                return true;
            }
            
            console.log('🔌 Attempting to disconnect database connection...');
            
            // 使用超时确保不会阻塞
            const disconnectPromise = mongoose.connection.close();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Disconnection timeout')), 5000)
            );
            
            await Promise.race([disconnectPromise, timeoutPromise]);
            
            console.log('✅ Database connection disconnected');
            this.isConnected = false;
            return true;
        } catch (error) {
            console.error(`⚠️  Error when disconnecting database: ${error.message}`);
            // 即使断开失败也返回true，让进程可以继续
            return true;
        }
    }

    /**
     * Get connection status - simplified version, avoid exceptions
     */
    getConnectionStatus() {
        try {
            const statusMap = {
                0: 'disconnected',
                1: 'connected',
                2: 'connecting',
                3: 'disconnecting'
            };
            
            const readyState = mongoose.connection?.readyState || 0;
            
            return {
                isConnected: readyState === 1,
                status: statusMap[readyState] || 'unknown',
                host: mongoose.connection?.host || 'unknown',
                database: mongoose.connection?.name || 'unknown',
                uptime: this.lastConnectionTime ? 
                    `${Math.floor((Date.now() - this.lastConnectionTime.getTime()) / 1000)}s` : 'unknown',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to get connection status: ${error.message}`);
            return {
                isConnected: false,
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check database connection health status
     */
    async checkHealth() {
        try {
            const status = this.getConnectionStatus();
            
            if (!status.isConnected) {
                return {
                    healthy: false,
                    status: status.state,
                    message: 'Database connection disconnected'
                };
            }
            
            // 执行简单查询测试连接
            await mongoose.connection.db.admin().ping();
            
            // 检查集合是否存在
            const collections = await mongoose.connection.db.listCollections().toArray();
            
            return {
                healthy: true,
                status: status.state,
                message: 'Database connection normal',
                collections: collections.map(c => c.name),
                collectionCount: collections.length
            };
        } catch (error) {
            return {
                healthy: false,
                status: 'error',
                message: error.message
            };
        }
    }

    /**
     * Initialize database - optimized for serverless environment
     */
    async initialize() {
        // 使用Promise避免并发初始化
        if (this.isInitializing) {
            return this.initializationPromise;
        }
        
        this.isInitializing = true;
        this.initializationPromise = this._initializeDatabase();
        
        try {
            return await this.initializationPromise;
        } finally {
            this.isInitializing = false;
        }
    }
    
    /**
     * Internal database initialization method - simplified version
     */
    async _initializeDatabase() {
        try {
            // 确保数据库已连接
            const status = this.getConnectionStatus();
            if (!status.isConnected) {
                console.log('ℹ️  Database not connected, skipping initialization');
                return { success: true, message: '数据库未连接，跳过初始化' };
            }
            
            console.log('🔄 Starting database initialization...');
            
            // 1. 初始化索引（最重要的步骤）
            await this.initializeIndexes();
            
            // 跳过索引初始化，避免冷启动延迟
            console.log('⚠️  Skipping index initialization in serverless environment');
            
            console.log('✅ Database initialization completed (simplified version)');
            return { success: true, message: '初始化完成（简化版）' };
        } catch (error) {
            console.error(`❌ Database initialization error: ${error.message}`);
            console.error('Initialization error details:', error);
            // 返回成功但带有警告，让服务可以继续运行
            return { success: true, warning: `Initialization encountered issues but service continues: ${error.message}` };
        }
    }

    /**
     * Create default admin user - only for local development environment
     */
    async createDefaultAdmin() {
        try {
            // 在生产环境中跳过此操作
            if (process.env.NODE_ENV === 'production') {
                console.log('ℹ️  Skipping default admin creation in production environment');
                return;
            }
            
            // 检查是否已存在管理员用户
            const adminExists = await User.findOne({ role: ROLES.ADMINISTRATOR });
            
            if (!adminExists) {
                // 创建默认管理员用户
                const defaultAdmin = new User({
                    firstName: 'System',
                    lastName: 'Admin',
                    email: 'admin@example.com',
                    password: 'admin123', // 仅用于开发环境
                    role: ROLES.ADMINISTRATOR
                });
                
                await defaultAdmin.save();
                console.log('✅ Default admin user created successfully! (development environment only)');
            } else {
                console.log('ℹ️  Admin user already exists, skipping creation');
            }
        } catch (error) {
            console.error(`❌ Failed to create default admin: ${error.message}`);
            // 开发环境允许继续执行
        }
    }

    /**
     * Initialize database indexes - simplified version
     */
    async initializeIndexes() {
        try {
            // 在无服务器环境中，我们避免在初始化时创建索引
            // 这会增加冷启动时间并可能导致超时
            console.log('⚠️  Skipping index initialization in serverless environment');
            return true;
        } catch (error) {
            console.error(`❌ Error creating indexes: ${error.message}`);
            return false;
        }
    }

    /**
     * Seed sample data (only for development environment)
     */
    async seedSampleData() {
        try {
            console.log('🔄 Seeding sample data...');
            
            // 检查是否已有新闻数据
            const newsCount = await News.countDocuments();
            if (newsCount === 0) {
                // Create sample user
                const sampleUser = await this.createSampleUser();
                
                // Create sample news
                await this.createSampleNews(sampleUser._id);
                
                console.log('✅ Sample data seeding completed');
            } else {
                console.log('ℹ️  Database already has data, skipping sample data seeding');
            }
        } catch (error) {
            console.error(`❌ Failed to seed sample data: ${error.message}`);
            // 不抛出错误，允许程序继续运行
        }
    }

    /**
     * Create sample user
     */
    async createSampleUser() {
        // 检查是否已存在示例用户
        let user = await User.findOne({ email: 'sample@example.com' });
        
        if (!user) {
            user = new User({
                firstName: 'Sample',
                lastName: 'User',
                email: 'sample@example.com',
                password: 'password123',
                role: ROLES.MEMBER
            });
            await user.save();
            console.log('✅ Sample user created successfully');
        }
        
        return user;
    }

    /**
     * Create sample news
     */
    async createSampleNews(userId) {
        const sampleNews = [
            {
                title: 'Major Breakthrough in COVID-19 Vaccine Development',
                content: 'Scientists have made significant progress in COVID-19 vaccine development. The new vaccine formulation shows higher protective efficacy and fewer side effects in clinical trials. This research achievement brings new hope to the global fight against the pandemic.'},{
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            },
            {
                title: 'Application of Artificial Intelligence in Healthcare',
                content: 'Artificial intelligence technology is playing an increasingly important role in the medical field. From auxiliary diagnosis to drug development, AI tools help doctors improve diagnostic accuracy, accelerate treatment planning, and bring better medical experiences to patients.'},{
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            },
            {
                title: 'Impact of Climate Change on Global Agriculture',
                content: 'Recent studies show that climate change is significantly affecting global agricultural production. Factors such as increased extreme weather events and altered precipitation patterns are causing crop yield fluctuations. Countries are actively taking measures to address this challenge.'},{
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            }
        ];
        
        for (const newsData of sampleNews) {
            const news = new News(newsData);
            await news.save();
            console.log(`✅ Sample news created successfully: ${news.title}`);
        }
    }

    /**
     * Clear database (only for testing)
     */
    async clearDatabase() {
        try {
            if (config.env !== 'development' && config.env !== 'test') {
                throw new Error('Database clearing operation is only allowed in development and testing environments');
            }
            
            console.log('⚠️  Clearing database...');
            
            // 按顺序删除数据，避免外键约束问题
            await Vote.deleteMany({});
            await Comment.deleteMany({});
            await News.deleteMany({});
            
            // 保留管理员用户
            const adminCount = await User.countDocuments({ role: ROLES.ADMINISTRATOR });
            if (adminCount > 0) {
                await User.deleteMany({ role: { $ne: ROLES.ADMINISTRATOR } });
            }
            
            console.log('✅ Database clearing completed');
        } catch (error) {
            console.error(`❌ Failed to clear database: ${error.message}`);
            throw error;
        }
    }
}

// 导出单例实例
module.exports = new DatabaseService();