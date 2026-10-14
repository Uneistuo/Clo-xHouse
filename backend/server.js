/**
 * 服务入口：Express 应用组装与启动
 * 启动命令：npm start   （默认监听 http://127.0.0.1:3000）
 * 注意：MySQL 初始化（建库建表 + 默认管理员）完成后才启动 HTTP 服务
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const config = require('./config');
const { init } = require('./db');

const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/store');
const goodsRoutes = require('./routes/goods');
const categoryRoutes = require('./routes/category');
const orderRoutes = require('./routes/orders');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');
const platformRoutes = require('./routes/platform');
const customerRoutes = require('./routes/customer');

init().then(() => {
  const app = express();

  // 确保图片上传目录存在（未配置 COS 时本地保存）
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

  app.use(cors());                                // 允许跨域（小程序开发工具请求需要）
  app.use(express.json());                        // 解析 JSON 请求体
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(config.UPLOAD_DIR)); // 商品图片静态访问（本地存储模式）

  // 业务路由挂载
  app.use('/api/auth', authRoutes);       // 登录/注册
  app.use('/api/store', storeRoutes);     // 店铺创建/绑定/解绑
  app.use('/api/goods', goodsRoutes);     // 商品
  app.use('/api/category', categoryRoutes); // 分类
  app.use('/api/orders', orderRoutes);    // 订单
  app.use('/api/stats', statsRoutes);     // 统计
  app.use('/api/upload', uploadRoutes);   // 图片上传
  app.use('/api/platform', platformRoutes); // 平台管理（开单白名单）
  app.use('/api/customer', customerRoutes); // 客户/会员（开单时添加/识别老客户）

  // 健康检查
  app.get('/api/health', (req, res) => res.json({ code: 0, message: 'ok' }));

  // 统一错误处理
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(500).json({ code: 1, message: err.message || '服务器内部错误' });
  });

  app.listen(config.PORT, () => {
    console.log(`[server] 服装店商家管理后端已启动: http://127.0.0.1:${config.PORT}`);
    console.log(`[server] 数据库: MySQL ${config.MYSQL.host}:${config.MYSQL.port}/${config.MYSQL.database}`);
    console.log(`[server] 图片存储: ${config.COS.BUCKET ? '腾讯云 COS' : '本地磁盘（仅开发用）'}`);
  });
}).catch((err) => {
  console.error('[db] 初始化失败，服务未启动:', err.message);
  console.error('[db] 请检查 MySQL 连接配置（云托管环境变量 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD）');
  process.exit(1);
});
