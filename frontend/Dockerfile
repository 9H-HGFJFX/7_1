# 多阶段构建：第一阶段 - 构建前端应用
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制前端源代码
COPY . .

# 复制生产环境变量
COPY .env.production ./.env.production

# 构建生产版本
RUN npm run build

# 第二阶段：使用Nginx提供静态文件服务
FROM nginx:alpine

# 设置Nginx配置
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]