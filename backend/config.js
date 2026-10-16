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
const pkg = require('./package.json');

// 微信云托管注入的连接地址格式为 "10.x.x.x:3306"
const mysqlAddr = String(process.env.MYSQL_ADDRESS || '').split(':');

// 运行环境：默认视为生产环境（微信云托管不会设置 NODE_ENV）。
// 本地开发请通过 `npm run start:dev`（等价于 NODE_ENV=development）启动
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_PROD = NODE_ENV === 'production';

// ---- 安全：JWT 密钥 ----
// 生产环境必须通过环境变量 JWT_SECRET 提供足够长的随机密钥，否则拒绝启动（P0-1）
const DEV_JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';
let jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) {
  if (IS_PROD) {
    throw new Error(
      '[config] 生产环境未设置 JWT_SECRET 环境变量，拒绝启动。\n' +
        '  请在部署环境（如微信云托管「服务设置-环境变量」）中配置一个足够长的随机字符串，例如：\n' +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  jwtSecret = DEV_JWT_SECRET;
  // 开发环境仅用于本机调试，禁止部署上线
  console.warn('[config] 当前为开发环境，使用内置开发 JWT 密钥（生产环境必须配置 JWT_SECRET）');
}

// ---- 跨域白名单（P0-3）----
// 浏览器端（Web 管理后台）来源；多个用英文逗号分隔，通过环境变量 CORS_ORIGIN 覆盖
// 小程序 wx.request 不带 Origin 头，不受该白名单影响
const DEFAULT_CORS_ORIGINS = ['https://uneistuo.github.io'];
const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  // 服务监听端口
  PORT: process.env.PORT || 3000,

  // 运行环境标识
  NODE_ENV,
  IS_PROD,

  // 服务版本号（健康检查 / Swagger 文档展示）
  VERSION: pkg.version,

  // MySQL 连接配置（云托管环境变量优先，本地开发用 MYSQL_* 覆盖）
  MYSQL: {
    host: process.env.MYSQL_HOST || mysqlAddr[0] || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || mysqlAddr[1] || '3306', 10),
    user: process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'clothing_store'
  },

  // JWT 密钥：生产环境必须通过环境变量设置（见上方校验逻辑）
  JWT_SECRET: jwtSecret,

  // 登录态有效期（7 天，配合小程序 Storage 实现登录持久化）
  JWT_EXPIRES: '7d',

  // 登录/注册接口频率限制（P0-2）：默认 15 分钟窗口，每 IP 最多 10 次
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10
  },

  // CORS 允许的浏览器来源（P0-3）：环境变量 CORS_ORIGIN 覆盖默认值
  CORS_ORIGINS: corsOrigins.length ? corsOrigins : DEFAULT_CORS_ORIGINS,

  // 日志级别（P2-1）：trace/debug/info/warn/error/fatal，默认 info
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // 请求超时时间（P2-4，毫秒）：Node HTTP Server requestTimeout
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 60 * 1000,

  // 图片上传大小上限（P0-4，字节）
  UPLOAD_MAX_BYTES: parseInt(process.env.UPLOAD_MAX_BYTES, 10) || 5 * 1024 * 1024,

  // 是否开放 Swagger 在线文档（P3-3）：生产环境可通过 ENABLE_API_DOCS=false 关闭
  ENABLE_API_DOCS: process.env.ENABLE_API_DOCS !== 'false',

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
