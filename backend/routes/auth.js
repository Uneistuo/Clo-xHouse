/**
 * 商家账号接口（自由注册 + 绑定店铺模式）
 * POST /api/auth/register  注册 { username, password }        —— 注册不建店，注册后可创建店铺或用店铺码加入
 * POST /api/auth/login     登录 { username, password }
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const config = require('../config');

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
  return db.get(`
    SELECT a.id, a.username, a.store_id, a.role, a.is_platform, s.name AS store_name, s.bind_code
    FROM admin a LEFT JOIN store s ON s.id = a.store_id
    WHERE a.username = ?
  `, [username]);
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

// ============ 注册（不建店，不受限制） ============
router.post('/register', async (req, res) => {
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

    await db.run("INSERT INTO admin (username, password, store_id, role) VALUES (?, ?, 0, 'staff')",
      [username, bcrypt.hashSync(password, 10)]);

    const admin = await findAdminView(username);
    res.json({
      code: 0,
      data: { token: signToken(admin), admin: adminPayload(admin) },
      message: '注册成功'
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 登录 ============
router.post('/login', async (req, res) => {
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
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
