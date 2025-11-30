// Load environment variables
require('dotenv').config();

// Environment variable configuration check and logging
console.log(`🚀 Starting application - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📝 Environment variable check starting...`);

// Check critical environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => 
  process.env.NODE_ENV === 'production' && !process.env[varName]
);
if (missingEnvVars.length > 0) {
    console.warn(`⚠️  Warning: Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const userRoutes = require('./routes/userRoutes');
const newsRoutes = require('./routes/newsRoutes');
const voteRoutes = require('./routes/voteRoutes');
const commentRoutes = require('./routes/commentRoutes');

// Import middleware
const { notFoundHandler, globalErrorHandler, logger } = require('./middlewares/errorHandler');
const authMiddleware = require('./middlewares/auth');

// 导入配置和服务
const config = require('./config/config');
const dbService = require('./services/dbService');

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // Preflight request cache time
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（用于图片上传） - 添加错误处理以防uploads目录不存在
const uploadsPath = path.join(__dirname, 'uploads');
try {
  // 尝试访问uploads目录，如果不存在则不会启用静态文件服务
  const fs = require('fs');
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  } else {
    console.log('⚠️ uploads目录不存在，静态文件服务已禁用');
  }
} catch (error) {
  console.log('⚠️ 初始化静态文件服务时出错:', error.message);
}

// 路由配置
app.use('/api/users', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/comments', commentRoutes);

// 根路径健康检查
app.get('/', (req, res) => {
    res.json({
        message: '社交反假新闻系统API服务正在运行',
        version: '1.0.0'
    });
});

// 日志中间件
app.use(logger);

// 404错误处理
app.use(notFoundHandler);

// 全局错误处理中间件
app.use(globalErrorHandler);

// 数据库连接和服务器启动
async function startServer() {
    try {
      const connection = await dbService.connect();
      clearTimeout(dbConnectTimeout);
      if (connection && dbService.isConnected) {
        console.log('✅ Database connection successful');
      } else {
        console.error('⚠️  Database connection failed, but server will continue running');
      }
    } catch (dbError) {
      clearTimeout(dbConnectTimeout);
      console.error('⚠️  Database connection failed, but server will continue running:', dbError.message);
      // In serverless environment, we log errors but don't prevent server startup
    }
    
    // Attempt to initialize database (if connected)
    try {
      const status = dbService.getConnectionStatus ? dbService.getConnectionStatus() : { isConnected: false };
      if (status.isConnected) {
        console.log('🔄 Initializing database...');
        const initResult = await dbService.initialize();
        console.log('✅ Database initialization completed:', initResult ? (initResult.success ? 'success' : 'failure') : 'unknown');
      } else {
        console.log('ℹ️  Database not connected, skipping initialization');
      }
    } catch (initError) {
      console.error('⚠️  Database initialization failed, but server will continue running:', initError.message);
    }
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`✅ Root path health check: http://localhost:${PORT}/`);
      console.log(`🔍 Database health check: http://localhost:${PORT}/api/health/db`);
    });
    
    // Handle server shutdown
    process.on('SIGTERM', () => {
      console.log('👋 Received shutdown signal, closing server...');
      server.close(async () => {
        try {
          if (dbService && dbService.disconnect) {
            await dbService.disconnect();
          }
        } catch (disconnectError) {
          console.error('⚠️  Error disconnecting from database:', disconnectError.message);
        }
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Error during server startup:', error);
    console.error(error.stack);
    // In local development environment, if startup fails, we still try to start the server to provide health check endpoints
    try {
      app.listen(PORT, () => {
        console.log(`⚠️  Server started in degraded mode at http://localhost:${PORT}`);
        console.log(`⚠️  Database may not be connected, please check logs`);
      });
    } catch (listenError) {
      console.error('❌ Failed to start server:', listenError);
    }
  }
}

// 添加健康检查端点
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await dbService.checkHealth();
        
        res.status(dbHealth.healthy ? 200 : 503).json({
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: dbHealth
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// 导出app实例供Vercel使用
module.exports = app;

// 仅在本地开发环境启动服务器
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development') {
  startServer();
}