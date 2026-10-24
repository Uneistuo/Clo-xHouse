/**
 * 数据统计接口
 * GET /api/stats/dashboard?range=today|week|month  首页统计面板
 *   - 兼容旧字段（todaySales / todayOrders 等，始终为"今日"）
 *   - 新增周期字段：periodSales / periodOrders（按 range）
 *   - trend：近 7 天销售额与订单数（补齐缺失日期）
 *   - lowStock：库存不足商品（<= LOW_STOCK）
 *   - topProducts：周期内热销商品（按销量）
 *   - 销售额仅统计"已收款+已完成"（取消/退款/待收款不计入）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr, daysAgoStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

/**
 * @openapi
 * /api/stats/dashboard:
 *   get:
 *     tags: [统计]
 *     summary: 首页数据面板（商品/订单/销售额/趋势/低库存/热销）
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [today, week, month], default: today } }
 *     responses:
 *       200:
 *         description: >-
 *           data = { goodsTotal, goodsOnSale, goodsOffSale, todayOrders, todaySales, pendingOrders,
 *           range, periodOrders, periodSales, trend[], lowStock[], topProducts[] }
 *           销售额仅统计已收款/已完成订单
 */

/** 低库存阈值（与小程序端保持一致） */
const LOW_STOCK = 5;

/** 周期起始时间字符串 */
function rangeStart(range) {
  if (range === 'week') return daysAgoStr(7);
  if (range === 'month') return daysAgoStr(30);
  return nowStr().slice(0, 10); // today：今日零点（字符串前缀比较）
}

/** 上一周期时间范围 [start, end)，用于销售环比标签 */
function previousRange(range) {
  if (range === 'week') return { start: daysAgoStr(14), end: daysAgoStr(7) };
  if (range === 'month') return { start: daysAgoStr(60), end: daysAgoStr(30) };
  return { start: daysAgoStr(1), end: nowStr().slice(0, 10) }; // today：昨日零点 ~ 今日零点
}

/** 会员姓名显示（与 customer 路由规则一致：姓氏 + 先生/女士） */
function customerDisplayName(surname, gender) {
  const suffix = gender === 1 ? '先生' : gender === 2 ? '女士' : '';
  return `${surname || ''}${suffix}`;
}

/** 距下次生日的天数（含今天；生日为空/非法返回 null） */
function daysToBirthday(birthday) {
  const m = Number(String(birthday).slice(5, 7));
  const d = Number(String(birthday).slice(8, 10));
  if (!m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), m - 1, d);
  if (target < today) target = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((target - today) / 86400000);
}

router.get('/dashboard', async (req, res) => {
  try {
    const storeId = req.admin.storeId;
    const range = ['today', 'week', 'month'].includes(req.query.range) ? req.query.range : 'today';
    const start = rangeStart(range);
    const todayStr = nowStr().slice(0, 10);

    // 商品统计（空表时 SUM 返回 null，用 COALESCE 兜底为 0；仅统计当前店铺）
    const goods = await db.get(
      `
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN on_sale = 1 THEN 1 ELSE 0 END), 0) AS on_sale_count,
             COALESCE(SUM(CASE WHEN on_sale = 0 THEN 1 ELSE 0 END), 0) AS off_sale_count
      FROM goods WHERE is_deleted = 0 AND store_id = ?
    `,
      [storeId]
    );

    // 今日（兼容旧字段）
    const today = await db.get(
      `
      SELECT COUNT(*) AS order_count,
             COALESCE(SUM(CASE WHEN status IN ('paid','done') THEN total_amount ELSE 0 END), 0) AS sales_amount
      FROM orders WHERE store_id = ? AND created_at >= ?
    `,
      [storeId, todayStr]
    );

    // 周期（按 range）
    const period = await db.get(
      `
      SELECT COUNT(*) AS order_count,
             COALESCE(SUM(CASE WHEN status IN ('paid','done') THEN total_amount ELSE 0 END), 0) AS sales_amount
      FROM orders WHERE store_id = ? AND created_at >= ?
    `,
      [storeId, start]
    );

    // 上一周期（销售环比标签）
    const prev = previousRange(range);
    const previous = await db.get(
      `
      SELECT COUNT(*) AS order_count,
             COALESCE(SUM(CASE WHEN status IN ('paid','done') THEN total_amount ELSE 0 END), 0) AS sales_amount
      FROM orders WHERE store_id = ? AND created_at >= ? AND created_at < ?
    `,
      [storeId, prev.start, prev.end]
    );

    // 会员生日提醒（未来 3 天内，含今天）
    const birthdayRows = await db.all(
      "SELECT id, surname, gender, phone, birthday FROM customer WHERE store_id = ? AND birthday != ''",
      [storeId]
    );
    const birthdays = birthdayRows
      .map((r) => ({
        id: r.id,
        name: customerDisplayName(r.surname, r.gender),
        phone: r.phone,
        birthday: r.birthday,
        daysLeft: daysToBirthday(r.birthday)
      }))
      .filter((r) => r.daysLeft !== null && r.daysLeft <= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);

    // 待收款订单数（全部时间累计）
    const pendingRow = await db.get('SELECT COUNT(*) AS c FROM orders WHERE store_id = ? AND status = ?', [
      storeId,
      'pending'
    ]);

    // 近 7 天趋势（按天分组，缺失日期补 0）
    const trendRows = await db.all(
      `
      SELECT SUBSTRING(created_at, 1, 10) AS d,
             COALESCE(SUM(CASE WHEN status IN ('paid','done') THEN total_amount ELSE 0 END), 0) AS amount,
             COUNT(*) AS orders
      FROM orders WHERE store_id = ? AND created_at >= ?
      GROUP BY d
    `,
      [storeId, daysAgoStr(7)]
    );
    const trendMap = {};
    trendRows.forEach((r) => {
      trendMap[r.d] = r;
    });
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const p = (n) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const row = trendMap[key] || { amount: 0, orders: 0 };
      trend.push({ date: key.slice(5), amount: Math.round((row.amount || 0) * 100) / 100, orders: row.orders || 0 });
    }

    // 低库存商品
    const lowStock = await db.all(
      'SELECT id, name, stock FROM goods WHERE is_deleted = 0 AND store_id = ? AND stock <= ? ORDER BY stock ASC, id DESC LIMIT 10',
      [storeId, LOW_STOCK]
    );

    // 周期内热销商品（按销量）
    const topProducts = await db.all(
      `
      SELECT oi.goods_name AS name, SUM(oi.quantity) AS quantity
      FROM order_item oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ? AND o.created_at >= ? AND o.status IN ('paid','done')
      GROUP BY oi.goods_name
      ORDER BY quantity DESC
      LIMIT 5
    `,
      [storeId, start]
    );

    // 环比计算：上期无销售额时 percent 为 null（前端显示"新增"或不显示百分比）
    const curSales = Math.round((period.sales_amount || 0) * 100) / 100;
    const prevSales = Math.round((previous.sales_amount || 0) * 100) / 100;
    const salesDiff = Math.round((curSales - prevSales) * 100) / 100;
    const salesPercent = prevSales > 0 ? Math.round((salesDiff / prevSales) * 1000) / 10 : null;
    const salesDirection = salesDiff > 0 ? 'up' : salesDiff < 0 ? 'down' : 'flat';

    res.json({
      code: 0,
      data: {
        // 商品
        goodsTotal: goods.total || 0,
        goodsOnSale: goods.on_sale_count || 0,
        goodsOffSale: goods.off_sale_count || 0,
        // 今日（兼容旧字段）
        todayOrders: today.order_count || 0,
        todaySales: Math.round((today.sales_amount || 0) * 100) / 100,
        pendingOrders: pendingRow.c || 0,
        // 周期
        range,
        periodOrders: period.order_count || 0,
        periodSales: curSales,
        // 环比（较上一周期）
        compare: {
          prevSales,
          prevOrders: previous.order_count || 0,
          diff: salesDiff,
          percent: salesPercent,
          direction: salesDirection
        },
        // 会员生日提醒
        birthdayCount: birthdays.length,
        birthdays,
        // 趋势 / 低库存 / 热销
        trend,
        lowStock,
        topProducts
      }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
