/**
 * 订单接口集成测试（P3-2）
 * 覆盖：创建订单（成功/库存不足/订单号查重重试/授权失效）、订单列表/详情/状态流转、取消与退款（库存归还）
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

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

/** 构造事务 mock：参数可控制 SKU/商品库存与订单号冲突 */
function buildTx(options = {}) {
  const {
    skuStock = 5,
    goodsStock = 5,
    skuExists = true,
    orderNoCollisionOnce = false,
    orderStatus = 'pending',
    items = [{ goods_id: 1, color: '', size: '', quantity: 2 }]
  } = options;
  let orderNoLookups = 0;
  const tx = {
    calls: { orderNoLookups: () => orderNoLookups },
    get: jest.fn(async (sql) => {
      if (/FROM orders WHERE order_no/.test(sql)) {
        orderNoLookups += 1;
        return orderNoCollisionOnce && orderNoLookups === 1 ? { id: 99 } : null;
      }
      if (/FROM goods_sku WHERE goods_id = \? AND color = \? AND size = \?/.test(sql)) {
        return skuExists ? { id: 11, goods_id: 1, color: '', size: '', stock: skuStock } : null;
      }
      if (/COUNT\(\*\) AS c FROM goods_sku/.test(sql)) {
        return { c: skuExists ? 1 : 0 };
      }
      if (/FROM goods WHERE id = \? AND store_id/.test(sql)) {
        return { id: 1, store_id: 1, name: '纯棉T恤', goods_no: 'T001', price: 100, stock: goodsStock, is_deleted: 0 };
      }
      return null;
    }),
    run: jest.fn(async (sql) => {
      if (/INSERT INTO orders/.test(sql)) return { insertId: 123, changes: 1 };
      if (/INSERT INTO order_item/.test(sql)) return { insertId: 1, changes: 1 };
      if (/UPDATE goods_sku SET stock = stock -/.test(sql)) return { changes: skuStock > 0 ? 1 : 0 };
      if (/UPDATE goods SET stock = stock -/.test(sql)) return { changes: goodsStock > 0 ? 1 : 0 };
      if (/UPDATE orders SET status/.test(sql)) return { changes: 1 };
      return { changes: 1, insertId: 0 };
    }),
    all: jest.fn(async () => items)
  };
  return tx;
}

function baseDbGet({ billing = '2099-12-31 23:59:59', order = null } = {}) {
  return async (sql) => {
    if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
    if (/billing_expire_at FROM store/.test(sql)) return { billing_expire_at: billing };
    if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return order;
    return null;
  };
}

let app;
beforeAll(() => {
  app = createApp();
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/orders 创建订单', () => {
  test('成功开单：生成订单号并扣减库存', async () => {
    const tx = buildTx();
    mockDb.get.mockImplementation(baseDbGet());
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders')).send({
      items: [{ goodsId: 1, color: '', size: '', quantity: 2 }],
      paidNow: true
    });

    expect(res.body.code).toBe(0);
    expect(res.body.data.orderNo).toMatch(/^SO\d{14}$/); // SO + 8 位日期 + 6 位随机
    expect(res.body.data.totalAmount).toBe(200);
    expect(res.body.data.status).toBe('paid');
    // 扣减 SKU 与商品总库存各一次
    expect(tx.run.mock.calls.some(([sql]) => /UPDATE goods_sku SET stock = stock -/.test(sql))).toBe(true);
    expect(tx.run.mock.calls.some(([sql]) => /UPDATE goods SET stock = stock -/.test(sql))).toBe(true);
  });

  test('订单号冲突时自动换号重试（P1-2）', async () => {
    const tx = buildTx({ orderNoCollisionOnce: true });
    mockDb.get.mockImplementation(baseDbGet());
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders')).send({
      items: [{ goodsId: 1, quantity: 1 }]
    });

    expect(res.body.code).toBe(0);
    expect(tx.calls.orderNoLookups()).toBe(2); // 第一次撞号后重新生成
  });

  test('库存不足 -> 事务回滚，返回友好提示', async () => {
    const tx = buildTx({ skuStock: 0 });
    mockDb.get.mockImplementation(baseDbGet());
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders')).send({
      items: [{ goodsId: 1, color: '', size: '', quantity: 1 }]
    });

    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('库存不足');
    expect(tx.run.mock.calls.some(([sql]) => /INSERT INTO orders/.test(sql))).toBe(false); // 未写入订单
  });

  test('商品不存在 -> code=1', async () => {
    const tx = buildTx();
    tx.get.mockImplementation(async () => null); // 商品/规格都查不到
    mockDb.get.mockImplementation(baseDbGet());
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders')).send({ items: [{ goodsId: 999, quantity: 1 }] });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('商品不存在');
  });

  test('开单授权未开通 -> code=1002', async () => {
    mockDb.get.mockImplementation(baseDbGet({ billing: '' }));

    const res = await authed(request(app).post('/api/orders')).send({ items: [{ goodsId: 1, quantity: 1 }] });
    expect(res.body.code).toBe(1002);
    expect(res.body.message).toContain('未开通');
  });

  test('开单授权已到期 -> code=1002', async () => {
    mockDb.get.mockImplementation(baseDbGet({ billing: '2020-01-01 00:00:00' }));

    const res = await authed(request(app).post('/api/orders')).send({ items: [{ goodsId: 1, quantity: 1 }] });
    expect(res.body.code).toBe(1002);
    expect(res.body.message).toContain('到期');
  });

  test('空商品列表 -> code=1', async () => {
    mockDb.get.mockImplementation(baseDbGet());
    const res = await authed(request(app).post('/api/orders')).send({ items: [] });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('不能为空');
  });
});

describe('GET /api/orders 列表与详情', () => {
  test('列表返回分页数据', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/COUNT\(\*\) AS c FROM orders/.test(sql)) return { c: 1 };
      return null;
    });
    mockDb.all.mockResolvedValue([
      { id: 1, order_no: 'SO20261016123456', total_amount: 100, status: 'paid', item_count: 1, quantity_count: 2 }
    ]);

    const res = await authed(request(app).get('/api/orders?status=paid&range=today'));
    expect(res.body.code).toBe(0);
    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  test('详情包含商品明细', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql))
        return { id: 5, order_no: 'SO20261016111111', status: 'pending' };
      return null;
    });
    mockDb.all.mockResolvedValue([{ id: 1, order_id: 5, goods_name: 'T恤', quantity: 1, price: 100 }]);

    const res = await authed(request(app).get('/api/orders/5'));
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
  });

  test('订单不存在 -> code=1', async () => {
    mockDb.get.mockImplementation(async (sql) => (/FROM admin WHERE id/.test(sql) ? ADMIN : null));
    const res = await authed(request(app).get('/api/orders/999'));
    expect(res.body.code).toBe(1);
  });
});

describe('PUT /api/orders/:id/status 状态流转', () => {
  test('待收款 -> 已收款', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'pending' };
      return null;
    });
    mockDb.run.mockResolvedValue({ changes: 1 });

    const res = await authed(request(app).put('/api/orders/5/status')).send({ status: 'paid' });
    expect(res.body.code).toBe(0);
    expect(res.body.message).toContain('已收款');
  });

  test('不允许跳级流转（待收款 -> 已完成）', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'pending' };
      return null;
    });

    const res = await authed(request(app).put('/api/orders/5/status')).send({ status: 'done' });
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('不允许');
  });
});

describe('取消 / 退款（库存归还）', () => {
  test('取消待收款订单 -> 归还库存', async () => {
    const tx = buildTx();
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'pending' };
      return null;
    });
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders/5/cancel'));
    expect(res.body.code).toBe(0);
    expect(res.body.message).toContain('库存已归还');
    expect(tx.run.mock.calls.some(([sql]) => /UPDATE goods_sku SET stock = stock \+/.test(sql))).toBe(true);
    expect(tx.run.mock.calls.some(([sql]) => /UPDATE goods SET stock = stock \+/.test(sql))).toBe(true);
    expect(tx.run.mock.calls.some(([sql]) => /status = 'cancelled'/.test(sql))).toBe(true);
  });

  test('已取消订单不可再次取消', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'cancelled' };
      return null;
    });

    const res = await authed(request(app).post('/api/orders/5/cancel'));
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('不可取消');
  });

  test('退款已收款订单 -> 归还库存并置为已退款', async () => {
    const tx = buildTx();
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'paid' };
      return null;
    });
    mockDb.transaction.mockImplementation(async (fn) => fn(tx));

    const res = await authed(request(app).post('/api/orders/5/refund'));
    expect(res.body.code).toBe(0);
    expect(tx.run.mock.calls.some(([sql]) => /status = 'refunded'/.test(sql))).toBe(true);
  });

  test('待收款订单不可退款', async () => {
    mockDb.get.mockImplementation(async (sql) => {
      if (/FROM admin WHERE id = \?/.test(sql)) return ADMIN;
      if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) return { id: 5, status: 'pending' };
      return null;
    });

    const res = await authed(request(app).post('/api/orders/5/refund'));
    expect(res.body.code).toBe(1);
    expect(res.body.message).toContain('不可退款');
  });
});

describe('未登录访问', () => {
  test('无 token -> 401', async () => {
    const res = await request(app).post('/api/orders').send({ items: [] });
    expect(res.status).toBe(401);
  });
});
