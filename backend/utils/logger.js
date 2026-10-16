/**
 * 结构化日志模块（P2-1）
 * - 基于 pino：支持日志分级（trace/debug/info/warn/error/fatal）
 * - 生产环境输出 JSON 单行日志，便于云日志平台采集与按级别过滤
 * - 开发环境（NODE_ENV=development）使用 pino-pretty 彩色输出，便于本地调试
 * - 错误日志通过 { err } 传入原始 Error，自动序列化 name/message/stack
 *
 * 用法：
 *   const logger = require('./utils/logger');
 *   logger.info({ orderId }, 'order created');
 *   logger.error({ err }, 'unhandled error');
 *   const reqLog = logger.child({ reqId });   // 请求级子日志（带请求 ID 上下文）
 */
const pino = require('pino');
const config = require('../config');

const options = {
  level: config.LOG_LEVEL,
  base: { service: 'clothing-store-admin', version: config.VERSION },
  // 敏感字段脱敏：即使误记录也不会把密码/密钥写进日志（P0-5）
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      '*.authorization',
      'JWT_SECRET',
      'MYSQL.password',
      '*.secret',
      '*.secretKey'
    ],
    censor: '[redacted]'
  }
};

// 开发环境彩色可读输出；生产环境保持 JSON（不依赖 pino-pretty，避免其被部署进生产）
if (!config.IS_PROD) {
  let prettyAvailable = false;
  try {
    require.resolve('pino-pretty');
    prettyAvailable = true;
  } catch (e) {
    prettyAvailable = false;
  }
  if (prettyAvailable) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname,service,version' }
    };
  }
}

module.exports = pino(options);
