// System configuration file

const config = {
    // Server configuration
    port: process.env.PORT || 5000,
    
    // Database configuration
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/anti-fake-news-system',
    
    // JWT configuration
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiration: '24h',
    
    // File upload configuration
    uploadPath: 'uploads',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    
    // CORS configuration
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
    
    // News status enumeration
    newsStatus: {
        FAKE: 'Fake',
        NOT_FAKE: 'Not Fake',
        PENDING: 'Pending'
    },
    
    // User role enumeration
    userRoles: {
        READER: 'Reader',
        MEMBER: 'Member',
        ADMINISTRATOR: 'Administrator'
    },
    
    // Pagination default values
    pagination: {
        defaultPageSize: 10,
        maxPageSize: 100,
        defaultPage: 1
    },
    
    // Voting related configuration
    voting: {
        // Minimum votes threshold for automatic news verification
        minVotesForDecision: 10,
        // Fake news determination threshold (percentage)
        fakeNewsThreshold: 0.6 // News considered fake if more than 60% vote it as fake
    },
    
    // API path prefix
    apiPrefix: '/api'
};

module.exports = config;