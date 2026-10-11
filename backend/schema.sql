-- ============================================================
-- 服装店商家管理系统 建表 SQL（MySQL 方言，服务启动时自动执行，幂等可重复执行）
-- 多商家版：每个账号绑定一个店铺（store），业务数据按 store_id 隔离
-- 注意：只建表结构，不插入任何商品 / 订单测试数据
-- （默认店铺与管理员账号由 db.js 在首次启动时创建）
-- 时间列统一存 'YYYY-MM-DD HH:mm:ss' 字符串（由应用层 nowStr() 生成，避免服务器时区差异）
-- ============================================================

-- 0. 店铺表（用户自由注册，通过"店铺码"绑定店铺共享商品/订单数据）
-- billing_expire_at：开单白名单到期时间（空=未授权；大于当前时间=已授权；由平台管理员控制时效）
-- renamed_at：店铺名称最近一次修改时间（店主每月仅可改名一次；空=从未改过，可立即修改）
-- name 全库唯一（由 db.js 启动迁移添加唯一索引，存量重名时告警并跳过）
CREATE TABLE IF NOT EXISTS store (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- 店铺ID
  name              VARCHAR(60)  NOT NULL,                    -- 店铺名称（全小程序唯一）
  bind_code         VARCHAR(16)  NOT NULL UNIQUE,            -- 店铺码（员工绑定店铺用，店主可重置）
  owner_id          INT UNSIGNED NOT NULL DEFAULT 0,         -- 店主账号ID（关联 admin.id）
  billing_expire_at VARCHAR(19)  NOT NULL DEFAULT '',         -- 开单授权到期时间（YYYY-MM-DD HH:mm:ss，空=未授权）
  renamed_at        VARCHAR(19)  NOT NULL DEFAULT '',         -- 名称最近修改时间（每月限改一次）
  created_at        VARCHAR(19)  NOT NULL DEFAULT ''         -- 创建时间
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1. 商家账号表（注册不建店，绑定店铺后获得该店数据：store_id = 0 表示未绑定）
-- is_platform：平台管理员标记（小程序管理员，可控制各店铺开单白名单）
CREATE TABLE IF NOT EXISTS admin (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- 管理员ID
  username    VARCHAR(32) NOT NULL UNIQUE,              -- 商家账号
  password    VARCHAR(80) NOT NULL,                     -- 密码（bcrypt 加密存储）
  store_id    INT UNSIGNED NOT NULL DEFAULT 0,          -- 绑定店铺ID（0=未绑定，关联 store.id）
  role        VARCHAR(16) NOT NULL DEFAULT 'staff',     -- 角色：owner 店主 / staff 员工
  is_platform TINYINT     NOT NULL DEFAULT 0,            -- 平台管理员：1是 0否
  created_at  VARCHAR(19) NOT NULL DEFAULT ''           -- 创建时间
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 商品分类表
CREATE TABLE IF NOT EXISTS goods_category (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- 分类ID
  name       VARCHAR(60) NOT NULL,                    -- 分类名称
  sort       INT          NOT NULL DEFAULT 0,         -- 排序（越小越靠前）
  store_id   INT UNSIGNED NOT NULL DEFAULT 0,         -- 所属店铺ID
  created_at VARCHAR(19)  NOT NULL DEFAULT '',        -- 创建时间
  KEY idx_category_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 商品表（逻辑删除：is_deleted=1 表示已删除，不物理删除记录）
CREATE TABLE IF NOT EXISTS goods (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, -- 商品ID
  name           VARCHAR(100) NOT NULL,                  -- 商品名称
  goods_no       VARCHAR(64)  NOT NULL DEFAULT '',       -- 货号（商家自编号码，选填）
  image          VARCHAR(1000) NOT NULL DEFAULT '',     -- 商品图片（多个用英文逗号分隔，相对路径或完整 URL）
  price          DOUBLE       NOT NULL DEFAULT 0,       -- 售价（元）
  original_price DOUBLE       NOT NULL DEFAULT 0,       -- 原价（元）
  colors         VARCHAR(255) NOT NULL DEFAULT '',      -- 颜色（逗号分隔，如：红色,黑色）
  sizes          VARCHAR(255) NOT NULL DEFAULT '',      -- 尺码（逗号分隔，如：S,M,L,XL）
  stock          INT          NOT NULL DEFAULT 0,       -- 库存数量（= 各规格 SKU 库存之和，冗余字段便于列表展示）
  category_id    INT UNSIGNED NULL,                     -- 分类ID（关联 goods_category.id）
  store_id       INT UNSIGNED NOT NULL DEFAULT 0,       -- 所属店铺ID
  description    VARCHAR(2000) NOT NULL DEFAULT '',     -- 商品描述
  on_sale        TINYINT     NOT NULL DEFAULT 0,        -- 上架状态：1上架 0下架
  is_deleted     TINYINT     NOT NULL DEFAULT 0,       -- 逻辑删除：1已删除 0正常
  created_at     VARCHAR(19) NOT NULL DEFAULT '',      -- 创建时间
  updated_at     VARCHAR(19) NOT NULL DEFAULT '',      -- 更新时间
  KEY idx_goods_name (name),
  KEY idx_goods_category (category_id),
  KEY idx_goods_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.1 商品规格库存表（SKU：按"颜色+尺码"组合区分库存）
-- 每个商品至少一行；无颜色/尺码属性的商品为一行空规格（color=''、size=''）
CREATE TABLE IF NOT EXISTS goods_sku (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- 规格ID
  goods_id INT UNSIGNED NOT NULL,                    -- 商品ID（关联 goods.id）
  color    VARCHAR(60)  NOT NULL DEFAULT '',         -- 颜色（空串表示无颜色属性）
  size     VARCHAR(60)  NOT NULL DEFAULT '',         -- 尺码（空串表示无尺码属性）
  stock    INT           NOT NULL DEFAULT 0,         -- 该规格库存数量
  KEY idx_goods_sku_goods (goods_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 订单表
-- status: pending待收款 / paid已收款 / done已完成 / cancelled已取消 / refunded已退款
-- pay_method: offline 线下收款（现金/顾客微信转账给店主）
CREATE TABLE IF NOT EXISTS orders (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, -- 订单ID
  order_no       VARCHAR(32) NOT NULL UNIQUE,            -- 订单号（SO+日期+随机码）
  total_amount   DOUBLE      NOT NULL DEFAULT 0,        -- 订单总金额（元）
  pay_method     VARCHAR(16) NOT NULL DEFAULT 'offline', -- 收款方式
  status         VARCHAR(16) NOT NULL DEFAULT 'pending', -- 订单状态
  customer_phone VARCHAR(20) NOT NULL DEFAULT '',        -- 客户手机号
  remark         VARCHAR(500) NOT NULL DEFAULT '',       -- 订单备注
  store_id       INT UNSIGNED NOT NULL DEFAULT 0,       -- 所属店铺ID
  created_at     VARCHAR(19) NOT NULL DEFAULT '',       -- 创建时间
  updated_at     VARCHAR(19) NOT NULL DEFAULT '',       -- 更新时间
  KEY idx_orders_status (status),
  KEY idx_orders_time (created_at),
  KEY idx_orders_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 订单明细表（goods_name/price 为下单时快照，保证商品后续修改/删除不影响历史订单）
CREATE TABLE IF NOT EXISTS order_item (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,  -- 明细ID
  order_id   INT UNSIGNED NOT NULL,                   -- 订单ID
  goods_id   INT UNSIGNED NOT NULL,                   -- 商品ID
  goods_no   VARCHAR(64)  NOT NULL DEFAULT '',       -- 商品货号快照（下单时的 goods.goods_no）
  goods_name VARCHAR(100) NOT NULL DEFAULT '',       -- 商品名称快照
  color      VARCHAR(60)  NOT NULL DEFAULT '',       -- 选择的颜色
  size       VARCHAR(60)  NOT NULL DEFAULT '',       -- 选择的尺码
  quantity   INT          NOT NULL DEFAULT 1,        -- 购买数量
  price      DOUBLE       NOT NULL DEFAULT 0,        -- 单品价格快照（下单时售价）
  KEY idx_order_item_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
