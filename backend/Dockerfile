# 使用多阶段构建优化镜像大小
# 第一阶段：构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci

# 复制应用程序代码
COPY . .

# 第二阶段：生产阶段
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和必要的文件
COPY --from=builder /app/package*.json ./

# 复制构建好的代码
COPY --from=builder /app/ ./

# 复制生产环境变量文件（不包含敏感信息）
COPY .env.production ./.env

# 安装生产依赖
RUN npm ci --only=production

# 创建日志目录并设置权限
RUN mkdir -p /app/logs && chown -R node:node /app/logs

# 设置非root用户运行应用
USER node

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 启动应用程序
CMD ["node", "server.js"]