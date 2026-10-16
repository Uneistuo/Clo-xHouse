# 微信云托管部署镜像
# 后端依赖 mysql2（连接云托管 MySQL），Node 18+ 即可；沿用 node:22 保持一致
FROM node:22-alpine

# 时区设为东八区，保证 nowStr() 生成北京时间（授权到期/订单时间比较依赖服务器本地时间）
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

# 生产模式：未配置 JWT_SECRET 环境变量时服务将拒绝启动（安全要求，P0-1）
ENV NODE_ENV=production

WORKDIR /app

# 先复制依赖清单并安装，充分利用镜像层缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再复制业务代码（.dockerignore 已排除 node_modules / data / uploads 等）
COPY . .

# 云托管会通过 PORT 环境变量注入监听端口，config.js 已读取该变量
# MySQL 连接信息由云托管自动注入：MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD
ENV PORT=3000
EXPOSE 3000

# 启动后端（db.js 会自动建库建表并初始化默认管理员）
CMD ["node", "server.js"]
