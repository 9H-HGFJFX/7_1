// 加载环境变量
require('dotenv').config();

// 环境变量配置检查和日志记录
console.log(`🚀 启动应用程序 - 环境: ${process.env.NODE_ENV || 'development'}`);
console.log(`📝 环境变量检查开始...`);

// 检查关键环境变量
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => 
  process.env.NODE_ENV === 'production' && !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error(`❌ 错误: 生产环境中缺少以下必需的环境变量: ${missingEnvVars.join(', ')}`);
  // 在开发环境中继续，但在生产环境中记录错误
}

// 确保环境变量有合理的默认值
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`📝 环境变量检查完成 - 端口: ${PORT}, 环境: ${NODE_ENV}`);

const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入路由
const userRoutes = require('./routes/userRoutes');
const newsRoutes = require('./routes/newsRoutes');
const voteRoutes = require('./routes/voteRoutes');
const commentRoutes = require('./routes/commentRoutes');

// 导入中间件
const { notFoundHandler, globalErrorHandler, logger } = require('./middlewares/errorHandler');
const authMiddleware = require('./middlewares/auth');

// 导入配置和服务
const config = require('./config/config');
const dbService = require('./services/dbService');

// 创建Express应用
const app = express();

// CORS配置 - 动态从环境变量读取允许的源
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
console.log(`🔄 CORS配置: 允许的源 ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 预检请求缓存时间
}));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务配置 - 支持favicon和上传文件
const fs = require('fs');

// 启用public文件夹的静态文件服务，用于提供favicon等资源
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('✅ 静态文件服务已启用: /public');
} else {
  console.log('⚠️ public目录不存在，静态文件服务已部分禁用');
}

// 文件上传目录的静态服务
const uploadsPath = path.join(__dirname, 'uploads');
try {
  // 尝试访问uploads目录，如果不存在则不会启用静态文件服务
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
    console.log('✅ 上传文件服务已启用: /uploads');
  } else {
    console.log('⚠️ uploads目录不存在，上传文件服务已禁用');
  }
} catch (error) {
  console.log('⚠️ 初始化静态文件服务时出错:', error.message);
}

// 显式处理favicon.ico请求
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(publicDir, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    res.status(404).end();
  }
})

// 路由配置
app.use('/api/users', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/comments', commentRoutes);

// 轻量级健康检查路由 (不依赖数据库)
app.get('/api/health/liveness', (req, res) => {
  console.log(`✅ 轻量级健康检查请求 - 不依赖数据库`);
  res.status(200).json({
    status: 'healthy',
    message: 'Anti-Fake News API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// 根路由重定向到liveness健康检查
app.get('/', (req, res) => {
  res.redirect('/api/health/liveness');
});

// 数据库健康检查（作为深度健康检查）
app.get('/api/health/db', async (req, res) => {
  console.log(`🔍 数据库健康检查请求`);
  try {
    // 设置较短的超时
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('数据库健康检查超时')), 5000) 
    );
    
    // 使用现有的getConnectionStatus方法，适配原代码结构
    const healthPromise = new Promise((resolve) => {
      if (!dbService) {
        resolve({ healthy: false, message: '数据库服务未初始化' });
        return;
      }
      
      try {
        const status = dbService.getConnectionStatus();
        resolve({
          healthy: status.isConnected,
          status: status.isConnected ? 'ok' : 'error',
          connected: status.isConnected,
          database: status.database || 'unknown',
          host: status.host || 'unknown',
          uptime: status.uptime || 'unknown'
        });
      } catch (err) {
        resolve({ healthy: false, message: err.message });
      }
    });
    
    const health = await Promise.race([healthPromise, timeoutPromise]);
    
    if (health.healthy) {
      res.status(200).json({
        healthy: true,
        status: 'ok',
        connected: health.connected,
        database: health.database,
        host: health.host,
        uptime: health.uptime
      });
    } else {
      res.status(503).json({
        healthy: false,
        status: 'error',
        message: health.message || 'Database check failed'
      });
    }
  } catch (error) {
    console.error(`❌ 数据库健康检查失败: ${error.message}`);
    res.status(503).json({
      healthy: false,
      status: 'error',
      message: 'Database health check failed',
      error: error.message
    });
  }
});

// 日志中间件
app.use(logger);

// 404错误处理
app.use(notFoundHandler);

// 错误处理中间件 - 增强版
app.use((err, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.error(`❌ [${errorId}] 未捕获的错误: ${err.message}`);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      id: errorId,
      message: NODE_ENV === 'production' ? '服务器内部错误' : err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString()
    },
    stack: NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'API端点不存在',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
});

// 启动服务器
async function startServer() {
  console.log('🚀 开始启动服务器...');
  try {
    // 连接数据库（添加超时控制）
    const dbConnectTimeout = setTimeout(() => {
      throw new Error('数据库连接超时（15秒）');
    }, 15000);
    
    try {
      const connection = await dbService.connect();
      clearTimeout(dbConnectTimeout);
      if (connection && dbService.isConnected) {
        console.log('✅ 数据库连接成功');
      } else {
        console.error('⚠️  数据库连接失败，但服务器将继续运行');
      }
    } catch (dbError) {
      clearTimeout(dbConnectTimeout);
      console.error('⚠️  数据库连接失败，但服务器将继续运行:', dbError.message);
      // 在无服务器环境中，我们记录错误但不阻止服务器启动
    }
    
    // 尝试初始化数据库（如果已连接）
    try {
      const status = dbService.getConnectionStatus ? dbService.getConnectionStatus() : { isConnected: false };
      if (status.isConnected) {
        console.log('🔄 开始初始化数据库...');
        const initResult = await dbService.initialize();
        console.log('✅ 数据库初始化完成:', initResult ? (initResult.success ? '成功' : '失败') : '未知');
      } else {
        console.log('ℹ️  数据库未连接，跳过初始化');
      }
    } catch (initError) {
      console.error('⚠️  数据库初始化失败，但服务器将继续运行:', initError.message);
    }
    
    // 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`✅ 根路径健康检查: http://localhost:${PORT}/`);
      console.log(`🔍 数据库健康检查: http://localhost:${PORT}/api/health/db`);
    });
    
    // 处理服务器关闭
    process.on('SIGTERM', () => {
      console.log('👋 收到关闭信号，正在关闭服务器...');
      server.close(async () => {
        try {
          if (dbService && dbService.disconnect) {
            await dbService.disconnect();
          }
        } catch (disconnectError) {
          console.error('⚠️  数据库断开连接时出错:', disconnectError.message);
        }
        console.log('✅ 服务器已关闭');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ 服务器启动过程中发生错误:', error);
    console.error(error.stack);
    // 在本地开发环境中，如果启动失败，我们仍然尝试启动服务器以提供健康检查端点
    try {
      app.listen(PORT, () => {
        console.log(`⚠️  服务器以降级模式启动在 http://localhost:${PORT}`);
        console.log(`⚠️  数据库可能未连接，请检查日志`);
      });
    } catch (listenError) {
      console.error('❌ 无法启动服务器:', listenError);
    }
  }
}

// 仅在直接运行此文件时启动服务器，在Vercel环境中导出app实例
if (require.main === module) {
  startServer();
}

// 导出app实例供Vercel使用 - 确保导出总是成功的
module.exports = app;