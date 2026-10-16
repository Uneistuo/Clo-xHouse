/**
 * 商品分类接口
 * GET    /api/category      分类列表（附带每个分类下的商品数）
 * POST   /api/category      新增分类 { name, sort }
 * PUT    /api/category/:id  编辑分类
 * DELETE /api/category/:id  删除分类（分类下仍有商品时禁止删除）
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

/**
 * @openapi
 * /api/category:
 *   get:
 *     tags: [分类]
 *     summary: 分类列表（含每个分类下的商品数，按 sort 排序）
 *     responses:
 *       200: { description: 'data = 分类数组（含 goods_count）' }
 *   post:
 *     tags: [分类]
 *     summary: 新增分类
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               sort: { type: integer, default: 0 }
 *     responses:
 *       200: { description: 'data = { id }' }
 * /api/category/{id}:
 *   put:
 *     tags: [分类]
 *     summary: 编辑分类
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               sort: { type: integer }
 *     responses:
 *       200: { description: '保存成功' }
 *   delete:
 *     tags: [分类]
 *     summary: 删除分类（分类下仍有商品时禁止删除）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: '已删除' }
 * /api/category/sort:
 *   post:
 *     tags: [分类]
 *     summary: 批量保存分类排序
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids: { type: array, items: { type: integer }, description: 按数组顺序重置 sort }
 *     responses:
 *       200: { description: '排序已保存' }
 */

// 分类列表（空表时返回空数组；只返回当前店铺的分类）
router.get('/', async (req, res) => {
  try {
    const list = await db.all(
      `
      SELECT c.*,
             (SELECT COUNT(*) FROM goods g WHERE g.category_id = c.id AND g.is_deleted = 0 AND g.store_id = c.store_id) AS goods_count
      FROM goods_category c
      WHERE c.store_id = ?
      ORDER BY c.sort ASC, c.id ASC
    `,
      [req.admin.storeId]
    );
    res.json({ code: 0, data: list });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 新增分类
router.post('/', async (req, res) => {
  try {
    const name = String((req.body || {}).name || '').trim();
    const sort = parseInt((req.body || {}).sort, 10) || 0;
    if (!name) return res.json({ code: 1, message: '分类名称不能为空' });
    const exists = await db.get('SELECT id FROM goods_category WHERE name = ? AND store_id = ?', [
      name,
      req.admin.storeId
    ]);
    if (exists) return res.json({ code: 1, message: '分类名称已存在' });
    const info = await db.run('INSERT INTO goods_category (name, sort, store_id) VALUES (?, ?, ?)', [
      name,
      sort,
      req.admin.storeId
    ]);
    res.json({ code: 0, data: { id: info.insertId } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 编辑分类
router.put('/:id', async (req, res) => {
  try {
    const c = await db.get('SELECT * FROM goods_category WHERE id = ? AND store_id = ?', [
      req.params.id,
      req.admin.storeId
    ]);
    if (!c) return res.json({ code: 1, message: '分类不存在' });
    const name = String((req.body || {}).name || '').trim();
    const sort = parseInt((req.body || {}).sort, 10);
    if (!name) return res.json({ code: 1, message: '分类名称不能为空' });
    if (sort < 0 || isNaN(sort)) return res.json({ code: 1, message: '排序必须为不小于 0 的整数' });
    const dup = await db.get('SELECT id FROM goods_category WHERE name = ? AND store_id = ? AND id != ?', [
      name,
      req.admin.storeId,
      c.id
    ]);
    if (dup) return res.json({ code: 1, message: '分类名称已存在' });
    await db.run('UPDATE goods_category SET name = ?, sort = ? WHERE id = ?', [name, sort, c.id]);
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 删除分类：分类下还有未删除商品时禁止删除，避免商品分类悬空
router.delete('/:id', async (req, res) => {
  try {
    const c = await db.get('SELECT * FROM goods_category WHERE id = ? AND store_id = ?', [
      req.params.id,
      req.admin.storeId
    ]);
    if (!c) return res.json({ code: 1, message: '分类不存在' });
    const row = await db.get(
      'SELECT COUNT(*) AS c FROM goods WHERE category_id = ? AND is_deleted = 0 AND store_id = ?',
      [c.id, req.admin.storeId]
    );
    if (row.c > 0) {
      return res.json({ code: 1, message: `该分类下还有 ${row.c} 个商品，请先移除或修改这些商品的分类` });
    }
    await db.run('DELETE FROM goods_category WHERE id = ?', [c.id]);
    res.json({ code: 0, message: '已删除' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// 批量更新分类排序：body = { ids: [id1, id2, ...] }，按数组顺序重置 sort
router.post('/sort', async (req, res) => {
  try {
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ code: 1, message: '排序数据不能为空' });
    // 校验所有 id 属于当前店铺
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.all(`SELECT id FROM goods_category WHERE store_id = ? AND id IN (${placeholders})`, [
      req.admin.storeId,
      ...ids
    ]);
    if (rows.length !== ids.length) return res.json({ code: 1, message: '存在无效分类' });
    // 按新顺序重置 sort = (i+1)*100，使用稀疏值便于后续插入
    for (let i = 0; i < ids.length; i++) {
      await db.run('UPDATE goods_category SET sort = ? WHERE id = ? AND store_id = ?', [
        (i + 1) * 100,
        ids[i],
        req.admin.storeId
      ]);
    }
    res.json({ code: 0, message: '排序已保存' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
