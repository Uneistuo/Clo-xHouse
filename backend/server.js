/**
 * 服务入口：Express 应用组装与启动
 * 启动命令：npm start        （生产模式：必须配置 JWT_SECRET）
 *          npm run start:dev（开发模式：使用内置开发密钥）
 *
 * 注意：MySQL 初始化（建库建表 + 默认管理员）完成后才启动 HTTP 服务。
 * 导出 createApp() 供集成测试（jest + supertest）直接挂载使用，无需真实监听端口/数据库。
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');
const { init, closePool, db } = require('./db');

const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/store');
const goodsRoutes = require('./routes/goods');
const categoryRoutes = require('./routes/category');
const orderRoutes = require('./routes/orders');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');
const platformRoutes = require('./routes/platform');
const customerRoutes = require('./routes/customer');

/** Promise 超时包装（健康检查等快速失败场景用） */
function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || 'timeout')), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

/** 组装 Express 应用（测试可直接 require('../server').createApp()） */
function createApp() {
  const app = express();

  // 位于微信云托管网关之后：信任第一层代理的 X-Forwarded-For，保证限流按真实客户端 IP 统计
  app.set('trust proxy', 1);

  // 确保图片上传目录存在（未配置 COS 时本地保存）
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

  // ---- 请求 ID 与访问日志（P2-1）：每个请求生成 reqId，错误日志带请求上下文 ----
  app.use((req, res, next) => {
    req.id = String(req.headers['x-request-id'] || crypto.randomUUID());
    req.log = logger.child({ reqId: req.id });
    const start = Date.now();
    res.on('finish', () => {
      req.log.debug(
        { method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - start },
        'request finished'
      );
    });
    next();
  });

  // ---- CORS（P0-3）：仅放行配置的浏览器来源；无 Origin 的小程序请求不受影响 ----
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true); // 小程序 wx.request / curl 等不带 Origin
        if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
        // 本地开发时放行 localhost 调试来源（生产环境不放行）
        if (!config.IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        logger.warn({ origin }, 'cors blocked');
        return callback(null, false); // 不抛错，仅不返回 CORS 头，由浏览器拦截
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      maxAge: 86400
    })
  );

  app.use(express.json({ limit: '1mb' })); // 解析 JSON 请求体
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/uploads', express.static(config.UPLOAD_DIR)); // 商品图片静态访问（本地存储模式）

  // 业务路由挂载
  app.use('/api/auth', authRoutes); // 登录/注册
  app.use('/api/store', storeRoutes); // 店铺创建/绑定/解绑
  app.use('/api/goods', goodsRoutes); // 商品
  app.use('/api/category', categoryRoutes); // 分类
  app.use('/api/orders', orderRoutes); // 订单
  app.use('/api/stats', statsRoutes); // 统计
  app.use('/api/upload', uploadRoutes); // 图片上传
  app.use('/api/platform', platformRoutes); // 平台管理（开单白名单）
  app.use('/api/customer', customerRoutes); // 客户/会员（开单时添加/识别老客户）

  // ---- Swagger API 在线文档（P3-3）：/api-docs，可用 ENABLE_API_DOCS=false 关闭 ----
  if (config.ENABLE_API_DOCS) {
    try {
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('./swagger');
      app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
      app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
          customSiteTitle: '服装店管理系统 API 文档'
        })
      );
    } catch (e) {
      logger.warn({ err: e }, 'swagger docs disabled: failed to initialize');
    }
  }

  // ---- 健康检查（P2-2）：数据库连接状态 + 内存占用 + 版本号 + 运行时间 ----
  app.get('/api/health', async (req, res) => {
    const mem = process.memoryUsage();
    const base = {
      version: config.VERSION,
      env: config.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      timestamp: new Date().toISOString()
    };
    try {
      await withTimeout(db.get('SELECT 1 AS ok'), 2000, 'db health check timeout');
      res.json({ code: 0, message: 'ok', data: { status: 'up', db: 'up', ...base } });
    } catch (e) {
      (req.log || logger).error({ err: e }, 'health check failed: database unavailable');
      res.status(503).json({ code: 1, message: '数据库不可用', data: { status: 'down', db: 'down', ...base } });
    }
  });

  // 未匹配的 API 路径统一返回 JSON（避免小程序收到 HTML 404 页面）
  app.use('/api', (req, res) => res.status(404).json({ code: 1, message: '接口不存在' }));

  // ---- 统一错误处理（P0-5）：完整堆栈仅写日志，前端返回脱敏信息 ----
  app.use((err, req, res, next) => {
    const log = req.log || logger;
    if (err && err.type === 'entity.parse.failed') {
      log.warn({ err, method: req.method, url: req.originalUrl }, 'invalid request body');
      return res.status(400).json({ code: 1, message: '请求体格式错误' });
    }
    // 日志中保留完整错误堆栈与请求上下文（不包含响应体，敏感信息由 logger redact 脱敏）
    log.error({ err, method: req.method, url: req.originalUrl }, 'unhandled server error');
    if (res.headersSent) return next(err);
    res.status(500).json({ code: 1, message: '服务器内部错误' });
  });

  return app;
}

/** 优雅关闭（P2-4）：停止接收新连接 -> 等待在途请求完成 -> 关闭数据库连接池 -> 退出 */
function setupGracefulShutdown(server) {
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, '收到退出信号，开始优雅关闭（停止接收新连接）');

    // 兜底：10 秒内未完成关闭则强制退出，避免容器挂死
    const forceTimer = setTimeout(() => {
      logger.error('优雅关闭超时，强制退出');
      process.exit(1);
    }, 10 * 1000);
    forceTimer.unref();

    server.close(async (closeErr) => {
      if (closeErr) logger.error({ err: closeErr }, 'HTTP 服务关闭异常');
      try {
        await closePool();
        logger.info('数据库连接池已关闭，进程退出');
      } catch (e) {
        logger.error({ err: e }, '数据库连接池关闭失败');
      }
      process.exit(closeErr ? 1 : 0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM')); // 容器编排（云托管/部署平台）停止信号
  process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C 本地退出
}

/** 初始化数据库并启动 HTTP 服务 */
async function start() {
  await init();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: Number(config.PORT), env: config.NODE_ENV, version: config.VERSION },
      '服装店商家管理后端已启动'
    );
    logger.info({ host: config.MYSQL.host, port: config.MYSQL.port, database: config.MYSQL.database }, '数据库: MySQL');
    logger.info({ storage: config.COS.BUCKET ? '腾讯云 COS' : '本地磁盘（仅开发用）' }, '图片存储');
  });

  // 请求超时（P2-4）：Node HTTP Server 级超时，超时自动以 408 关闭慢连接
  server.requestTimeout = config.REQUEST_TIMEOUT_MS;
  server.headersTimeout = config.REQUEST_TIMEOUT_MS + 5000;
  server.keepAliveTimeout = 65 * 1000;

  setupGracefulShutdown(server);
  return server;
}

// 直接运行（node server.js）时启动；被测试 require 时仅导出工厂函数
if (require.main === module) {
  start().catch((err) => {
    logger.error({ err }, '数据库初始化失败，服务未启动');
    console.error('[db] 请检查 MySQL 连接配置（云托管环境变量 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD）');
    process.exit(1);
  });
}

module.exports = { createApp, start };
