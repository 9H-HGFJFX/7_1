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
  console.error(`❌ Error: Missing required environment variables in production: ${missingEnvVars.join(', ')}`);
  // Continue in development, but log error in production
}

// Ensure environment variables have reasonable defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`📝 Environment variable check completed - Port: ${PORT}, Environment: ${NODE_ENV}`);

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

// CORS configuration - Dynamically read allowed origins from environment variables
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
console.log(`🔄 CORS configuration: Allowed origins ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // Preflight request cache time
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file service configuration - Support favicon and uploads
const fs = require('fs');

// Enable static file service for public folder to serve favicon and other resources
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('✅ Static file service enabled: /public');
} else {
  console.log('⚠️ public directory does not exist, static file service partially disabled');
}

// Static service for file uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
try {
  // Try to access uploads directory, if it doesn't exist, static file service won't be enabled
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
    console.log('✅ Upload file service enabled: /uploads');
  } else {
    console.log('⚠️ uploads directory does not exist, upload file service disabled');
  }
} catch (error) {
  console.log('⚠️ Error initializing static file service:', error.message);
}

// Explicitly handle favicon.ico requests
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(publicDir, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    res.status(404).end();
  }
})

// Route configuration
app.use('/api/users', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/comments', commentRoutes);

// API root path handler - prevent 404 for /api
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Anti-Fake News API',
    version: '1.0.0',
    endpoints: [
      '/api/users',
      '/api/news',
      '/api/vote',
      '/api/comments',
      '/api/health/liveness',
      '/api/health/db'
    ]
  });
});

// Lightweight health check route (database-independent)
app.get('/api/health/liveness', (req, res) => {
  console.log(`✅ Lightweight health check request - Database-independent`);
  res.status(200).json({
    status: 'healthy',
    message: 'Anti-Fake News API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// Root route redirects to liveness health check
app.get('/', (req, res) => {
  res.redirect('/api/health/liveness');
});

// Database health check (as deep health check)
app.get('/api/health/db', async (req, res) => {
  console.log(`🔍 Database health check request`);
  try {
    // Set a shorter timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database health check timeout')), 5000) 
    );
    
    // Use the existing getConnectionStatus method to adapt to the original code structure
    const healthPromise = new Promise((resolve) => {
      if (!dbService) {
        resolve({ healthy: false, message: 'Database service not initialized' });
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
    console.error(`❌ Database health check failed: ${error.message}`);
    res.status(503).json({
      healthy: false,
      status: 'error',
      message: 'Database health check failed',
      error: error.message
    });
  }
});

// Logging middleware
app.use(logger);

// 404 error handling
app.use(notFoundHandler);

// Error handling middleware - Enhanced version
app.use((err, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.error(`❌ [${errorId}] Uncaught error: ${err.message}`);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      id: errorId,
      message: NODE_ENV === 'production' ? 'Internal server error' : err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString()
    },
    stack: NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'API endpoint not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
async function startServer() {
  console.log('🚀 Starting server...');
  try {
    // Connect to database (with timeout control)
    const dbConnectTimeout = setTimeout(() => {
      throw new Error('Database connection timeout (15 seconds)');
    }, 15000);
    
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

// Only start server when this file is run directly, export app instance in Vercel environment
if (require.main === module) {
  startServer();
}

// Export app instance for Vercel use - Ensure export is always successful
module.exports = app;