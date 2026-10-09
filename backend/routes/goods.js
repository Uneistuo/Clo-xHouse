/**
 * 商品管理接口
 * GET    /api/goods            商品列表（支持名称搜索 keyword、上架状态筛选 status、分类筛选 categoryId、分页）
 * GET    /api/goods/:id        商品详情
 * POST   /api/goods            新增商品
 * PUT    /api/goods/:id        编辑商品（全字段）
 * PUT    /api/goods/:id/status 上下架切换 { onSale: 0|1 }
 * DELETE /api/goods/:id        逻辑删除（is_deleted 置 1，不物理删除）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore); // 以下接口均需登录且已绑定店铺

/** 读取请求体中的商品字段并校验，返回 [fields对象, 错误信息] */
function parseGoodsBody(body) {
  const name = String(body.name || '').trim();
  if (!name) return [null, '商品名称不能为空'];
  const price = Number(body.price);
  if (!(price >= 0)) return [null, '售价不能为空且必须为数字'];
  const originalPrice = Number(body.originalPrice) || 0;
  const categoryId = body.categoryId ? parseInt(body.categoryId, 10) : null;

  // 规格库存（SKU）：[{ color, size, stock }]
  // - 前端传入 skus 数组时按规格区分库存，商品总库存 = 各规格之和
  // - 未传 skus 时兼容旧的单一 stock 字段（生成一行空规格）
  let skus;
  if (Array.isArray(body.skus)) {
    skus = [];
    for (const s of body.skus) {
      const stock = parseInt(s.stock, 10);
      if (!(stock >= 0)) return [null, '各规格库存必须为不小于 0 的整数'];
      skus.push({ color: String(s.color || '').trim(), size: String(s.size || '').trim(), stock });
    }
    if (skus.length === 0) return [null, '请至少填写一个规格的库存'];
  } else {
    const stock = parseInt(body.stock, 10);
    if (!(stock >= 0)) return [null, '库存必须为不小于 0 的整数'];
    skus = [{ color: '', size: '', stock }];
  }
  const stock = skus.reduce((sum, s) => sum + s.stock, 0);

  return [{
    name,
    goodsNo: String(body.goodsNo || '').trim(),                   // 货号（选填）
    image: String(body.image || '').trim(),                      // 多图逗号分隔
    price: Math.round(price * 100) / 100,
    originalPrice: Math.round(originalPrice * 100) / 100,
    colors: String(body.colors || '').trim(),                    // 逗号分隔
    sizes: String(body.sizes || '').trim(),                      // 逗号分隔
    stock,
    skus,
    categoryId: categoryId && categoryId > 0 ? categoryId : null,
    description: String(body.description || '').trim(),
    onSale: body.onSale ? 1 : 0
  }, null];
}

/** 为商品写入规格库存行（新增/编辑时全量重建 goods_sku；tx=事务连接） */
async function saveSkus(tx, goodsId, skus) {
  await tx.run('DELETE FROM goods_sku WHERE goods_id = ?', [goodsId]);
  for (const s of skus) {
    await tx.run('INSERT INTO goods_sku (goods_id, color, size, stock) VALUES (?, ?, ?, ?)',
      [goodsId, s.color, s.size, s.stock]);
  }
}

/** 附加规格库存列表到商品对象 */
async function attachSkus(goods) {
  goods.skus = await db.all('SELECT id, color, size, stock FROM goods_sku WHERE goods_id = ? ORDER BY id ASC', [goods.id]);
  return goods;
}

// 商品列表（仅返回当前店铺未删除的商品；空表时返回空数组，前端正常渲染）
router.get('/', async (req, res) => {
  try {
    const { keyword = '', status = '', categoryId = '', page = 1, pageSize = 20 } = req.query;
    let where = ' WHERE g.is_deleted = 0 AND g.store_id = ?';
    const params = [req.admin.storeId];
    if (keyword) { where += ' AND g.name LIKE ?'; params.push(`%${keyword}%`); }
    if (status === 'on' || status === 'off') { where += ' AND g.on_sale = ?'; params.push(status === 'on' ? 1 : 0); }
    if (categoryId) { where += ' AND g.category_id = ?'; params.push(parseInt(categoryId, 10)); }

    const size = Math.min(parseInt(pageSize, 10) || 20, 200);
    const cur = Math.max(parseInt(page, 10) || 1, 1);

    const totalRow = await db.get(`SELECT COUNT(*) AS c FROM goods g${where}`, params);
    const list = await db.all(`
      SELECT g.*, c.name AS category_name
      FROM goods g
      LEFT JOIN goods_category c ON c.id = g.category_id
      ${where}
      ORDER BY g.id DESC
      LIMIT ? OFFSET ?
    `, [...params, size, (cur - 1) * size]);
    for (const g of list) await attachSkus(g);

    res.json({ code: 0, data: { list, total: totalRow.c, page: cur, pageSize: size } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 商品详情
router.get('/:id', async (req, res) => {
  try {
    const goods = await db.get(`
      SELECT g.*, c.name AS category_name
      FROM goods g LEFT JOIN goods_category c ON c.id = g.category_id
      WHERE g.id = ? AND g.store_id = ? AND g.is_deleted = 0
    `, [req.params.id, req.admin.storeId]);
    if (!goods) return res.json({ code: 1, message: '商品不存在' });
    res.json({ code: 0, data: await attachSkus(goods) });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 新增商品（含规格库存 SKU，事务写入）
router.post('/', async (req, res) => {
  const [f, err] = parseGoodsBody(req.body || {});
  if (err) return res.json({ code: 1, message: err });
  const now = nowStr();
  try {
    const id = await db.transaction(async (tx) => {
      const info = await tx.run(`
        INSERT INTO goods (name, goods_no, image, price, original_price, colors, sizes, stock, category_id, store_id, description, on_sale, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [f.name, f.goodsNo, f.image, f.price, f.originalPrice, f.colors, f.sizes, f.stock,
          f.categoryId, req.admin.storeId, f.description, f.onSale, now, now]);
      await saveSkus(tx, info.insertId, f.skus);
      return info.insertId;
    });
    res.json({ code: 0, data: { id } });
  } catch (e) {
    res.json({ code: 1, message: e.message || '新增失败' });
  }
});

// 编辑商品（全字段覆盖，规格库存全量重建）
router.put('/:id', async (req, res) => {
  try {
    const goods = await db.get('SELECT id FROM goods WHERE id = ? AND store_id = ? AND is_deleted = 0',
      [req.params.id, req.admin.storeId]);
    if (!goods) return res.json({ code: 1, message: '商品不存在' });
    const [f, err] = parseGoodsBody(req.body || {});
    if (err) return res.json({ code: 1, message: err });
    try {
      await db.transaction(async (tx) => {
        await tx.run(`
          UPDATE goods SET name=?, goods_no=?, image=?, price=?, original_price=?,
            colors=?, sizes=?, stock=?, category_id=?,
            description=?, on_sale=?, updated_at=?
          WHERE id=?
        `, [f.name, f.goodsNo, f.image, f.price, f.originalPrice, f.colors, f.sizes, f.stock,
            f.categoryId, f.description, f.onSale, nowStr(), goods.id]);
        await saveSkus(tx, goods.id, f.skus);
      });
      res.json({ code: 0, message: '保存成功' });
    } catch (e) {
      res.json({ code: 1, message: e.message || '保存失败' });
    }
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 商品上下架
router.put('/:id/status', async (req, res) => {
  try {
    const onSale = req.body && req.body.onSale ? 1 : 0;
    const r = await db.run('UPDATE goods SET on_sale = ?, updated_at = ? WHERE id = ? AND store_id = ? AND is_deleted = 0',
      [onSale, nowStr(), req.params.id, req.admin.storeId]);
    if (r.changes === 0) return res.json({ code: 1, message: '商品不存在' });
    res.json({ code: 0, message: onSale ? '已上架' : '已下架' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 逻辑删除商品（数据库记录保留，is_deleted = 1）
router.delete('/:id', async (req, res) => {
  try {
    const r = await db.run('UPDATE goods SET is_deleted = 1, updated_at = ? WHERE id = ? AND store_id = ? AND is_deleted = 0',
      [nowStr(), req.params.id, req.admin.storeId]);
    if (r.changes === 0) return res.json({ code: 1, message: '商品不存在' });
    res.json({ code: 0, message: '已删除' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
