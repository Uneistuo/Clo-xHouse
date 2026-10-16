/**
 * 认证接口集成测试（P3-2）
 * 覆盖：注册校验/成功、登录失败/成功（db 层使用 jest mock，无需真实 MySQL）
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');

// mock 数据库模块（测试不依赖真实 MySQL）
const mockDb = { get: jest.fn(), all: jest.fn(), run: jest.fn(), transaction: jest.fn() };
jest.mock('../db', () => ({
  db: mockDb,
  init: jest.fn().mockResolvedValue(),
  closePool: jest.fn().mockResolvedValue(),
  nowStr: () => '2026-10-16 12:00:00',
  daysAgoStr: () => '2026-10-09 12:00:00'
}));

const { createApp } = require('../server');

let app;
beforeAll(() => {
  app = createApp();
});
beforeEach(() => {
  jest.clearAllMocks();
});

const ADMIN_VIEW = {
  id: 1,
  username: 'shop01',
  store_id: 0,
  role: 'staff',
  is_platform: 0,
  store_name: null,
  bind_code: null
};

describe('POST /api/auth/register', () => {
  test('缺少账号密码 -> code=1', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('账号');
  });

  test('账号格式非法 -> code=1', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a', password: '123456' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('3-20');
  });

  test('密码过短 -> code=1', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'shop01', password: '123' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('密码长度');
  });

  test('账号已存在 -> code=1', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1 });
    const res = await request(app).post('/api/auth/register').send({ username: 'shop01', password: '123456' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('已被注册');
  });

  test('注册成功 -> 返回 token 与 admin 信息', async () => {
    mockDb.get
      .mockResolvedValueOnce(null) // 查重：不存在
      .mockResolvedValueOnce(ADMIN_VIEW); // findAdminView
    mockDb.run.mockResolvedValue({ insertId: 1, changes: 1 });

    const res = await request(app).post('/api/auth/register').send({ username: 'shop01', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.admin.username).toBe('shop01');
    // 密码必须以 bcrypt 哈希写入，而非明文
    const insertedPwd = mockDb.run.mock.calls[0][1][1];
    expect(insertedPwd).not.toBe('123456');
    expect(bcrypt.compareSync('123456', insertedPwd)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  test('缺少参数 -> code=1', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'shop01' });
    expect(res.body.code).toBe(1);
  });

  test('账号不存在 -> code=1（不暴露具体原因）', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: '123456' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toBe('账号或密码错误');
  });

  test('密码错误 -> code=1', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      username: 'shop01',
      password: bcrypt.hashSync('right-pass', 10),
      store_id: 0,
      role: 'staff',
      is_platform: 0
    });
    const res = await request(app).post('/api/auth/login').send({ username: 'shop01', password: 'wrong-pass' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toBe('账号或密码错误');
  });

  test('登录成功 -> 返回 token 与店铺信息', async () => {
    mockDb.get
      .mockResolvedValueOnce({
        id: 1,
        username: 'shop01',
        password: bcrypt.hashSync('123456', 10),
        store_id: 3,
        role: 'owner',
        is_platform: 1
      })
      .mockResolvedValueOnce({
        id: 1,
        username: 'shop01',
        store_id: 3,
        role: 'owner',
        is_platform: 1,
        store_name: '测试店铺',
        bind_code: 'ABCD2345'
      });

    const res = await request(app).post('/api/auth/login').send({ username: 'shop01', password: '123456' });
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.admin).toMatchObject({
      id: 1,
      username: 'shop01',
      storeId: 3,
      storeName: '测试店铺',
      role: 'owner',
      isPlatform: true
    });
  });
});

describe('GET /api/health', () => {
  test('数据库可用 -> 200 且包含版本/内存/运行时间', async () => {
    mockDb.get.mockResolvedValueOnce({ ok: 1 });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.status).toBe('up');
    expect(res.body.data.db).toBe('up');
    expect(res.body.data.memory).toBeTruthy();
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  test('数据库不可用 -> 503 且 status=down', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('数据库不可用'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data.status).toBe('down');
    expect(res.body.data.db).toBe('down');
  });
});
