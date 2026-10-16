/**
 * 客户/会员路由（多租户：所有数据按 store_id 隔离）
 * GET    /api/customer/exists?phone=xxx   检查完整手机号是否已是本店会员
 * POST   /api/customer                    添加（或更新）会员：{ phone, surname, gender } → data.id
 * POST   /api/customer/match              按手机号后 4 位查询匹配会员：{ suffix }
 * GET    /api/customer/list               会员列表（分页 + keyword 搜索手机号/姓氏，含 CRM 统计）
 * GET    /api/customer/:id                会员详情（含 CRM 统计：消费次数/累计金额/最近到店）
 * GET    /api/customer/:id/orders         会员消费记录（分页，按创建时间倒序）
 * PUT    /api/customer/:id                编辑会员：{ surname, gender }
 * DELETE /api/customer/:id                删除会员（历史订单保留 customer_name 快照，不受影响）
 *
 * - gender：1先生 / 2女士；显示规则：{surname}{先生|女士}
 * - 添加已存在手机号视为更新（修正姓氏/性别）
 * - CRM 统计口径：排除已取消（cancelled）订单
 * - 注意：/exists /list 等静态路径必须定义在 /:id 之前，否则会被参数路由捕获
 */
const express = require('express');
const router = express.Router();
const { db, nowStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

/**
 * @openapi
 * /api/customer/exists:
 *   get:
 *     tags: [会员]
 *     summary: 检查完整手机号是否已是本店会员
 *     parameters:
 *       - { in: query, name: phone, required: true, schema: { type: string, example: '13800138000' } }
 *     responses:
 *       200: { description: 'data = { exists, customer? }' }
 * /api/customer:
 *   post:
 *     tags: [会员]
 *     summary: 添加（或更新）会员（手机号已存在视为更新姓氏/性别）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, surname, gender]
 *             properties:
 *               phone: { type: string, example: '13800138000' }
 *               surname: { type: string, example: 赵 }
 *               gender: { type: integer, enum: [1, 2], description: 1 先生 / 2 女士 }
 *     responses:
 *       200: { description: 'data = { id }' }
 * /api/customer/match:
 *   post:
 *     tags: [会员]
 *     summary: 按手机号后 4 位匹配会员（开单时老客户预选，最多 20 条）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               suffix: { type: string, example: '8000', description: 手机号后 4 位 }
 *     responses:
 *       200: { description: 'data = { list[] }' }
 * /api/customer/list:
 *   get:
 *     tags: [会员]
 *     summary: 会员列表（分页 + 手机号/姓氏搜索，含 CRM 统计）
 *     parameters:
 *       - { in: query, name: keyword, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: 'data = { list[], total, page, pageSize }' }
 * /api/customer/{id}:
 *   get:
 *     tags: [会员]
 *     summary: 会员详情（含消费次数/累计金额/最近到店）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: 'data = 会员对象' }
 *   put:
 *     tags: [会员]
 *     summary: 编辑会员（姓氏/性别）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               surname: { type: string }
 *               gender: { type: integer, enum: [1, 2] }
 *     responses:
 *       200: { description: '已保存' }
 *   delete:
 *     tags: [会员]
 *     summary: 删除会员（历史订单快照保留）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: '会员已删除' }
 * /api/customer/{id}/orders:
 *   get:
 *     tags: [会员]
 *     summary: 会员消费记录（分页，按时间倒序）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: 'data = { list[], total, page, pageSize }' }
 */

/** 将 gender 数值映射为后缀文字 */
function genderText(g) {
  if (g === 1) return '先生';
  if (g === 2) return '女士';
  return '';
}

/** 计算 "赵女士" 这种显示名（性别未知时仅显示姓氏） */
function displayName(surname, gender) {
  return `${surname || ''}${genderText(gender)}`;
}

/** 会员 CRM 统计子查询片段（排除已取消订单） */
const CRM_SELECT = `
  (SELECT COUNT(*) FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status != 'cancelled') AS order_count,
  (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status != 'cancelled') AS total_amount,
  (SELECT MAX(o.created_at) FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status != 'cancelled') AS last_order_at
`;

/** 将 customer 行映射为前端友好的对象 */
function mapCustomer(r) {
  return {
    id: r.id,
    phone: r.phone,
    surname: r.surname,
    gender: r.gender,
    displayName: displayName(r.surname, r.gender),
    orderCount: r.order_count || 0,
    totalAmount: Number(r.total_amount || 0).toFixed(2),
    lastOrderAt: r.last_order_at || '',
    createdAt: r.created_at || ''
  };
}

// ============ 检查手机号是否已是本店会员 ============
router.get('/exists', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!/^\d{11}$/.test(phone)) {
      return res.json({ code: 0, data: { exists: false } });
    }
    const row = await db.get('SELECT id, phone, surname, gender FROM customer WHERE store_id = ? AND phone = ?', [
      req.admin.storeId,
      phone
    ]);
    if (!row) {
      return res.json({ code: 0, data: { exists: false } });
    }
    res.json({
      code: 0,
      data: {
        exists: true,
        customer: {
          id: row.id,
          phone: row.phone,
          surname: row.surname,
          gender: row.gender,
          displayName: displayName(row.surname, row.gender)
        }
      }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 添加 / 更新会员（返回会员 id，供下单关联） ============
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const phone = String(body.phone || '').trim();
    const surname = String(body.surname || '').trim();
    const gender = Number(body.gender || 0);

    if (!/^\d{11}$/.test(phone)) {
      return res.json({ code: 1, message: '请输入 11 位手机号' });
    }
    if (!surname) {
      return res.json({ code: 1, message: '请输入姓氏' });
    }
    if (surname.length > 10) {
      return res.json({ code: 1, message: '姓氏过长（最多 10 个字）' });
    }
    if (gender !== 1 && gender !== 2) {
      return res.json({ code: 1, message: '请选择性别' });
    }

    const phoneLast4 = phone.slice(-4);
    const now = nowStr();
    const existing = await db.get('SELECT id FROM customer WHERE store_id = ? AND phone = ?', [
      req.admin.storeId,
      phone
    ]);

    if (existing) {
      // 已存在则更新姓氏/性别（用户主动"添加"语义即为更新）
      await db.run('UPDATE customer SET surname = ?, gender = ?, phone_last4 = ?, updated_at = ? WHERE id = ?', [
        surname,
        gender,
        phoneLast4,
        now,
        existing.id
      ]);
      return res.json({ code: 0, data: { id: existing.id }, message: '已更新该会员信息' });
    }

    const r = await db.run(
      'INSERT INTO customer (store_id, phone, phone_last4, surname, gender, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.admin.storeId, phone, phoneLast4, surname, gender, now, now]
    );
    res.json({ code: 0, data: { id: r.insertId }, message: '会员已添加' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.json({ code: 1, message: '该手机号已是本店会员' });
    }
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 按手机号后 4 位查询匹配会员（开单时预选） ============
router.post('/match', async (req, res) => {
  try {
    const suffix = String((req.body || {}).suffix || '').trim();
    if (!/^\d{4}$/.test(suffix)) {
      return res.json({ code: 0, data: { list: [] } });
    }
    const rows = await db.all(
      'SELECT id, phone, surname, gender FROM customer WHERE store_id = ? AND phone_last4 = ? ORDER BY id DESC LIMIT 20',
      [req.admin.storeId, suffix]
    );
    const list = rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      surname: r.surname,
      gender: r.gender,
      displayName: displayName(r.surname, r.gender)
    }));
    res.json({ code: 0, data: { list } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 会员列表（分页 + 搜索，含 CRM 统计） ============
router.get('/list', async (req, res) => {
  try {
    const { keyword = '', page = 1, pageSize = 20 } = req.query;
    const size = Math.min(parseInt(pageSize, 10) || 20, 100);
    const cur = Math.max(parseInt(page, 10) || 1, 1);

    let where = ' WHERE c.store_id = ?';
    const params = [req.admin.storeId];
    const kw = String(keyword).trim();
    if (kw) {
      where += ' AND (c.phone LIKE ? OR c.surname LIKE ?)';
      params.push(`%${kw}%`, `%${kw}%`);
    }

    const totalRow = await db.get(`SELECT COUNT(*) AS c FROM customer c${where}`, params);
    const rows = await db.all(
      `
      SELECT c.id, c.phone, c.surname, c.gender, c.created_at, ${CRM_SELECT}
      FROM customer c${where}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `,
      [...params, size, (cur - 1) * size]
    );

    res.json({
      code: 0,
      data: { list: rows.map(mapCustomer), total: totalRow.c, page: cur, pageSize: size }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 会员详情（含 CRM 统计） ============
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ code: 1, message: '参数错误' });
    const row = await db.get(
      `
      SELECT c.id, c.phone, c.surname, c.gender, c.created_at, ${CRM_SELECT}
      FROM customer c WHERE c.id = ? AND c.store_id = ?
    `,
      [id, req.admin.storeId]
    );
    if (!row) return res.json({ code: 1, message: '会员不存在' });
    res.json({ code: 0, data: mapCustomer(row) });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 会员消费记录（分页） ============
router.get('/:id/orders', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ code: 1, message: '参数错误' });
    const { page = 1, pageSize = 20 } = req.query;
    const size = Math.min(parseInt(pageSize, 10) || 20, 100);
    const cur = Math.max(parseInt(page, 10) || 1, 1);

    // 先确认会员属于本店
    const c = await db.get('SELECT id FROM customer WHERE id = ? AND store_id = ?', [id, req.admin.storeId]);
    if (!c) return res.json({ code: 1, message: '会员不存在' });

    const where = ' WHERE store_id = ? AND customer_id = ?';
    const params = [req.admin.storeId, id];
    const totalRow = await db.get(`SELECT COUNT(*) AS c FROM orders${where}`, params);
    const list = await db.all(
      `
      SELECT id, order_no, total_amount, pay_method, status, customer_phone, customer_name, created_at
      FROM orders${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
      [...params, size, (cur - 1) * size]
    );

    res.json({
      code: 0,
      data: { list, total: totalRow.c, page: cur, pageSize: size }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 编辑会员（姓氏 / 性别） ============
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ code: 1, message: '参数错误' });
    const body = req.body || {};
    const surname = String(body.surname || '').trim();
    const gender = Number(body.gender || 0);

    if (!surname) return res.json({ code: 1, message: '请输入姓氏' });
    if (surname.length > 10) return res.json({ code: 1, message: '姓氏过长（最多 10 个字）' });
    if (gender !== 1 && gender !== 2) return res.json({ code: 1, message: '请选择性别' });

    const row = await db.get('SELECT id FROM customer WHERE id = ? AND store_id = ?', [id, req.admin.storeId]);
    if (!row) return res.json({ code: 1, message: '会员不存在' });

    await db.run('UPDATE customer SET surname = ?, gender = ?, updated_at = ? WHERE id = ?', [
      surname,
      gender,
      nowStr(),
      id
    ]);
    res.json({ code: 0, message: '已保存' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 删除会员（历史订单的 customer_name 快照保留，不影响订单展示） ============
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ code: 1, message: '参数错误' });
    const r = await db.run('DELETE FROM customer WHERE id = ? AND store_id = ?', [id, req.admin.storeId]);
    if (!r.changes) return res.json({ code: 1, message: '会员不存在' });
    res.json({ code: 0, message: '会员已删除' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
