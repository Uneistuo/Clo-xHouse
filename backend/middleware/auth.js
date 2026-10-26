/**
 * 登录鉴权中间件
 * 校验 JWT；允许"已注册但未绑定店铺"的用户通过（用于店铺创建/绑定等接口）
 * 注意：店铺绑定状态（storeId/role）每次从数据库实时读取，而非信任 Token 内的旧值，
 *      保证解绑/换绑店铺后旧 Token 立即失效，商品/订单数据权限实时同步
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
  try {
    // 以数据库中的最新账号状态为准（账号被删 / 绑定关系变更即时生效）
    const admin = await db.get('SELECT id, username, store_id, role, is_platform FROM admin WHERE id = ?', [
      payload.id
    ]);
    if (!admin) {
      return res.status(401).json({ code: 401, message: '账号不存在，请重新登录' });
    }
    req.admin = {
      id: admin.id,
      username: admin.username,
      storeId: admin.store_id,
      role: admin.role,
      isPlatform: !!admin.is_platform // 平台管理员（控制店铺开单白名单）
    };
    next();
  } catch (e) {
    return res.status(500).json({ code: 1, message: '服务器内部错误' });
  }
};
