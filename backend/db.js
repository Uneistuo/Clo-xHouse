/**
 * 数据库初始化模块（MySQL 版，部署到微信云托管）
 * - 通过 mysql2 连接池访问 MySQL（云托管控制台开通数据库后，环境变量自动注入连接信息）
 * - 启动时：建库建表（幂等，可重复执行） + 初始化默认店铺与默认管理员账号
 * - 导出与原 SQLite 版风格一致的异步 API：db.get / db.all / db.run / db.transaction
 *   注意：所有调用均为异步（返回 Promise），路由层需 await
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('./config');
const logger = require('./utils/logger');

// 连接池（懒连接，初始化成功后由路由层使用）
const pool = mysql.createPool({
  host: config.MYSQL.host,
  port: config.MYSQL.port,
  user: config.MYSQL.user,
  password: config.MYSQL.password,
  database: config.MYSQL.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

/** 当前本地时间字符串：YYYY-MM-DD HH:mm:ss */
function nowStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** N 天前的时间字符串（订单时间范围筛选用） */
function daysAgoStr(days) {
  return nowStr(new Date(Date.now() - days * 86400000));
}

/**
 * 数据库错误脱敏（P0-5）：
 * - MySQL / 网络类错误（ER_*、ECONN*、PROTOCOL_* 等）完整写入日志，对外仅抛出通用错误，
 *   避免向前端泄露表名、SQL、连接信息等内部细节；
 * - 业务代码抛出的普通 Error（无 MySQL 错误码）原样返回，保持“库存不足”等友好提示不变。
 * 注意：保留原始错误码（如 ER_DUP_ENTRY），业务层可继续按 e.code 分支处理。
 */
function sanitizeDbError(err) {
  if (err && err.isSanitized) return err; // 已被包装过（事务内多个包装层），避免重复记录
  const code = err && err.code;
  const isDbError = typeof code === 'string' && /^(ER_|ECONN|ETIMEDOUT|PROTOCOL_|ENOTFOUND|EAI_AGAIN)/.test(code);
  if (!isDbError) return err;
  logger.error({ err }, 'database error');
  const wrapped = new Error('服务器内部错误');
  wrapped.code = code;
  wrapped.isSanitized = true;
  return wrapped;
}

/** 生成 8 位店铺码（大写字母+数字，去易混淆字符） */
function genBindCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 生成唯一店铺码（查库去重） */
async function genUniqueBindCode(conn) {
  while (true) {
    const code = genBindCode();
    const [rows] = await conn.query('SELECT id FROM store WHERE bind_code = ?', [code]);
    if (rows.length === 0) return code;
  }
}

/**
 * 初始化：建库 -> 建表 -> 初始化默认数据
 * 由 server.js 在启动前 await 调用
 */
async function init() {
  // 建库建表用独立连接（需 multipleStatements 执行多条 DDL；先不带库名，库可能还不存在）
  const conn = await mysql.createConnection({
    host: config.MYSQL.host,
    port: config.MYSQL.port,
    user: config.MYSQL.user,
    password: config.MYSQL.password,
    multipleStatements: true
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.MYSQL.database}\` DEFAULT CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${config.MYSQL.database}\``);
    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // ---- 存量表迁移（幂等） ----
    // 2.1) store 表增加 renamed_at（店铺名称最近修改时间，每月限改一次）
    const [nameCols] = await conn.query("SHOW COLUMNS FROM store LIKE 'renamed_at'");
    if (nameCols.length === 0) {
      await conn.query(
        "ALTER TABLE store ADD COLUMN renamed_at VARCHAR(19) NOT NULL DEFAULT '' AFTER billing_expire_at"
      );
      logger.info('[migrate] store 表已增加 renamed_at（店铺改名时间）列');
    }
    // 2.2) order_item 表增加 goods_no（下单时商品货号快照，小票打印用）
    const [itemCols] = await conn.query("SHOW COLUMNS FROM order_item LIKE 'goods_no'");
    if (itemCols.length === 0) {
      await conn.query("ALTER TABLE order_item ADD COLUMN goods_no VARCHAR(64) NOT NULL DEFAULT '' AFTER goods_id");
      logger.info('[migrate] order_item 表已增加 goods_no（商品货号快照）列');
    }
    // 2.3) 店铺名称全库唯一索引（存量重名时告警跳过，需人工处理）
    const [nameIdx] = await conn.query("SHOW INDEX FROM store WHERE Key_name = 'uniq_store_name'");
    if (nameIdx.length === 0) {
      try {
        await conn.query('ALTER TABLE store ADD UNIQUE INDEX uniq_store_name (name)');
        logger.info('[migrate] store.name 已添加唯一索引（店铺名称不可重复）');
      } catch (e) {
        logger.warn({ err: e }, '[migrate] store.name 存在重复名称，唯一索引未创建，请人工处理重复店铺');
      }
    }
    // 2.4) orders 表增加会员关联列（customer_id + customer_name 快照，会员消费统计用）
    const [orderCols] = await conn.query("SHOW COLUMNS FROM orders LIKE 'customer_id'");
    if (orderCols.length === 0) {
      await conn.query(
        'ALTER TABLE orders ADD COLUMN customer_id INT UNSIGNED NOT NULL DEFAULT 0 AFTER customer_phone, ' +
          "ADD COLUMN customer_name VARCHAR(30) NOT NULL DEFAULT '' AFTER customer_id, " +
          'ADD KEY idx_orders_customer (customer_id)'
      );
      logger.info('[migrate] orders 表已增加 customer_id / customer_name（会员关联）列');
    }
    // 2.5) 高频查询复合索引（P2-3，幂等：按索引名检查，存在则跳过）
    await ensureIndex(
      conn,
      'orders',
      'idx_orders_store_status_time',
      'ALTER TABLE orders ADD INDEX idx_orders_store_status_time (store_id, status, created_at)'
    );
    await ensureIndex(
      conn,
      'orders',
      'idx_orders_store_time',
      'ALTER TABLE orders ADD INDEX idx_orders_store_time (store_id, created_at)'
    );
    await ensureIndex(
      conn,
      'goods',
      'idx_goods_store_deleted_onsale',
      'ALTER TABLE goods ADD INDEX idx_goods_store_deleted_onsale (store_id, is_deleted, on_sale)'
    );
    await ensureIndex(
      conn,
      'goods_sku',
      'idx_goods_sku_goods_spec',
      'ALTER TABLE goods_sku ADD INDEX idx_goods_sku_goods_spec (goods_id, color, size)'
    );
    // 2.6) orders 表增加状态时间戳（订单时间线展示用；存量订单用 updated_at 兜底回填）
    const [orderTsCols] = await conn.query("SHOW COLUMNS FROM orders LIKE 'paid_at'");
    if (orderTsCols.length === 0) {
      await conn.query(
        "ALTER TABLE orders ADD COLUMN paid_at VARCHAR(19) NOT NULL DEFAULT '' AFTER updated_at, " +
          "ADD COLUMN done_at VARCHAR(19) NOT NULL DEFAULT '' AFTER paid_at, " +
          "ADD COLUMN cancelled_at VARCHAR(19) NOT NULL DEFAULT '' AFTER done_at, " +
          "ADD COLUMN refunded_at VARCHAR(19) NOT NULL DEFAULT '' AFTER cancelled_at"
      );
      await conn.query("UPDATE orders SET paid_at = updated_at WHERE paid_at = '' AND status IN ('paid', 'done')");
      await conn.query("UPDATE orders SET done_at = updated_at WHERE done_at = '' AND status = 'done'");
      await conn.query("UPDATE orders SET cancelled_at = updated_at WHERE cancelled_at = '' AND status = 'cancelled'");
      await conn.query("UPDATE orders SET refunded_at = updated_at WHERE refunded_at = '' AND status = 'refunded'");
      logger.info('[migrate] orders 表已增加状态时间戳列（paid_at / done_at / cancelled_at / refunded_at）');
    }
    // 2.7) customer 表增加会员 CRM 扩展列（标签 / 生日 / 快捷备注）
    const [customerCrmCols] = await conn.query("SHOW COLUMNS FROM customer LIKE 'tags'");
    if (customerCrmCols.length === 0) {
      await conn.query(
        "ALTER TABLE customer ADD COLUMN tags VARCHAR(255) NOT NULL DEFAULT '' AFTER gender, " +
          "ADD COLUMN birthday VARCHAR(10) NOT NULL DEFAULT '' AFTER tags, " +
          "ADD COLUMN remark VARCHAR(200) NOT NULL DEFAULT '' AFTER birthday"
      );
      logger.info('[migrate] customer 表已增加 tags / birthday / remark（会员 CRM）列');
    }
    await ensureIndex(
      conn,
      'customer',
      'idx_customer_store_birthday',
      'ALTER TABLE customer ADD INDEX idx_customer_store_birthday (store_id, birthday)'
    );
    // 会员查找（store_id, phone）已有唯一索引 uniq_customer_store_phone 覆盖，无需重复添加

    // 1) 确保存在默认店铺（首个启动时创建，长期授权）
    const [stores] = await conn.query('SELECT id FROM store ORDER BY id ASC LIMIT 1');
    let storeId = stores.length ? stores[0].id : 0;
    if (!storeId) {
      const [r] = await conn.query(
        "INSERT INTO store (name, bind_code, owner_id, billing_expire_at, created_at) VALUES ('默认店铺', ?, 0, '2099-12-31 23:59:59', ?)",
        [await genUniqueBindCode(conn), nowStr()]
      );
      storeId = r.insertId;
      logger.info({ storeId }, '[init] 已创建默认店铺');
    }

    // 2) 首次启动初始化默认管理员：admin / admin123（绑定默认店铺，同时为平台管理员）
    const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM admin');
    if (c === 0) {
      await conn.query(
        "INSERT INTO admin (username, password, store_id, role, is_platform, created_at) VALUES ('admin', ?, ?, 'owner', 1, ?)",
        [bcrypt.hashSync('admin123', 10), storeId, nowStr()]
      );
      await conn.query('UPDATE store SET owner_id = (SELECT id FROM admin WHERE username = ?) WHERE id = ?', [
        'admin',
        storeId
      ]);
      logger.warn('[init] 已创建默认管理员账号 admin/admin123，请尽快登录后修改密码');
    }

    // 3) 平台管理员标记：默认 admin 账号即小程序平台管理员（控制各店铺开单白名单）
    await conn.query("UPDATE admin SET is_platform = 1 WHERE username = 'admin'");

    logger.info(
      { host: config.MYSQL.host, port: config.MYSQL.port, database: config.MYSQL.database },
      '[db] MySQL 已连接'
    );
  } finally {
    await conn.end();
  }
}

/** 幂等添加索引：按索引名检查，已存在则跳过（P2-3，表名/索引名为代码内常量，无注入风险） */
async function ensureIndex(conn, table, indexName, createSql) {
  const [rows] = await conn.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    await conn.query(createSql);
    logger.info({ table, indexName }, '[migrate] 已添加查询索引');
  }
}

// ============ 提供 db 包装对象（路由层统一 await db.get / db.all / db.run） ============
const db = {
  /** 查询多行 */
  async all(sql, params = []) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      throw sanitizeDbError(err);
    }
  },

  /** 查询单行（无结果返回 null） */
  async get(sql, params = []) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows[0] || null;
    } catch (err) {
      throw sanitizeDbError(err);
    }
  },

  /** 执行写操作，返回 { changes: 受影响行数, insertId: 自增ID } */
  async run(sql, params = []) {
    try {
      const [result] = await pool.query(sql, params);
      return { changes: result.affectedRows || 0, insertId: result.insertId || 0 };
    } catch (err) {
      throw sanitizeDbError(err);
    }
  },

  /**
   * 事务：回调参数 tx 与 db 同接口（get / all / run），
   * 事务内所有语句走同一连接，抛错自动 ROLLBACK
   */
  async transaction(fn) {
    let conn;
    try {
      conn = await pool.getConnection();
    } catch (err) {
      throw sanitizeDbError(err);
    }
    const tx = {
      async all(sql, params = []) {
        try {
          const [rows] = await conn.query(sql, params);
          return rows;
        } catch (err) {
          throw sanitizeDbError(err);
        }
      },
      async get(sql, params = []) {
        try {
          const [rows] = await conn.query(sql, params);
          return rows[0] || null;
        } catch (err) {
          throw sanitizeDbError(err);
        }
      },
      async run(sql, params = []) {
        try {
          const [result] = await conn.query(sql, params);
          return { changes: result.affectedRows || 0, insertId: result.insertId || 0 };
        } catch (err) {
          throw sanitizeDbError(err);
        }
      }
    };
    await conn.beginTransaction();
    try {
      const result = await fn(tx);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw sanitizeDbError(err);
    } finally {
      conn.release();
    }
  }
};

/** 关闭数据库连接池（优雅关闭用，P2-4） */
async function closePool() {
  await pool.end();
}

module.exports = { db, init, closePool, nowStr, daysAgoStr };
