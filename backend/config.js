/**
 * 后端全局配置文件
 * 部署时主要修改这里（或通过环境变量覆盖）
 *
 * MySQL 连接（微信云托管部署）：
 *  - 云托管控制台开通 MySQL 后，自动注入环境变量 MYSQL_ADDRESS（内网地址 host:port）/ MYSQL_USERNAME / MYSQL_PASSWORD
 *  - 本地开发可用 MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE 覆盖
 *
 * 图片持久化（可选）：
 *  - 配置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION 后，图片存腾讯云对象存储（COS）
 *  - 未配置时回落到容器本地磁盘（仅本地开发用，容器重新部署会丢失）
 */
const path = require('path');

// 微信云托管注入的连接地址格式为 "10.x.x.x:3306"
const mysqlAddr = String(process.env.MYSQL_ADDRESS || '').split(':');

module.exports = {
  // 服务监听端口
  PORT: process.env.PORT || 3000,

  // MySQL 连接配置（云托管环境变量优先，本地开发用 MYSQL_* 覆盖）
  MYSQL: {
    host: process.env.MYSQL_HOST || mysqlAddr[0] || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || mysqlAddr[1] || '3306', 10),
    user: process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'clothing_store'
  },

  // JWT 密钥：生产环境务必修改为一个随机长字符串
  JWT_SECRET: process.env.JWT_SECRET || 'clothing-store-secret-change-me',

  // 登录态有效期（7 天，配合小程序 Storage 实现登录持久化）
  JWT_EXPIRES: '7d',

  // 商品图片上传保存目录（未配置 COS 时使用，仅本地开发）
  UPLOAD_DIR: path.join(__dirname, 'uploads'),

  // 腾讯云对象存储 COS（配置后图片持久化，不随容器销毁丢失）
  COS: {
    SECRET_ID: process.env.COS_SECRET_ID || '',
    SECRET_KEY: process.env.COS_SECRET_KEY || '',
    BUCKET: process.env.COS_BUCKET || '',
    REGION: process.env.COS_REGION || ''
  }
};
