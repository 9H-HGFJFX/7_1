# 防假新闻检测与分析平台

## 项目概述

本项目是一个综合性的防假新闻检测与分析平台，旨在帮助用户识别和应对网络上的虚假信息。通过结合人工智能技术、用户协作和社区审核机制，平台能够有效地对新闻内容进行真实性评估，并提供多维度的分析数据。

### 核心功能

- **用户认证与授权系统**：支持用户注册、登录、权限管理
- **新闻内容管理**：新闻发布、编辑、删除、状态管理
- **实时数据处理与分析**：新闻真实性检测、统计分析、趋势展示
- **投票与评论系统**：用户可对新闻真实性进行投票和发表评论
- **智能搜索功能**：支持按标题、内容、作者等多维度搜索新闻
- **用户行为记录**：追踪用户投票和评论历史

## 技术栈

### 后端

- **Node.js**：JavaScript运行时环境
- **Express.js**：Web应用框架
- **MongoDB**：NoSQL数据库
- **Mongoose**：ODM库，用于MongoDB对象建模
- **JWT**：用户认证与授权
- **Docker**：容器化部署

### 前端

- **HTML5/CSS3**：页面结构和样式
- **JavaScript (ES6+)**：交互逻辑
- **Bootstrap**：响应式UI框架
- **Font Awesome**：图标库
- **Axios**：HTTP客户端，用于API请求

## 系统架构

### 三层架构设计

1. **表示层**：前端页面，负责用户交互
2. **业务逻辑层**：后端API，处理业务逻辑
3. **数据访问层**：数据库操作，数据持久化

### 模块划分

- **用户模块**：处理用户注册、登录、权限控制
- **新闻模块**：管理新闻内容的CRUD操作
- **投票模块**：处理用户投票和统计
- **评论模块**：管理用户评论
- **搜索模块**：提供新闻搜索功能
- **分析模块**：数据分析和可视化

## 快速开始

### 前提条件

- **Node.js** (v14+)
- **MongoDB** (v4.0+)
- **npm** 或 **yarn**
- **Docker** 和 **Docker Compose** (可选，用于容器化部署)

### 本地开发环境设置

#### 后端设置

1. 进入后端目录
```bash
cd backend
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
   - 复制 `.env.example` 为 `.env`
   - 根据您的环境修改配置

4. 启动后端服务
```bash
npm start
```

#### 前端设置

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动前端开发服务器
```bash
npm run dev
```

### 使用Docker Compose部署

1. 确保安装了Docker和Docker Compose

2. 在项目根目录运行
```bash
docker-compose up -d
```

3. 服务将在以下地址可用：
   - 前端：http://localhost
   - 后端API：http://localhost:3000/api

## 项目结构

### 后端结构

```
backend/
├── config/          # 配置文件
├── middlewares/     # Express中间件
├── models/          # MongoDB模型
├── routes/          # API路由
├── services/        # 业务逻辑服务
├── utils/           # 工具函数
├── tests/           # 测试文件
├── server.js        # 应用入口
├── package.json     # 项目依赖
└── Dockerfile       # Docker构建文件
```

### 前端结构

```
frontend/
├── assets/          # 静态资源
├── components/      # 前端组件
├── css/             # 样式文件
├── utils/           # 工具函数
├── index.html       # 主页
└── Dockerfile       # Docker构建文件
```

## API文档

API文档详细说明请参考 [API文档](docs/api.md)。

### 主要API端点

- **用户管理**
  - POST `/api/users/register` - 用户注册
  - POST `/api/users/login` - 用户登录
  - GET `/api/users/profile` - 获取用户资料

- **新闻管理**
  - GET `/api/news` - 获取新闻列表
  - GET `/api/news/:id` - 获取新闻详情
  - POST `/api/news` - 创建新闻
  - PUT `/api/news/:id` - 更新新闻
  - DELETE `/api/news/:id` - 删除新闻

- **投票系统**
  - POST `/api/news/:id/votes` - 投票
  - GET `/api/news/:id/vote-stats` - 获取投票统计

- **评论系统**
  - GET `/api/news/:id/comments` - 获取评论列表
  - POST `/api/news/:id/comments` - 添加评论
  - DELETE `/api/comments/:id` - 删除评论

## 数据库设计

数据库设计详细说明请参考 [数据库文档](docs/database.md)。

### 主要集合

- **users** - 用户信息
- **news** - 新闻内容
- **votes** - 用户投票记录
- **comments** - 用户评论

## 安全措施

1. **密码加密存储**：使用bcrypt对用户密码进行加密
2. **JWT认证**：使用JSON Web Token进行用户身份验证
3. **输入验证**：对所有用户输入进行严格验证
4. **XSS防护**：防止跨站脚本攻击
5. **CSRF防护**：防止跨站请求伪造
6. **权限控制**：基于角色的访问控制

## 性能优化

1. **数据库索引**：为常用查询字段创建索引
2. **分页查询**：限制返回数据量
3. **静态资源缓存**：使用适当的缓存策略
4. **数据库连接池**：优化数据库连接
5. **错误处理与日志**：详细记录系统运行状态

## 测试

项目使用Jest进行单元测试和集成测试：

```bash
# 运行后端测试
cd backend
npm test

# 运行集成测试
cd ..
npm test
```

## 部署说明

本项目提供两种部署方案，详细部署步骤请参考 [部署指南](./DEPLOYMENT_GUIDE.md)：

### 1. 保底方案：PaaS服务部署

使用Vercel部署前端，Render部署后端，MongoDB Atlas提供数据库服务。这种方案配置简单，无需管理服务器，适合快速部署和演示。

### 2. 加分方案：Docker+云服务器部署

使用Docker容器化应用，部署在云服务器上，提供更高的自定义性和控制能力，适合生产环境和需要更多控制的场景。

### CI/CD配置

项目已配置GitHub Actions自动化部署。当代码推送到`main`或`master`分支时，将自动触发部署流程。详细配置请参考部署指南。

## 监控与维护

1. **日志监控**：使用日志分析工具监控系统运行状态
2. **性能监控**：监控API响应时间和系统资源使用情况
3. **错误告警**：设置关键错误的告警机制
4. **定期更新**：定期更新依赖包以修复安全漏洞

## 贡献指南

欢迎参与项目贡献！请遵循以下流程：

1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 许可证

本项目采用MIT许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 联系信息

如有任何问题或建议，请联系项目维护者。

---

© 2024 防假新闻检测与分析平台团队