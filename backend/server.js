// 加载环境变量
require('dotenv').config();

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

// 中间件配置
app.use(cors());
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
        // 连接数据库
        await dbService.connect();
        
        // 初始化数据库
        await dbService.initialize();
        
        // 启动服务器
        const PORT = config.port || 5000;
        app.listen(PORT, () => {
            console.log(`✅ 服务器运行在端口 ${PORT}`);
            console.log(`✅ API文档地址: http://localhost:${PORT}/api-docs`);
            console.log(`✅ 健康检查地址: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
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

// 启动服务器
startServer();