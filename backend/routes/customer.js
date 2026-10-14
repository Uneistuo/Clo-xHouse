/**
 * 客户/会员路由（用于开单时添加 / 识别老客户）
 * GET  /api/customer/exists?phone=xxx  检查完整手机号是否已是本店会员
 * POST /api/customer                   添加（或更新）会员：{ phone, surname, gender }
 * POST /api/customer/match             按手机号后 4 位查询匹配会员：{ suffix }
 *
 * - 数据按 store_id 多租户隔离
 * - gender 必填 1(先生) / 2(女士)；显示规则：{surname}{先生|女士}
 * - 添加已存在手机号视为更新（修正姓氏/性别）
 */
const express = require('express');
const router = express.Router();
const { db, nowStr } = require('../db');
const auth = require('../middleware/auth');
const requireStore = require('../middleware/requireStore');

router.use(auth, requireStore);

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

// ============ 检查手机号是否已是本店会员 ============
router.get('/exists', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!/^\d{11}$/.test(phone)) {
      return res.json({ code: 0, data: { exists: false } });
    }
    const row = await db.get(
      'SELECT phone, surname, gender FROM customer WHERE store_id = ? AND phone = ?',
      [req.admin.storeId, phone]
    );
    if (!row) {
      return res.json({ code: 0, data: { exists: false } });
    }
    res.json({
      code: 0,
      data: {
        exists: true,
        customer: {
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

// ============ 添加 / 更新会员 ============
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
    const existing = await db.get(
      'SELECT id FROM customer WHERE store_id = ? AND phone = ?',
      [req.admin.storeId, phone]
    );

    if (existing) {
      // 已存在则更新姓氏/性别（用户主动"添加"语义即为更新）
      await db.run(
        'UPDATE customer SET surname = ?, gender = ?, phone_last4 = ?, updated_at = ? WHERE id = ?',
        [surname, gender, phoneLast4, now, existing.id]
      );
      return res.json({ code: 0, message: '已更新该会员信息' });
    }

    await db.run(
      'INSERT INTO customer (store_id, phone, phone_last4, surname, gender, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.admin.storeId, phone, phoneLast4, surname, gender, now, now]
    );
    res.json({ code: 0, message: '会员已添加' });
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
      'SELECT phone, surname, gender FROM customer WHERE store_id = ? AND phone_last4 = ? ORDER BY id DESC LIMIT 20',
      [req.admin.storeId, suffix]
    );
    const list = rows.map((r) => ({
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

module.exports = router;
