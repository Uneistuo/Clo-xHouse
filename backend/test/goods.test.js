/**
 * 商品接口与安全基线测试（P1-1 / P0-4 / P0-5 / P3-2）
 * 覆盖：商品列表 SKU 批量查询（无 N+1）、图片上传类型/大小/扩展名限制、错误脱敏、未知接口 404
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const mockDb = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
jest.mock('../db', () => ({
  db: mockDb,
  init: jest.fn().mockResolvedValue(),
  closePool: jest.fn().mockResolvedValue(),
  nowStr: () => '2026-10-16 12:00:00',
  daysAgoStr: () => '2026-10-09 12:00:00'
}));

const config = require('../config');
const { createApp } = require('../server');

const ADMIN = { id: 1, username: 'boss', store_id: 1, role: 'owner', is_platform: 0 };
const token = jwt.sign({ id: 1, username: 'boss', storeId: 1, role: 'owner' }, config.JWT_SECRET, { expiresIn: '1h' });
const authed = (req) => req.set('Authorization', `Bearer ${token}`);

let app;
beforeAll(() => {
  app = createApp();
});
beforeEach(() => {
  jest.clearAllMocks();
  // 默认：仅满足鉴权中间件的账号查询；各用例可覆盖
  mockDb.get.mockImplementation(async (sql) => {
    if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
    return null;
  });
});

describe('GET /api/goods 商品列表（P1-1 无 N+1）', () => {
  test('SKU 仅一次 IN 批量查询，无论列表多少条商品', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/COUNT\(\*\) AS c FROM goods/.test(sql)) return { c: 3 };
      return null;
    });
    const goodsRows = [
      { id: 1, name: 'A', price: 10, stock: 1, store_id: 1, on_sale: 1, is_deleted: 0 },
      { id: 2, name: 'B', price: 20, stock: 2, store_id: 1, on_sale: 1, is_deleted: 0 },
      { id: 3, name: 'C', price: 30, stock: 3, store_id: 1, on_sale: 1, is_deleted: 0 }
    ];
    const skuRows = [
      { id: 1, goods_id: 1, color: '黑色', size: 'M', stock: 1 },
      { id: 2, goods_id: 2, color: '白色', size: 'L', stock: 2 },
      { id: 3, goods_id: 3, color: '', size: '', stock: 3 }
    ];
    mockDb.all
      .mockResolvedValueOnce(goodsRows) // 1. 商品列表
      .mockResolvedValueOnce(skuRows); // 2. SKU 批量 IN 查询

    const res = await authed(request(app).get('/api/goods?status=on&page=1&pageSize=20'));
    expect(res.body.code).toBe(0);
    expect(res.body.data.list).toHaveLength(3);
    // SKU 查询恰好 2 次 db.all（列表 + SKU 批量），不存在逐条查询
    expect(mockDb.all).toHaveBeenCalledTimes(2);
    expect(mockDb.all.mock.calls[1][0]).toContain('IN (?,?,?)');
    // SKU 按 goods_id 正确分组
    expect(res.body.data.list[0].skus[0]).toMatchObject({ color: '黑色', stock: 1 });
    expect(res.body.data.list[2].skus[0]).toMatchObject({ color: '', stock: 3 });
  });

  test('数据库错误 -> 前端仅收到脱敏信息（P0-5）', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      // 模拟 db 层已脱敏的数据库错误
      const err = new Error('服务器内部错误');
      err.isSanitized = true;
      throw err;
    });

    const res = await authed(request(app).get('/api/goods'));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('服务器内部错误');
    expect(JSON.stringify(res.body)).not.toMatch(/sql|SELECT|ER_|mysql/i);
  });
});

describe('POST /api/upload 图片上传限制（P0-4）', () => {
  const uploadDir = config.UPLOAD_DIR;
  const created = [];

  afterEach(() => {
    for (const f of created.splice(0)) {
      try {
        fs.unlinkSync(f);
      } catch (e) {
        /* ignore */
      }
    }
  });

  test('非图片类型（text/plain）被拒绝且不落盘', async () => {
    const res = await authed(request(app).post('/api/upload')).attach('file', Buffer.from('not an image'), {
      filename: 'evil.txt',
      contentType: 'text/plain'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('JPG/PNG/WebP');
  });

  test('图片 MIME 但扩展名伪装（.php）被拒绝', async () => {
    const res = await authed(request(app).post('/api/upload')).attach('file', Buffer.from('fake'), {
      filename: 'shell.php',
      contentType: 'image/jpeg'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1);
  });

  test('超过大小限制被拒绝', async () => {
    const big = Buffer.alloc(config.UPLOAD_MAX_BYTES + 1024, 0xff);
    const res = await authed(request(app).post('/api/upload')).attach('file', big, {
      filename: 'big.jpg',
      contentType: 'image/jpeg'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('大小');
  });

  test('合法图片上传成功：文件名随机、扩展名来自白名单', async () => {
    const res = await authed(request(app).post('/api/upload')).attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
      filename: 'photo.jpg',
      contentType: 'image/jpeg'
    });
    expect(res.body.code).toBe(0);
    // 本地存储模式返回 /uploads/<时间戳>-<24位随机hex>.jpg
    expect(res.body.data.url).toMatch(/^\/uploads\/\d+-[a-f0-9]{24}\.jpg$/);
    const saved = path.join(uploadDir, path.basename(res.body.data.url));
    expect(fs.existsSync(saved)).toBe(true);
    created.push(saved);
    // 原始文件名未被使用，随机文件名不可预测
    expect(res.body.data.url).not.toContain('photo');
  });
});

describe('未知 API 与未登录', () => {
  test('未知 /api 路径返回 JSON 404，而非 HTML', async () => {
    const res = await request(app).get('/api/not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 1, message: '接口不存在' });
  });
});
