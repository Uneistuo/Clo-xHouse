/**
 * 平台管理接口（仅小程序平台管理员可用，控制各店铺的开单白名单时效与改名）
 * GET  /api/platform/stores              店铺列表（含店主/成员数/订单数/开单授权状态/改名资格）
 * POST /api/platform/stores/:id/billing  设置开单授权时效 { days: 天数 } 或 { expireAt: 'YYYY-MM-DD[ HH:mm[:ss]]' }
 *                                        days<=0 / 不传 -> 关闭授权（立即生效，开单请求实时校验）
 * POST /api/platform/stores/:id/rename   修改任意店铺名称 { storeName }（无冷却，名称全库唯一）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr } = require('../db');
const auth = require('../middleware/auth');
const requirePlatform = require('../middleware/requirePlatform');

router.use(auth, requirePlatform);

/** 店铺名是否已被其他店铺占用（store_id 参数用于改名时排除自己） */
async function nameExists(name, excludeStoreId = 0) {
  const row = await db.get('SELECT id FROM store WHERE name = ? AND id != ?', [name, excludeStoreId]);
  return !!row;
}

/** 格式化时间：YYYY-MM-DD HH:mm:ss */
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 解析 'YYYY-MM-DD HH:mm:ss' 为时间戳（兼容 iOS 风格） */
function parseTs(str) {
  return new Date(String(str).replace(/-/g, '/')).getTime();
}

// ============ 店铺列表（含授权状态、改名资格） ============
router.get('/stores', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT s.id, s.name, s.bind_code, s.billing_expire_at, s.renamed_at, s.created_at,
             (SELECT username FROM admin WHERE id = s.owner_id) AS owner_name,
             (SELECT COUNT(*) FROM admin WHERE store_id = s.id) AS member_count,
             (SELECT COUNT(*) FROM orders WHERE store_id = s.id) AS order_count
      FROM store s
      ORDER BY s.id DESC
    `);
    const now = Date.now();
    const list = rows.map((s) => {
      const expireAt = s.billing_expire_at || '';
      const ts = expireAt ? parseTs(expireAt) : 0;
      const enabled = ts > now;
      return {
        id: s.id,
        name: s.name,
        bind_code: s.bind_code,
        created_at: s.created_at,
        owner_name: s.owner_name,
        member_count: s.member_count,
        order_count: s.order_count,
        expireAt,                                                    // 到期时间（空=未授权）
        enabled,                                                     // 当前是否有效
        daysLeft: enabled ? Math.ceil((ts - now) / 86400000) : 0,    // 剩余天数（向上取整）
        renamedAt: s.renamed_at || ''                                // 上次改名时间（仅审计，无冷却）
      };
    });
    res.json({ code: 0, data: { list } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 设置开单授权时效（变更即时生效） ============
router.post('/stores/:id/billing', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const store = await db.get('SELECT * FROM store WHERE id = ?', [id]);
    if (!store) return res.json({ code: 1, message: '店铺不存在' });

    const body = req.body || {};
    let expireAt = '';

    if (body.expireAt) {
      // 自定义到期时间：支持 'YYYY-MM-DD'（默认当日 23:59:59）或 'YYYY-MM-DD HH:mm[:ss]'
      let str = String(body.expireAt).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) str += ' 23:59:59';
      else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) str += ':00';
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str) || isNaN(parseTs(str))) {
        return res.json({ code: 1, message: '到期时间格式不正确' });
      }
      expireAt = str;
    } else {
      // 按天数授权（从当前时间起算）；days <= 0 或不传 = 关闭授权
      const days = parseInt(body.days, 10);
      if (days > 0) {
        expireAt = fmt(new Date(Date.now() + days * 86400000));
      }
    }

    await db.run('UPDATE store SET billing_expire_at = ? WHERE id = ?', [expireAt, id]);
    res.json({
      code: 0,
      data: { expireAt },
      message: expireAt
        ? `已授权店铺【${store.name}】开单至 ${expireAt}`
        : `已关闭店铺【${store.name}】的开单权限`
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 修改任意店铺名称（仅平台管理员，无冷却，名称全库唯一） ============
router.post('/stores/:id/rename', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ code: 1, message: '参数错误' });
    const store = await db.get('SELECT * FROM store WHERE id = ?', [id]);
    if (!store) return res.json({ code: 1, message: '店铺不存在' });

    const storeName = String((req.body || {}).storeName || '').trim();
    if (!storeName) return res.json({ code: 1, message: '请填写新的店铺名称' });
    if (storeName === store.name) return res.json({ code: 1, message: '新名称与当前名称相同' });
    if (storeName.length > 30) return res.json({ code: 1, message: '店铺名称不能超过 30 个字' });
    if (await nameExists(storeName, store.id)) {
      return res.json({ code: 1, message: '该店铺名称已被使用，请换一个名称' });
    }
    await db.run('UPDATE store SET name = ?, renamed_at = ? WHERE id = ?', [storeName, nowStr(), store.id]);
    res.json({ code: 0, data: { storeName }, message: `店铺【${store.name}】已改名为【${storeName}】` });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
