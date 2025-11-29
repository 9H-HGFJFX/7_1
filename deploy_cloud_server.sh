#!/bin/bash

# 云服务器部署脚本 - 适用于Ubuntu/Debian系统
# 使用前请确保：
# 1. 已连接到目标云服务器
# 2. 具有sudo权限
# 3. 系统已更新

echo "==========================================="
echo "防假新闻检测与分析平台 - 云服务器部署脚本"
echo "==========================================="

# 创建项目目录
PROJECT_DIR="/opt/anti-fake-news"
echo "创建项目目录: $PROJECT_DIR"
sudo mkdir -p $PROJECT_DIR
sudo chown -R $(whoami):$(whoami) $PROJECT_DIR
cd $PROJECT_DIR

# 安装必要的依赖
echo "安装Docker和Docker Compose..."
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# 添加Docker官方GPG密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# 添加Docker仓库
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update

# 安装Docker
sudo apt install -y docker-ce

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 克隆项目代码
# 注意：请替换为实际的GitHub仓库地址
echo "克隆项目代码..."
git clone https://github.com/your-username/anti-fake-news.git .

# 创建必要的目录
echo "创建必要的目录..."
mkdir -p backend/logs
chmod 777 backend/logs

# 创建MongoDB配置目录
mkdir -p backend/config
cp -f mongod.conf backend/config/ || echo "Warning: mongod.conf not found, using default configuration"

# 配置环境变量
echo "配置环境变量..."

# 后端环境变量
cat > backend/.env << EOF
# MongoDB连接信息
MONGODB_URI=mongodb://admin:secret@mongodb:27017/news_app?authSource=admin

# JWT配置 - 请替换为强密钥
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=24h

# 服务器配置
PORT=3001
NODE_ENV=production

# 跨域配置
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://$(curl -s ifconfig.me)
EOF

echo "后端环境变量已配置"

# 前端环境变量
cat > frontend/.env << EOF
VITE_API_URL=http://localhost/api
NODE_ENV=production
DEBUG=false
EOF

echo "前端环境变量已配置"

# 配置Docker Compose
echo "使用docker-compose部署应用..."

# 启动所有服务
sudo docker-compose up -d

# 检查部署状态
echo "检查服务状态..."
sleep 10  # 给服务一些启动时间
sudo docker-compose ps

# 获取公网IP
PUBLIC_IP=$(curl -s ifconfig.me)

# 显示部署信息
echo "==========================================="
echo "部署完成！"
echo "==========================================="
echo "访问地址: http://$PUBLIC_IP"
echo "API地址: http://$PUBLIC_IP/api"
echo ""
echo "查看服务状态: sudo docker-compose ps"
echo "查看日志: sudo docker-compose logs -f"
echo "==========================================="

# 提示如何进行数据库初始化
echo "注意: 如需初始化数据库，请执行以下命令:"
echo "docker exec -it backend npm run init-db"  # 如果项目中有数据库初始化脚本