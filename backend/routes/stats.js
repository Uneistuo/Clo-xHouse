/**
 * 数据统计接口
 * GET /api/stats/dashboard  首页统计面板
 *   - 今日销售额：仅统计"已收款+已完成"（取消/退款/待收款不计入）
 *   - 今日订单数：今天创建的全部订单
 *   - 待收款：所有状态为待收款的订单数
 *   - 商品：总数 / 在售 / 下架（不含已删除）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

router.get('/dashboard', async (req, res) => {
  try {
    const storeId = req.admin.storeId;
    // 商品统计（空表时 SUM 返回 null，用 COALESCE 兜底为 0；仅统计当前店铺）
    const goods = await db.get(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN on_sale = 1 THEN 1 ELSE 0 END), 0) AS on_sale_count,
             COALESCE(SUM(CASE WHEN on_sale = 0 THEN 1 ELSE 0 END), 0) AS off_sale_count
      FROM goods WHERE is_deleted = 0 AND store_id = ?
    `, [storeId]);

    // 今日订单数 / 今日销售额（销售额仅计已收款+已完成；时间列为 'YYYY-MM-DD HH:mm:ss' 字符串，
    // 与 'YYYY-MM-DD' 前缀比较即等价于 created_at >= 今日零点）
    const today = await db.get(`
      SELECT COUNT(*) AS order_count,
             COALESCE(SUM(CASE WHEN status IN ('paid','done') THEN total_amount ELSE 0 END), 0) AS sales_amount
      FROM orders
      WHERE store_id = ? AND created_at >= ?
    `, [storeId, nowStr().slice(0, 10)]);

    // 待收款订单数（全部时间累计）
    const pendingRow = await db.get('SELECT COUNT(*) AS c FROM orders WHERE store_id = ? AND status = ?', [storeId, 'pending']);

    res.json({
      code: 0,
      data: {
        goodsTotal: goods.total || 0,
        goodsOnSale: goods.on_sale_count || 0,
        goodsOffSale: goods.off_sale_count || 0,
        todayOrders: today.order_count || 0,
        todaySales: Math.round((today.sales_amount || 0) * 100) / 100,
        pendingOrders: pendingRow.c || 0
      }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
