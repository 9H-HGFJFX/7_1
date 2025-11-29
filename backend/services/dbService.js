/**
 * 数据库服务模块
 * 负责数据库连接、初始化、健康检查等功能的统一管理
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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000; // 3秒
    }

    /**
     * 获取mongoose连接选项
     */
    getMongooseOptions() {
        return {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
            // 移除了过时的选项：useNewUrlParser, useUnifiedTopology, autoReconnect, reconnectTries, reconnectInterval
        };
    }

    /**
     * 连接到MongoDB数据库
     */
    async connect() {
        try {
            console.log('正在连接到MongoDB数据库...');
            console.log('调试信息: config.mongoUri =', config.mongoUri);
            console.log('调试信息: process.env.MONGODB_URI =', process.env.MONGODB_URI);
            
            // 直接使用环境变量而不是config对象
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/anti-fake-news-system';
            this.connection = await mongoose.connect(mongoUri, this.getMongooseOptions());
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            console.log(`✅ MongoDB数据库连接成功! 数据库主机: ${this.connection.connection.host}`);
            console.log(`✅ 数据库名称: ${this.connection.connection.name}`);
            
            // 设置连接事件监听
            this.setupConnectionEvents();
            
            return this.connection;
        } catch (error) {
            console.error(`❌ 数据库连接失败: ${error.message}`);
            this.handleConnectionError(error);
            throw error;
        }
    }

    /**
     * 设置数据库连接事件监听
     */
    setupConnectionEvents() {
        // 连接成功事件
        mongoose.connection.on('connected', () => {
            console.log('🔄 MongoDB连接已建立');
            this.isConnected = true;
        });
        
        // 连接错误事件
        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB连接错误: ${err.message}`);
            this.isConnected = false;
            this.handleConnectionError(err);
        });
        
        // 连接断开事件
        mongoose.connection.on('disconnected', () => {
            console.log('🔌 MongoDB连接已断开');
            this.isConnected = false;
        });
        
        // 重新连接事件
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB连接已重新建立');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });
        
        // 处理进程终止时的数据库断开
        process.on('SIGINT', async () => {
            await this.disconnect();
            console.log('👋 MongoDB连接已关闭（进程终止）');
            process.exit(0);
        });
    }

    /**
     * 处理连接错误，尝试重连
     */
    handleConnectionError(error) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 尝试重新连接数据库 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(async () => {
                try {
                    await this.connect();
                } catch (err) {
                    console.error(`❌ 重连失败: ${err.message}`);
                }
            }, this.reconnectInterval * this.reconnectAttempts);
        } else {
            console.error('❌ 达到最大重连次数，放弃重连');
        }
    }

    /**
     * 断开数据库连接
     */
    async disconnect() {
        try {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close();
                this.isConnected = false;
                console.log('👋 MongoDB连接已手动关闭');
            }
        } catch (error) {
            console.error(`❌ 关闭数据库连接时出错: ${error.message}`);
            throw error;
        }
    }

    /**
     * 获取数据库连接状态
     */
    getConnectionStatus() {
        const readyState = mongoose.connection.readyState;
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        
        return {
            readyState,
            state: states[readyState] || 'unknown',
            isConnected: readyState === 1
        };
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
     * 初始化数据库
     */
    async initialize() {
        try {
            // 确保数据库已连接
            const status = this.getConnectionStatus();
            if (!status.isConnected) {
                throw new Error('数据库未连接，无法初始化');
            }
            
            console.log('🔄 开始初始化数据库...');
            
            // 1. 创建默认管理员用户
            await this.createDefaultAdmin();
            
            // 2. 初始化索引
            await this.initializeIndexes();
            
            // 3. 填充示例数据（如果是开发环境）
            if (config.env === 'development') {
                await this.seedSampleData();
            }
            
            console.log('✅ 数据库初始化完成');
            return { success: true };
        } catch (error) {
            console.error(`❌ 数据库初始化失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * 创建默认管理员用户
     */
    async createDefaultAdmin() {
        try {
            // 检查是否已存在管理员用户
            const adminExists = await User.findOne({ role: ROLES.ADMINISTRATOR });
            
            if (!adminExists) {
                // 创建默认管理员用户
                const defaultAdmin = new User({
                    firstName: '系统',
                    lastName: '管理员',
                    email: config.defaultAdminEmail,
                    password: config.defaultAdminPassword, // 会在保存时自动加密
                    role: ROLES.ADMINISTRATOR
                });
                
                await defaultAdmin.save();
                console.log(`✅ 默认管理员用户创建成功! 邮箱: ${config.defaultAdminEmail}`);
            } else {
                console.log('ℹ️  管理员用户已存在，跳过创建');
            }
        } catch (error) {
            console.error(`❌ 创建默认管理员失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 初始化数据库索引
     */
    async initializeIndexes() {
        try {
            console.log('🔄 正在初始化数据库索引...');
            
            // 确保所有模型的索引都已创建
            await User.init();
            await News.init();
            await Vote.init();
            await Comment.init();
            
            console.log('✅ 数据库索引初始化完成');
        } catch (error) {
            console.error(`❌ 初始化索引失败: ${error.message}`);
            throw error;
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