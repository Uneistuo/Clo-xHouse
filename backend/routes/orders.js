/**
 * 订单接口（商家现场出单 + 订单管理）
 * POST  /api/orders                创建订单（商家开单）：事务内校验库存 -> 写订单/明细 -> 扣减库存
 * GET   /api/orders                订单列表（状态筛选、订单号搜索、时间范围、分页）
 * GET   /api/orders/:id            订单详情（含商品明细）
 * PUT   /api/orders/:id/status     修改订单状态（仅允许正向流转：待收款→已收款→已完成）
 * POST  /api/orders/:id/cancel     取消订单（自动归还商品库存）
 * POST  /api/orders/:id/refund     退款处理（自动归还商品库存，状态置为已退款）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr, daysAgoStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

// 订单状态字典（done=交易完成待售后；refunded=售后已处理）
const STATUS = { pending: '待收款', paid: '已收款', done: '待售后', cancelled: '已取消', refunded: '已售后' };
// 允许的正向状态流转
const FORWARD = { pending: 'paid', paid: 'done' };
const r2 = (n) => Math.round(n * 100) / 100;

/** 生成订单号：SO + 日期 + 6位随机数 */
function genOrderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 900000) + 100000);
  return `SO${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${rand}`;
}

/** 归还订单明细库存：优先归还对应规格（SKU），同时累加商品总库存 */
async function restoreStock(tx, items) {
  const now = nowStr();
  for (const it of items) {
    await tx.run('UPDATE goods_sku SET stock = stock + ? WHERE goods_id = ? AND color = ? AND size = ?',
      [it.quantity, it.goods_id, it.color || '', it.size || '']);
    await tx.run('UPDATE goods SET stock = stock + ?, updated_at = ? WHERE id = ?', [it.quantity, now, it.goods_id]);
  }
}

// ============ 创建订单（商家现场开单） ============
// 事务保证：订单、明细、库存扣减要么全部成功，要么全部回滚
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const customerPhone = String(body.customerPhone || '').trim();
    const remark = String(body.remark || '').trim();
    const payMethod = 'offline'; // 当前仅线下收款（现金/顾客微信转账给店主）
    const paidNow = !!body.paidNow; // 商家确认顾客已现场付款 -> 直接标记为已收款

    if (items.length === 0) return res.json({ code: 1, message: '订单商品不能为空' });

    // 开单白名单时效校验（每次实时查库，管理员授权/关闭/到期即时生效）
    const store = await db.get('SELECT billing_expire_at FROM store WHERE id = ?', [req.admin.storeId]);
    const now = nowStr();
    if (!store || !store.billing_expire_at || store.billing_expire_at <= now) {
      const reason = store && store.billing_expire_at
        ? `开单授权已于 ${store.billing_expire_at} 到期`
        : '开单功能未开通';
      return res.json({ code: 1002, message: `${reason}：请联系平台管理员授权或续期` });
    }

    const result = await db.transaction(async (tx) => {
      let total = 0;
      const rows = [];
      // 1. 逐项校验商品与规格（SKU）库存
      for (const it of items) {
        const qty = parseInt(it.quantity, 10);
        if (!it.goodsId || !qty || qty < 1) throw new Error('商品或数量不合法');
        const g = await tx.get('SELECT * FROM goods WHERE id = ? AND store_id = ? AND is_deleted = 0',
          [it.goodsId, req.admin.storeId]);
        if (!g) throw new Error('商品不存在或已删除');
        const color = String(it.color || '').trim();
        const size = String(it.size || '').trim();
        // 查找对应规格 SKU（商品无规格时匹配空规格行）
        const sku = await tx.get(
          'SELECT * FROM goods_sku WHERE goods_id = ? AND color = ? AND size = ?',
          [g.id, color, size]
        );
        const skuCountRow = await tx.get('SELECT COUNT(*) AS c FROM goods_sku WHERE goods_id = ?', [g.id]);
        if (skuCountRow.c > 0 && !sku) {
          throw new Error(`商品【${g.name}】不存在规格【${color || '默认'} / ${size || '默认'}】`);
        }
        const avail = sku ? sku.stock : g.stock; // 无 SKU 行时兼容按商品总库存
        if (avail < qty) {
          throw new Error(`商品【${g.name}】规格【${color || '默认'} / ${size || '默认'}】库存不足（当前库存 ${avail}）`);
        }
        total = r2(total + r2(g.price * qty));
        rows.push({ goodsId: g.id, goodsNo: g.goods_no || '', goodsName: g.name, color, size, quantity: qty, price: g.price, skuId: sku ? sku.id : null });
      }
      // 2. 写入订单主表
      const orderNo = genOrderNo();
      const info = await tx.run(`
        INSERT INTO orders (order_no, total_amount, pay_method, status, customer_phone, remark, store_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderNo, total, payMethod, paidNow ? 'paid' : 'pending', customerPhone, remark, req.admin.storeId, now, now]);
      const orderId = info.insertId;
      // 3. 写入订单明细 + 原子扣减规格（SKU）库存与商品总库存（WHERE stock >= ? 防止并发超卖）
      for (const r of rows) {
        await tx.run('INSERT INTO order_item (order_id, goods_id, goods_no, goods_name, color, size, quantity, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [orderId, r.goodsId, r.goodsNo, r.goodsName, r.color, r.size, r.quantity, r.price]);
        if (r.skuId) {
          const dr = await tx.run('UPDATE goods_sku SET stock = stock - ? WHERE id = ? AND stock >= ?',
            [r.quantity, r.skuId, r.quantity]);
          if (dr.changes === 0) {
            throw new Error(`商品【${r.goodsName}】规格【${r.color || '默认'} / ${r.size || '默认'}】库存不足`);
          }
        }
        const dg = await tx.run('UPDATE goods SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?',
          [r.quantity, now, r.goodsId, r.quantity]);
        if (dg.changes === 0) {
          throw new Error(`商品【${r.goodsName}】库存不足`);
        }
      }
      return { id: orderId, orderNo, totalAmount: total, status: paidNow ? 'paid' : 'pending' };
    });

    res.json({ code: 0, data: result, message: '开单成功' });
  } catch (e) {
    res.json({ code: 1, message: e.message || '开单失败' });
  }
});

// ============ 订单列表 ============
// 查询参数：status 状态 / keyword 订单号模糊搜索 / range 时间范围(today|week|month|all) / page / pageSize
router.get('/', async (req, res) => {
  try {
    const { status = '', keyword = '', range = 'all' } = req.query;
    let where = ' WHERE o.store_id = ?';
    const params = [req.admin.storeId];
    if (status && STATUS[status]) { where += ' AND o.status = ?'; params.push(status); }
    if (keyword) { where += ' AND o.order_no LIKE ?'; params.push(`%${keyword.trim()}%`); }
    if (range === 'today') { where += ' AND o.created_at >= ?'; params.push(nowStr().slice(0, 10)); }
    else if (range === 'week') { where += ' AND o.created_at >= ?'; params.push(daysAgoStr(7)); }
    else if (range === 'month') { where += ' AND o.created_at >= ?'; params.push(daysAgoStr(30)); }

    const size = Math.min(parseInt(req.query.pageSize, 10) || 20, 200);
    const cur = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const totalRow = await db.get(`SELECT COUNT(*) AS c FROM orders o${where}`, params);
    const list = await db.all(`
      SELECT o.*,
             (SELECT COUNT(*) FROM order_item oi WHERE oi.order_id = o.id) AS item_count,
             (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_item oi WHERE oi.order_id = o.id) AS quantity_count
      FROM orders o
      ${where}
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `, [...params, size, (cur - 1) * size]);

    res.json({ code: 0, data: { list, total: totalRow.c, page: cur, pageSize: size } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 订单详情 ============
router.get('/:id', async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [req.params.id, req.admin.storeId]);
    if (!order) return res.json({ code: 1, message: '订单不存在' });
    order.items = await db.all('SELECT * FROM order_item WHERE order_id = ? ORDER BY id ASC', [order.id]);
    res.json({ code: 0, data: order });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 修改订单状态（正向流转） ============
// 待收款 -> 已收款；已收款 -> 已完成。取消/退款请使用专用接口
router.put('/:id/status', async (req, res) => {
  try {
    const target = (req.body || {}).status;
    if (!STATUS[target]) return res.json({ code: 1, message: '订单状态不合法' });
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [req.params.id, req.admin.storeId]);
    if (!order) return res.json({ code: 1, message: '订单不存在' });
    if (FORWARD[order.status] !== target) {
      return res.json({ code: 1, message: `不允许将【${STATUS[order.status]}】订单改为【${STATUS[target]}】` });
    }
    await db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [target, nowStr(), order.id]);
    res.json({ code: 0, message: `订单已${STATUS[target]}` });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 取消订单（事务：状态置为已取消 + 自动归还全部规格库存） ============
router.post('/:id/cancel', async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [req.params.id, req.admin.storeId]);
    if (!order) return res.json({ code: 1, message: '订单不存在' });
    if (!['pending', 'paid'].includes(order.status)) {
      return res.json({ code: 1, message: `【${STATUS[order.status]}】订单不可取消` });
    }
    try {
      await db.transaction(async (tx) => {
        const items = await tx.all('SELECT * FROM order_item WHERE order_id = ?', [order.id]);
        await restoreStock(tx, items);
        await tx.run("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowStr(), order.id]);
      });
      res.json({ code: 0, message: '订单已取消，商品库存已归还' });
    } catch (e) {
      res.json({ code: 1, message: e.message || '取消失败' });
    }
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 退款处理（事务：状态置为已退款 + 自动归还全部商品库存） ============
router.post('/:id/refund', async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [req.params.id, req.admin.storeId]);
    if (!order) return res.json({ code: 1, message: '订单不存在' });
    if (!['paid', 'done'].includes(order.status)) {
      return res.json({ code: 1, message: `【${STATUS[order.status]}】订单不可退款` });
    }
    try {
      await db.transaction(async (tx) => {
        const items = await tx.all('SELECT * FROM order_item WHERE order_id = ?', [order.id]);
        await restoreStock(tx, items);
        await tx.run("UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?", [nowStr(), order.id]);
      });
      res.json({ code: 0, message: '退款完成，商品库存已归还' });
    } catch (e) {
      res.json({ code: 1, message: e.message || '退款失败' });
    }
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
