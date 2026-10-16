/**
 * 店铺接口（自由注册 + 绑定共享模式；店主可绑定多个店铺，上限 3 个）
 * GET   /api/store/info              当前绑定店铺信息 + 成员列表 + 名下店铺列表（未绑定时返回 storeId=0）
 * POST  /api/store/create            创建店铺 { storeName }：创建者成为店主（店主可继续创建，最多 3 个）
 * POST  /api/store/switch            切换当前店铺 { storeId }（仅限店主名下店铺）
 * POST  /api/store/bind              绑定店铺 { code }：凭店铺码加入，商品/订单数据自动同步可见
 * POST  /api/store/unbind            退出店铺（员工自行退出，店主不可退出、只能切换）
 * POST  /api/store/code              重置店铺码（仅店主）
 * POST  /api/store/rename            修改店铺名称 { storeName }（仅平台管理员，无冷却，名称全库唯一）
 * POST  /api/store/member/remove     移除店铺成员 { memberId }（仅店主）
 */
/** 店主可绑定店铺数量上限 */
const STORE_LIMIT = 3;
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, nowStr } = require('../db');
const config = require('../config');
const auth = require('../middleware/auth');

router.use(auth);

/**
 * @openapi
 * /api/store/info:
 *   get:
 *     tags: [店铺]
 *     summary: 当前店铺信息（未绑定返回 storeId=0）+ 成员列表 + 名下店铺 + 开单授权状态
 *     responses:
 *       200: { description: 'data = { storeId, role, store, members, billingEnabled, billingExpireAt, myStores, canCreateStore, ... }' }
 * /api/store/create:
 *   post:
 *     tags: [店铺]
 *     summary: 创建店铺（创建者成为店主，最多 3 个店铺）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string, example: 我的服装店 }
 *     responses:
 *       200: { description: 'data = { token, admin }' }
 * /api/store/switch:
 *   post:
 *     tags: [店铺]
 *     summary: 切换当前店铺（仅限店主名下店铺，返回新 token）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeId: { type: integer }
 *     responses:
 *       200: { description: 'data = { token, admin }' }
 * /api/store/bind:
 *   post:
 *     tags: [店铺]
 *     summary: 绑定店铺（凭 8 位店铺码加入，商品/订单数据同步可见）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, example: ABCD2345 }
 *     responses:
 *       200: { description: 'data = { token, admin }' }
 * /api/store/unbind:
 *   post:
 *     tags: [店铺]
 *     summary: 退出店铺（员工自行退出；店主不可退出）
 *     responses:
 *       200: { description: 'data = { token, admin }' }
 * /api/store/rename:
 *   post:
 *     tags: [店铺]
 *     summary: 修改本店名称（仅平台管理员，名称全库唯一）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string }
 *     responses:
 *       200: { description: 'data = { storeName }' }
 * /api/store/member/remove:
 *   post:
 *     tags: [店铺]
 *     summary: 移除店铺成员（仅店主，被移除成员立即失去本店数据权限）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId: { type: integer }
 *     responses:
 *       200: { description: '已将成员移出店铺' }
 * /api/store/code:
 *   post:
 *     tags: [店铺]
 *     summary: 重置店铺码（仅店主，旧码立即失效）
 *     responses:
 *       200: { description: 'data = { bindCode }' }
 */

/** 店铺名是否已被其他店铺占用（store_id 参数用于改名时排除自己） */
async function nameExists(name, excludeStoreId = 0) {
  const row = await db.get('SELECT id FROM store WHERE name = ? AND id != ?', [name, excludeStoreId]);
  return !!row;
}

/** 生成唯一 8 位店铺码（大写字母+数字，去易混淆字符） */
async function genBindCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  while (true) {
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const exists = await db.get('SELECT id FROM store WHERE bind_code = ?', [code]);
    if (!exists) return code;
  }
}

/** 签发携带新店铺身份的 Token（绑定/创建店铺后返回，前端更新本地 Token 实现免重登） */
function signToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, storeId: admin.store_id, role: admin.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES }
  );
}

// ============ 当前店铺信息（未绑定返回 storeId=0 + 是否可创建店铺） ============
router.get('/info', async (req, res) => {
  try {
    // 名下店铺列表（owner_id 归属关系，与当前活跃店铺 store_id 无关）
    const myStores = await db.all('SELECT id, name, created_at FROM store WHERE owner_id = ? ORDER BY id ASC', [
      req.admin.id
    ]);
    const canCreateStore = myStores.length < STORE_LIMIT;
    if (!req.admin.storeId) {
      return res.json({
        code: 0,
        data: {
          storeId: 0,
          role: '',
          store: null,
          members: [],
          billingEnabled: false,
          billingExpireAt: '',
          canRename: false,
          nextRenameAt: '',
          myStores,
          storeLimit: STORE_LIMIT,
          canCreateStore
        }
      });
    }
    const store = await db.get(
      'SELECT id, name, bind_code, owner_id, billing_expire_at, renamed_at, created_at FROM store WHERE id = ?',
      [req.admin.storeId]
    );
    if (!store) {
      return res.json({
        code: 0,
        data: {
          storeId: 0,
          role: '',
          store: null,
          members: [],
          billingEnabled: false,
          billingExpireAt: '',
          canRename: false,
          nextRenameAt: '',
          myStores,
          storeLimit: STORE_LIMIT,
          canCreateStore
        }
      });
    }
    const members = await db.all(
      "SELECT id, username, role, created_at FROM admin WHERE store_id = ? ORDER BY role = 'owner' DESC, id ASC",
      [req.admin.storeId]
    );
    // 开单授权时效（实时计算：空=未授权，到期时间 > 当前时间 = 有效）
    const billingExpireAt = store.billing_expire_at || '';
    const billingEnabled = !!billingExpireAt && billingExpireAt > nowStr();
    // 改名资格：仅平台管理员（无冷却，任意时刻可改名）
    const canRename = !!req.admin.isPlatform;
    const nextRenameAt = '';
    res.json({
      code: 0,
      data: {
        storeId: store.id,
        role: req.admin.role,
        store,
        members,
        billingEnabled,
        billingExpireAt,
        canRename,
        nextRenameAt,
        myStores,
        storeLimit: STORE_LIMIT,
        canCreateStore
      }
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 创建店铺（创建者即店主；已有店铺的店主可继续创建，最多 3 个） ============
router.post('/create', async (req, res) => {
  try {
    // 店铺数量上限：一个店主最多绑定 3 个店铺
    const owned = await db.get('SELECT COUNT(*) AS c FROM store WHERE owner_id = ?', [req.admin.id]);
    if (owned.c >= STORE_LIMIT) {
      return res.json({ code: 1, message: `每个店主最多可绑定 ${STORE_LIMIT} 个店铺` });
    }
    // 员工（绑定他人店铺中）不可直接创建，需先退出；未绑定或本人是店主均可创建
    if (req.admin.storeId && req.admin.role !== 'owner') {
      return res.json({ code: 1, message: '您已绑定店铺，请先退出后再创建新店铺' });
    }
    const storeName = String((req.body || {}).storeName || '').trim();
    if (!storeName) return res.json({ code: 1, message: '请填写店铺名称' });
    if (storeName.length > 30) return res.json({ code: 1, message: '店铺名称不能超过 30 个字' });
    if (await nameExists(storeName)) {
      return res.json({ code: 1, message: '该店铺名称已被使用，请换一个名称' });
    }

    try {
      const storeId = await db.transaction(async (tx) => {
        const info = await tx.run('INSERT INTO store (name, bind_code, owner_id, created_at) VALUES (?, ?, ?, ?)', [
          storeName,
          await genBindCode(),
          req.admin.id,
          nowStr()
        ]);
        const newId = info.insertId;
        await tx.run("UPDATE admin SET store_id = ?, role = 'owner' WHERE id = ?", [newId, req.admin.id]);
        return newId;
      });
      // 重新签发携带店铺身份的 Token（新店铺成为当前活跃店铺）
      const admin = await db.get('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
      res.json({
        code: 0,
        data: {
          token: signToken(admin),
          admin: {
            id: admin.id,
            username: admin.username,
            storeId,
            storeName,
            role: 'owner',
            isPlatform: !!admin.is_platform
          }
        },
        message: '店铺创建成功'
      });
    } catch (e) {
      res.json({ code: 1, message: e.message || '创建失败，请重试' });
    }
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 切换当前店铺（仅限店主名下店铺，切换后商品/订单数据随活跃店铺切换） ============
router.post('/switch', async (req, res) => {
  try {
    const storeId = Number((req.body || {}).storeId || 0);
    if (!storeId) return res.json({ code: 1, message: '参数错误' });
    const store = await db.get('SELECT * FROM store WHERE id = ?', [storeId]);
    if (!store) return res.json({ code: 1, message: '店铺不存在' });
    if (store.owner_id !== req.admin.id) {
      return res.json({ code: 1, message: '只能切换到您名下的店铺' });
    }
    if (req.admin.storeId === store.id) {
      return res.json({ code: 1, message: '当前已是该店铺' });
    }
    await db.run("UPDATE admin SET store_id = ?, role = 'owner' WHERE id = ?", [store.id, req.admin.id]);
    const admin = await db.get('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
    res.json({
      code: 0,
      data: {
        token: signToken(admin),
        admin: {
          id: admin.id,
          username: admin.username,
          storeId: store.id,
          storeName: store.name,
          role: 'owner',
          isPlatform: !!admin.is_platform
        }
      },
      message: `已切换到店铺【${store.name}】`
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 绑定店铺（凭店铺码加入，商品/订单数据自动同步） ============
router.post('/bind', async (req, res) => {
  try {
    if (req.admin.storeId) {
      return res.json({ code: 1, message: '您已绑定店铺，请先解绑后再加入其他店铺' });
    }
    const code = String((req.body || {}).code || '')
      .trim()
      .toUpperCase();
    if (!code) return res.json({ code: 1, message: '请输入店铺码' });

    const store = await db.get('SELECT * FROM store WHERE bind_code = ?', [code]);
    if (!store) return res.json({ code: 1, message: '店铺码不存在，请核对后重试' });

    await db.run("UPDATE admin SET store_id = ?, role = 'staff' WHERE id = ?", [store.id, req.admin.id]);

    const admin = await db.get('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
    res.json({
      code: 0,
      data: {
        token: signToken(admin),
        admin: {
          id: admin.id,
          username: admin.username,
          storeId: store.id,
          storeName: store.name,
          role: 'staff',
          isPlatform: !!admin.is_platform
        }
      },
      message: `已加入店铺【${store.name}】，商品与订单数据已同步`
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 退出店铺（员工自行退出共享，店主不可退出） ============
router.post('/unbind', async (req, res) => {
  try {
    if (!req.admin.storeId) {
      return res.json({ code: 1, message: '您尚未绑定店铺' });
    }
    const store = await db.get('SELECT * FROM store WHERE id = ?', [req.admin.storeId]);
    if (store && store.owner_id === req.admin.id) {
      return res.json({ code: 1, message: '店主不可退出店铺，可在"我的店铺"中切换到其他店铺' });
    }
    await db.run("UPDATE admin SET store_id = 0, role = 'staff' WHERE id = ?", [req.admin.id]);
    const admin = await db.get('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
    res.json({
      code: 0,
      data: {
        token: signToken(admin),
        admin: {
          id: admin.id,
          username: admin.username,
          storeId: 0,
          storeName: null,
          role: 'staff',
          isPlatform: !!admin.is_platform
        }
      },
      message: '已退出店铺，您可以创建新店铺或加入其他店铺'
    });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 修改店铺名称（仅平台管理员，无冷却，名称全库唯一） ============
router.post('/rename', async (req, res) => {
  try {
    if (!req.admin.storeId) {
      return res.json({ code: 1, message: '您尚未绑定店铺' });
    }
    if (!req.admin.isPlatform) {
      return res.json({ code: 1, message: '只有平台管理员可以修改店铺名称' });
    }
    const store = await db.get('SELECT * FROM store WHERE id = ?', [req.admin.storeId]);
    if (!store) return res.json({ code: 1, message: '店铺不存在' });
    const storeName = String((req.body || {}).storeName || '').trim();
    if (!storeName) return res.json({ code: 1, message: '请填写新的店铺名称' });
    if (storeName === store.name) return res.json({ code: 1, message: '新名称与当前名称相同' });
    if (storeName.length > 30) return res.json({ code: 1, message: '店铺名称不能超过 30 个字' });
    if (await nameExists(storeName, store.id)) {
      return res.json({ code: 1, message: '该店铺名称已被使用，请换一个名称' });
    }
    await db.run('UPDATE store SET name = ?, renamed_at = ? WHERE id = ?', [storeName, nowStr(), store.id]);
    res.json({ code: 0, data: { storeName }, message: '店铺名称已修改' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 移除店铺成员（仅店主；被移除成员立即失去本店数据权限） ============
router.post('/member/remove', async (req, res) => {
  try {
    if (!req.admin.storeId) {
      return res.json({ code: 1, message: '您尚未绑定店铺' });
    }
    const store = await db.get('SELECT * FROM store WHERE id = ?', [req.admin.storeId]);
    if (!store || store.owner_id !== req.admin.id) {
      return res.json({ code: 1, message: '只有店主可以管理店铺成员' });
    }
    const memberId = Number((req.body || {}).memberId || 0);
    if (!memberId) return res.json({ code: 1, message: '参数错误' });
    if (memberId === req.admin.id) {
      return res.json({ code: 1, message: '不能移除自己；店主如需退出请联系管理员处理' });
    }
    const member = await db.get('SELECT id, username, role FROM admin WHERE id = ? AND store_id = ?', [
      memberId,
      req.admin.storeId
    ]);
    if (!member) return res.json({ code: 1, message: '该成员不存在或已不在本店铺' });
    if (member.role === 'owner') {
      return res.json({ code: 1, message: '不能移除店主' });
    }
    await db.run("UPDATE admin SET store_id = 0, role = 'staff' WHERE id = ?", [memberId]);
    res.json({ code: 0, message: `已将成员【${member.username}】移出店铺` });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

// ============ 重置店铺码（仅店主；旧码立即失效） ============
router.post('/code', async (req, res) => {
  try {
    if (!req.admin.storeId) {
      return res.json({ code: 1, message: '您尚未绑定店铺' });
    }
    const store = await db.get('SELECT * FROM store WHERE id = ?', [req.admin.storeId]);
    if (!store || store.owner_id !== req.admin.id) {
      return res.json({ code: 1, message: '只有店主可以重置店铺码' });
    }
    const code = await genBindCode();
    await db.run('UPDATE store SET bind_code = ? WHERE id = ?', [code, store.id]);
    res.json({ code: 0, data: { bindCode: code }, message: '店铺码已重置，旧店铺码立即失效' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message || '服务器内部错误' });
  }
});

module.exports = router;
