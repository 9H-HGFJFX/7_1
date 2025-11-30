/**
 * 数据库服务模块
 * 负责数据库连接、初始化、健康检查等功能的统一管理
 */

const mongoose = require('mongoose');
const config = require('../config/config');

// 避免在无服务器环境中加载所有模型，这可能导致冷启动延迟
let User, ROLES, News, NEWS_STATUS, Vote, VOTE_RESULTS, Comment;

class DatabaseService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.isInitializing = false;
        this.initializationPromise = null;
        this.lastConnectionTime = null;
        this.connectionStartTime = null;
        this.modelsLoaded = false;
    }

    /**
     * 获取mongoose连接选项 - 进一步优化无服务器环境
     */
    getMongooseOptions() {
        return {
            serverSelectionTimeoutMS: 10000, // 增加超时时间
            socketTimeoutMS: 20000, // 进一步减少超时时间
            family: 4,
            // 针对无服务器环境的最小化配置
            keepAlive: true,
            keepAliveInitialDelay: 3000,
            poolSize: 1, // 最小连接池
            autoIndex: false,
            // 禁用缓冲区，避免内存泄漏
            bufferCommands: false,
            // 禁用自动重新连接，让Vercel处理
            autoReconnect: false
        };
    }

    /**
     * 连接到MongoDB数据库 - 简化版，适合无服务器环境
     */
    async connect() {
        // 检查当前连接状态
        if (mongoose.connection.readyState === 1) {
            console.log('ℹ️  数据库已连接，使用现有连接');
            this.isConnected = true;
            return mongoose.connection;
        }
        
        if (mongoose.connection.readyState === 2) {
            console.log('ℹ️  数据库正在连接中，等待完成...');
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
            console.log('🔄 开始数据库连接...');
            this.connectionStartTime = Date.now();
            
            // 检查环境变量
            const mongoUri = process.env.MONGODB_URI;
            if (!mongoUri) {
                console.error('❌ 错误: MONGODB_URI 环境变量未设置');
                return null; // 返回null而不是抛出错误，允许服务器继续运行
            }
            
            // 连接数据库（不使用超时竞争，减少复杂性）
            this.connection = await mongoose.connect(mongoUri, this.getMongooseOptions());
            
            this.isConnected = true;
            this.lastConnectionTime = new Date();
            const connectTime = Date.now() - this.connectionStartTime;
            
            console.log(`✅ 数据库连接成功! (耗时: ${connectTime}ms)`);
            console.log(`✅ 数据库主机: ${mongoose.connection.host || 'unknown'}`);
            console.log(`✅ 数据库名称: ${mongoose.connection.name || 'unknown'}`);
            
            // 设置最基本的事件监听
            this.setupConnectionEvents();
            
            return this.connection;
        } catch (error) {
            console.error(`❌ 数据库连接失败: ${error.message}`);
            console.error('❌ 连接错误详情:', error);
            this.isConnected = false;
            // 返回null而不是抛出错误，让服务器可以在数据库不可用时仍能启动
            return null;
        }
    }

    /**
     * 设置数据库连接事件监听 - 最小化版本
     */
    setupConnectionEvents() {
        // 移除所有现有监听器，避免多次注册
        mongoose.connection.removeAllListeners();
        
        // 只保留最基本的错误事件
        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB连接错误: ${err.message}`);
            this.isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('🔌 MongoDB连接已断开');
            this.isConnected = false;
        });
        
        // 避免在无服务器环境中添加进程事件监听器
        // 这可能导致内存泄漏和意外行为
    }

    /**
     * 处理连接错误 - 无服务器环境版本
     */
    handleConnectionError(error) {
        console.error(`❌ 数据库连接错误处理: ${error.message}`);
        this.isConnected = false;
        // 在无服务器环境中，不进行重连，让Vercel创建新实例
    }

    /**
     * 断开数据库连接 - 安全版本
     */
    async disconnect() {
        try {
            // 检查连接状态
            if (!mongoose.connection || mongoose.connection.readyState === 0) {
                console.log('ℹ️  数据库未连接，无需断开');
                return true;
            }
            
            console.log('🔌 尝试断开数据库连接...');
            
            // 使用超时确保不会阻塞
            const disconnectPromise = mongoose.connection.close();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('断开连接超时')), 5000)
            );
            
            await Promise.race([disconnectPromise, timeoutPromise]);
            
            console.log('✅ 数据库连接已断开');
            this.isConnected = false;
            return true;
        } catch (error) {
            console.error(`⚠️  断开数据库连接时出错: ${error.message}`);
            // 即使断开失败也返回true，让进程可以继续
            return true;
        }
    }

    /**
     * 获取连接状态 - 简化版本，避免异常
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
            console.error(`❌ 获取连接状态失败: ${error.message}`);
            return {
                isConnected: false,
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 检查数据库连接健康状态
     */
    async checkHealth() {
        try {
            const status = this.getConnectionStatus();
            
            if (!status.isConnected) {
                return {
                    healthy: false,
                    status: status.state,
                    message: '数据库连接断开'
                };
            }
            
            // 执行简单查询测试连接
            await mongoose.connection.db.admin().ping();
            
            // 检查集合是否存在
            const collections = await mongoose.connection.db.listCollections().toArray();
            
            return {
                healthy: true,
                status: status.state,
                message: '数据库连接正常',
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
     * 初始化数据库 - 优化无服务器环境
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
     * 内部初始化数据库方法 - 简化版本
     */
    async _initializeDatabase() {
        try {
            // 检查连接状态
            const status = this.getConnectionStatus();
            if (!status.isConnected) {
                console.log('ℹ️  数据库未连接，跳过初始化');
                return { success: true, message: '数据库未连接，跳过初始化' };
            }
            
            console.log('🔄 开始数据库初始化...');
            
            // 如果确实需要初始化模型（仅在必要时）
            if (!this.modelsLoaded) {
                this._loadModelsIfNeeded();
            }
            
            // 跳过索引初始化，避免冷启动延迟
            console.log('⚠️  在无服务器环境中跳过索引初始化');
            
            console.log('✅ 数据库初始化完成（简化版）');
            return { success: true, message: '初始化完成（简化版）' };
        } catch (error) {
            console.error(`❌ 数据库初始化错误: ${error.message}`);
            console.error('初始化错误详情:', error);
            // 返回成功但带有警告，让服务可以继续运行
            return { success: true, warning: `初始化遇到问题但服务继续: ${error.message}` };
        }
    }

    /**
     * 创建默认管理员用户 - 仅用于本地开发环境
     */
    async createDefaultAdmin() {
        try {
            // 在生产环境中跳过此操作
            if (process.env.NODE_ENV === 'production') {
                console.log('ℹ️  生产环境跳过创建默认管理员');
                return;
            }
            
            // 检查是否已存在管理员用户
            const adminExists = await User.findOne({ role: ROLES.ADMINISTRATOR });
            
            if (!adminExists) {
                // 创建默认管理员用户
                const defaultAdmin = new User({
                    firstName: '系统',
                    lastName: '管理员',
                    email: 'admin@example.com',
                    password: 'admin123', // 仅用于开发环境
                    role: ROLES.ADMINISTRATOR
                });
                
                await defaultAdmin.save();
                console.log('✅ 默认管理员用户创建成功! (仅开发环境)');
            } else {
                console.log('ℹ️  管理员用户已存在，跳过创建');
            }
        } catch (error) {
            console.error(`❌ 创建默认管理员失败: ${error.message}`);
            // 开发环境允许继续执行
        }
    }

    /**
     * 初始化数据库索引 - 简化版本
     */
    async initializeIndexes() {
        try {
            // 在无服务器环境中，我们避免在初始化时创建索引
            // 这会增加冷启动时间并可能导致超时
            console.log('⚠️  在无服务器环境中跳过索引初始化');
            return true;
        } catch (error) {
            console.error(`❌ 创建索引时出错: ${error.message}`);
            return false;
        }
    }

    /**
     * 填充示例数据（仅用于开发环境）
     */
    async seedSampleData() {
        try {
            console.log('🔄 正在填充示例数据...');
            
            // 检查是否已有新闻数据
            const newsCount = await News.countDocuments();
            if (newsCount === 0) {
                // 创建示例用户
                const sampleUser = await this.createSampleUser();
                
                // 创建示例新闻
                await this.createSampleNews(sampleUser._id);
                
                console.log('✅ 示例数据填充完成');
            } else {
                console.log('ℹ️  数据库中已有数据，跳过示例数据填充');
            }
        } catch (error) {
            console.error(`❌ 填充示例数据失败: ${error.message}`);
            // 不抛出错误，允许程序继续运行
        }
    }

    /**
     * 创建示例用户
     */
    async createSampleUser() {
        // 检查是否已存在示例用户
        let user = await User.findOne({ email: 'sample@example.com' });
        
        if (!user) {
            user = new User({
                firstName: '示例',
                lastName: '用户',
                email: 'sample@example.com',
                password: 'password123',
                role: ROLES.MEMBER
            });
            await user.save();
            console.log('✅ 示例用户创建成功');
        }
        
        return user;
    }

    /**
     * 创建示例新闻
     */
    async createSampleNews(userId) {
        const sampleNews = [
            {
                title: '新冠疫苗研发取得重大突破',
                content: '科学家们在新冠疫苗研发方面取得了重要进展，新的疫苗配方在临床试验中显示出更高的保护效力和更低的副作用。这项研究成果为全球抗击疫情带来了新的希望。',
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            },
            {
                title: '人工智能技术在医疗领域的应用',
                content: '人工智能技术正在医疗领域发挥越来越重要的作用，从辅助诊断到药物研发，AI工具帮助医生提高诊断准确率，加速治疗方案制定，为患者带来更好的医疗体验。',
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            },
            {
                title: '气候变化对全球农业的影响',
                content: '最新研究表明，气候变化正在对全球农业生产产生显著影响，极端天气事件增加、降水模式改变等因素导致农作物产量波动，各国正在积极采取措施应对这一挑战。',
                authorId: userId,
                images: [],
                status: NEWS_STATUS.PENDING
            }
        ];
        
        for (const newsData of sampleNews) {
            const news = new News(newsData);
            await news.save();
            console.log(`✅ 示例新闻创建成功: ${news.title}`);
        }
    }

    /**
     * 清理数据库（仅用于测试）
     */
    async clearDatabase() {
        try {
            if (config.env !== 'development' && config.env !== 'test') {
                throw new Error('清理数据库操作仅允许在开发和测试环境执行');
            }
            
            console.log('⚠️  正在清理数据库...');
            
            // 按顺序删除数据，避免外键约束问题
            await Vote.deleteMany({});
            await Comment.deleteMany({});
            await News.deleteMany({});
            
            // 保留管理员用户
            const adminCount = await User.countDocuments({ role: ROLES.ADMINISTRATOR });
            if (adminCount > 0) {
                await User.deleteMany({ role: { $ne: ROLES.ADMINISTRATOR } });
            }
            
            console.log('✅ 数据库清理完成');
        } catch (error) {
            console.error(`❌ 清理数据库失败: ${error.message}`);
            throw error;
        }
    }
}

// 导出单例实例
module.exports = new DatabaseService();