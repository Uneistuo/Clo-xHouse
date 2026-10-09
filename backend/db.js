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
      await conn.query("ALTER TABLE store ADD COLUMN renamed_at VARCHAR(19) NOT NULL DEFAULT '' AFTER billing_expire_at");
      console.log('[migrate] store 表已增加 renamed_at（店铺改名时间）列');
    }
    // 2.2) 店铺名称全库唯一索引（存量重名时告警跳过，需人工处理）
    const [nameIdx] = await conn.query("SHOW INDEX FROM store WHERE Key_name = 'uniq_store_name'");
    if (nameIdx.length === 0) {
      try {
        await conn.query('ALTER TABLE store ADD UNIQUE INDEX uniq_store_name (name)');
        console.log('[migrate] store.name 已添加唯一索引（店铺名称不可重复）');
      } catch (e) {
        console.warn('[migrate] store.name 存在重复名称，唯一索引未创建，请人工处理重复店铺:', e.message);
      }
    }

    // 1) 确保存在默认店铺（首个启动时创建，长期授权）
    const [stores] = await conn.query('SELECT id FROM store ORDER BY id ASC LIMIT 1');
    let storeId = stores.length ? stores[0].id : 0;
    if (!storeId) {
      const [r] = await conn.query(
        "INSERT INTO store (name, bind_code, owner_id, billing_expire_at, created_at) VALUES ('默认店铺', ?, 0, '2099-12-31 23:59:59', ?)",
        [await genUniqueBindCode(conn), nowStr()]
      );
      storeId = r.insertId;
      console.log('[init] 已创建默认店铺 ->', storeId);
    }

    // 2) 首次启动初始化默认管理员：admin / admin123（绑定默认店铺，同时为平台管理员）
    const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM admin');
    if (c === 0) {
      await conn.query(
        "INSERT INTO admin (username, password, store_id, role, is_platform, created_at) VALUES ('admin', ?, ?, 'owner', 1, ?)",
        [bcrypt.hashSync('admin123', 10), storeId, nowStr()]
      );
      await conn.query('UPDATE store SET owner_id = (SELECT id FROM admin WHERE username = ?) WHERE id = ?', ['admin', storeId]);
      console.log('[init] 已创建默认管理员账号 -> 用户名: admin  密码: admin123');
    }

    // 3) 平台管理员标记：默认 admin 账号即小程序平台管理员（控制各店铺开单白名单）
    await conn.query("UPDATE admin SET is_platform = 1 WHERE username = 'admin'");

    console.log(`[db] MySQL 已连接: ${config.MYSQL.host}:${config.MYSQL.port}/${config.MYSQL.database}`);
  } finally {
    await conn.end();
  }
}

// ============ 提供 db 包装对象（路由层统一 await db.get / db.all / db.run） ============
const db = {
  /** 查询多行 */
  async all(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  /** 查询单行（无结果返回 null） */
  async get(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  },

  /** 执行写操作，返回 { changes: 受影响行数, insertId: 自增ID } */
  async run(sql, params = []) {
    const [result] = await pool.query(sql, params);
    return { changes: result.affectedRows || 0, insertId: result.insertId || 0 };
  },

  /**
   * 事务：回调参数 tx 与 db 同接口（get / all / run），
   * 事务内所有语句走同一连接，抛错自动 ROLLBACK
   */
  async transaction(fn) {
    const conn = await pool.getConnection();
    const tx = {
      async all(sql, params = []) {
        const [rows] = await conn.query(sql, params);
        return rows;
      },
      async get(sql, params = []) {
        const [rows] = await conn.query(sql, params);
        return rows[0] || null;
      },
      async run(sql, params = []) {
        const [result] = await conn.query(sql, params);
        return { changes: result.affectedRows || 0, insertId: result.insertId || 0 };
      }
    };
    await conn.beginTransaction();
    try {
      const result = await fn(tx);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = { db, init, nowStr, daysAgoStr };
