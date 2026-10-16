/**
 * 商家账号接口（自由注册 + 绑定店铺模式）
 * POST /api/auth/register  注册 { username, password }        —— 注册不建店，注册后可创建店铺或用店铺码加入
 * POST /api/auth/login     登录 { username, password }
 *
 * 安全（P0-2）：登录/注册接口均带频率限制（默认 15 分钟窗口，每 IP 最多 10 次），
 * 超限返回 429 + { code: 1, message }，防止暴力破解/撞库。
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const config = require('../config');
const logger = require('../utils/logger');

/** 构造认证接口频率限制中间件（登录/注册各一个独立计数器） */
function createAuthLimiter() {
  return rateLimit({
    windowMs: config.RATE_LIMIT.WINDOW_MS,
    max: config.RATE_LIMIT.MAX,
    standardHeaders: true, // 返回 RateLimit-* 响应头
    legacyHeaders: false,
    // 超限返回结构与其他业务错误保持一致：{ code: 1, message }
    handler: (req, res) => {
      logger.warn({ ip: req.ip, url: req.originalUrl }, 'auth rate limit exceeded');
      res.status(429).json({ code: 1, message: '尝试次数过多，请 15 分钟后再试' });
    }
  });
}

/** 签发 JWT（storeId=0 表示尚未绑定店铺，绑定后重新签发/重新登录） */
function signToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, storeId: admin.store_id, role: admin.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES }
  );
}

/** 查询账号（含店铺名称），返回给前端的 admin 视图 */
async function findAdminView(username) {
  return db.get(
    `
    SELECT a.id, a.username, a.store_id, a.role, a.is_platform, s.name AS store_name, s.bind_code
    FROM admin a LEFT JOIN store s ON s.id = a.store_id
    WHERE a.username = ?
  `,
    [username]
  );
}

/** 统一构造返回给前端的 admin 对象（isPlatform 用于展示平台管理入口） */
function adminPayload(view) {
  return {
    id: view.id,
    username: view.username,
    storeId: view.store_id,
    storeName: view.store_name,
    role: view.role,
    isPlatform: !!view.is_platform
  };
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [认证]
 *     summary: 注册商家账号（不建店，注册后可创建店铺或用店铺码加入）
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: shop01, description: 3-20 位字母/数字/下划线 }
 *               password: { type: string, example: '123456', description: 6-32 位 }
 *     responses:
 *       200:
 *         description: 注册成功返回 token 与账号信息；失败返回 code=1 + message
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token: { type: string }
 *                         admin: { type: object, description: '{ id, username, storeId, storeName, role, isPlatform }' }
 *       429: { description: '频率限制（默认 15 分钟 10 次）' }
 */
// ============ 注册（不建店，不受限制） ============
router.post('/register', createAuthLimiter(), async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return res.json({ code: 1, message: '请填写账号和密码' });
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.json({ code: 1, message: '账号需为 3-20 位字母、数字或下划线' });
    }
    if (password.length < 6 || password.length > 32) {
      return res.json({ code: 1, message: '密码长度需为 6-32 位' });
    }
    const exists = await db.get('SELECT id FROM admin WHERE username = ?', [username]);
    if (exists) {
      return res.json({ code: 1, message: '该账号已被注册' });
    }

    await db.run("INSERT INTO admin (username, password, store_id, role) VALUES (?, ?, 0, 'staff')", [
      username,
      bcrypt.hashSync(password, 10)
    ]);

    const admin = await findAdminView(username);
    res.json({
      code: 0,
      data: { token: signToken(admin), admin: adminPayload(admin) },
      message: '注册成功'
    });
  } catch (e) {
    logger.error({ err: e, username }, 'register failed');
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [认证]
 *     summary: 登录（默认 15 分钟窗口每 IP 最多 10 次，超限 429）
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200:
 *         description: 登录成功返回 token 与账号信息；账号或密码错误返回 code=1
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token: { type: string }
 *                         admin: { type: object, description: '{ id, username, storeId, storeName, role, isPlatform }' }
 *       429: { description: '登录尝试次数过多' }
 */
// ============ 登录 ============
router.post('/login', createAuthLimiter(), async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.json({ code: 1, message: '请输入账号和密码' });
    }
    const admin = await db.get('SELECT * FROM admin WHERE username = ?', [String(username).trim()]);
    if (!admin || !bcrypt.compareSync(String(password), admin.password)) {
      return res.json({ code: 1, message: '账号或密码错误' });
    }
    const view = await findAdminView(admin.username);
    res.json({
      code: 0,
      data: { token: signToken(view), admin: adminPayload(view) }
    });
  } catch (e) {
    logger.error({ err: e }, 'login failed');
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
