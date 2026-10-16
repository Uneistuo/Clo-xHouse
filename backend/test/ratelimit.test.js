/**
 * 登录/注册频率限制测试（P0-2 / P3-2）
 * 独立测试文件：限流计数器为模块级内存状态，单独进程验证更可靠
 */
const request = require('supertest');

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

describe('认证接口频率限制（15 分钟窗口）', () => {
  const max = config.RATE_LIMIT.MAX;
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test(`同一 IP 第 ${max + 1} 次登录请求返回 429 与结构化错误`, async () => {
    mockDb.get.mockResolvedValue(null); // 账号不存在，返回业务错误（但每次请求都计入限流）

    const responses = [];
    for (let i = 0; i < max + 1; i++) {
      responses.push(
        await request(app)
          .post('/api/auth/login')
          .send({ username: 'nobody', password: 'x'.repeat(6) })
      );
    }

    // 前 max 次为业务失败（HTTP 200 + code=1），第 max+1 次被限流拦截
    for (let i = 0; i < max; i++) {
      expect(responses[i].status).toBe(200);
      expect(responses[i].body.code).toBe(1);
    }
    const limited = responses[max];
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe(1);
    expect(limited.body.message).toContain('尝试次数过多');
  });
});
