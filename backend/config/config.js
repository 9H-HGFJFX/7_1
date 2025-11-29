// 系统配置文件

const config = {
    // 服务器配置
    port: process.env.PORT || 5000,
    
    // 数据库配置
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/anti-fake-news-system',
    
    // JWT配置
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiration: '24h',
    
    // 文件上传配置
    uploadPath: 'uploads',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    
    // 跨域配置
    corsOptions: {
        origin: [
            'http://localhost:3000',
            'http://localhost:5500',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5500'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    },
    
    // 新闻状态枚举
    newsStatus: {
        FAKE: 'Fake',
        NOT_FAKE: 'Not Fake',
        PENDING: 'Pending'
    },
    
    // 用户角色枚举
    userRoles: {
        READER: 'Reader',
        MEMBER: 'Member',
        ADMINISTRATOR: 'Administrator'
    },
    
    // 分页默认值
    pagination: {
        defaultPageSize: 10,
        maxPageSize: 100,
        defaultPage: 1
    },
    
    // 投票相关配置
    voting: {
        // 有效投票数阈值，超过此值才会自动判断新闻真假
        minVotesForDecision: 10,
        // 假新闻判定阈值（百分比）
        fakeNewsThreshold: 0.6 // 60%以上投票认为是假新闻
    },
    
    // API路径前缀
    apiPrefix: '/api'
};

module.exports = config;