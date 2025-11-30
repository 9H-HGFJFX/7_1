# 前端项目部署指南

## 项目概述

这是一个社交反假新闻系统的前端项目，基于纯静态HTML/CSS/JavaScript开发，使用原生ES模块系统，无需构建工具即可运行。

## 部署要求

### 环境要求
- 静态网站托管服务（推荐：Vercel、Netlify、GitHub Pages等）
- 已部署的后端API服务（需提供API访问地址）

### 主要文件结构
```
frontend/
├── index.html           # 主页面
├── css/style.css        # 样式文件
├── components/          # 前端组件
├── utils/               # 工具函数（包含API配置）
├── assets/              # 静态资源
├── vercel.json          # Vercel部署配置
└── .env.production      # 环境变量配置（参考文件）
```

## 部署步骤

### 1. 配置API地址

**重要**：在部署前，必须更新以下文件中的API_URL，指向实际部署的后端服务地址。

1. 在`index.html`中更新全局API_URL变量：

```javascript
<script>
    // 设置全局API_URL变量，用于API调用
    window.API_URL = 'https://your-actual-backend-url.com/api';
    // 注意：在部署时，应根据实际环境修改此URL
</script>
```

2. 在`utils/api.js`中更新API基础URL：

```javascript
const API_BASE_URL = window.API_URL || 'https://your-actual-backend-url.com/api' || 'http://localhost:3001/api';
```

### 2. 部署到Vercel

#### 选项1：通过Vercel官网部署

1. 访问 [Vercel官网](https://vercel.com/)
2. 登录或注册账号
3. 点击"New Project"按钮
4. 导入项目仓库或直接上传前端文件夹
5. 配置项目名称和其他设置
6. 点击"Deploy"按钮完成部署

#### 选项2：使用Vercel CLI部署

1. 安装Vercel CLI：
   ```bash
   npm install -g vercel
   ```

2. 登录Vercel：
   ```bash
   vercel login
   ```

3. 在前端项目目录中执行：
   ```bash
   cd frontend
   vercel --prod
   ```

### 3. 其他部署选项

#### GitHub Pages

1. 确保项目仓库中有`index.html`文件
2. 进入仓库设置 > Pages
3. 选择分支（如main）和目录（/frontend）
4. 点击"Save"保存配置

#### Netlify

1. 访问 [Netlify官网](https://www.netlify.com/)
2. 登录或注册账号
3. 点击"Add new site" > "Import an existing project"
4. 连接GitHub仓库或拖放前端文件夹
5. 配置部署设置（构建命令留空，发布目录设为`./`）
6. 点击"Deploy site"按钮完成部署

## 配置说明

### vercel.json 配置详解

`vercel.json`文件包含以下主要配置：

- **构建规则**：定义静态文件的处理方式
- **路由规则**：设置API代理和SPA路由重写
- **缓存策略**：为静态资源设置缓存头
- **安全头**：添加安全相关的HTTP头

主要配置项说明：

- API代理路由：将`/api/*`请求代理到后端服务
- SPA路由：所有未匹配的路由重写到`index.html`，支持前端路由
- 缓存控制：CSS和静态资源设置长缓存时间

### 环境变量

本项目使用全局JavaScript变量作为环境配置，而非传统的`.env`文件（浏览器环境限制）。主要配置在`index.html`和`utils/api.js`中。

## 本地测试

在部署前，建议进行本地测试：

1. 确保安装了Python（用于启动HTTP服务器）
2. 在前端目录执行：
   ```bash
   cd frontend
   python -m http.server 8000
   ```
3. 访问 http://localhost:8000 测试网站功能

## 部署后验证

部署完成后，请验证以下内容：

1. 网站是否能正常加载
2. API请求是否能正确发送到后端服务
3. 用户认证功能是否正常工作
4. 页面路由是否正常（刷新页面不应出现404错误）

## 故障排除

### 常见问题及解决方案

1. **API连接失败**：
   - 检查API_URL是否正确配置
   - 确认后端服务是否正常运行
   - 检查CORS设置是否允许前端域名访问

2. **页面刷新404错误**：
   - 确认SPA路由配置是否正确
   - 对于Vercel，确保`vercel.json`中的重写规则正确

3. **静态资源加载失败**：
   - 检查文件路径是否正确
   - 确认文件权限设置正确

## 最佳实践

1. **定期更新依赖**：虽然本项目没有npm依赖，但应定期检查和更新外部资源
2. **监控部署状态**：使用部署平台的监控工具监控网站性能和错误
3. **启用HTTPS**：确保网站通过HTTPS访问，提升安全性
4. **设置正确的缓存策略**：优化静态资源的缓存设置，提升加载速度

## 联系信息

如有部署相关问题，请联系项目开发团队。

---

*文档更新日期：2024年*