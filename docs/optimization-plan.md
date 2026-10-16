# 服装店管理系统 - 项目优化方案

> 项目：`miniprogram-1`（微信小程序客户端 + Web 管理后台 + Node.js 后端）
> 文档用途：供后续优化工作参考与执行，每项任务均标注优先级、涉及文件与验收标准
> 状态：**已完成（2026-10-16，P0-P3 全阶段）**，各任务完成说明见下方对应条目

---

## 一、项目概览

| 模块         | 目录                  | 技术栈                           | 说明                                   |
| ------------ | --------------------- | -------------------------------- | -------------------------------------- |
| 小程序客户端 | 项目根目录 / `pages/` | 原生微信小程序 (WXML/WXSS/JS+TS) | 收银开单、商品管理、订单、蓝牙打印等   |
| Web 管理后台 | `web/`                | 纯静态 SPA                       | 店铺/商品/订单/平台管理                |
| 后端服务     | `backend/`            | Express + MySQL (mysql2)         | REST API、JWT 鉴权、图片上传、定时任务 |

关键配置：

- `app.json`：小程序全局配置，已启用 `lazyCodeLoading: "requiredComponents"`、自定义 TabBar
- `backend/config.js`：后端运行时配置（端口、MySQL、JWT、COS），生产环境强制 JWT_SECRET
- `backend/db.js`：数据库连接池与事务封装（`db.get / all / run / transaction`）+ 幂等索引迁移 + 错误脱敏
- `utils/api.ts`：小程序请求封装（Token 续签、401 处理、502/503/504 重试，TypeScript）

---

## 二、现状诊断（已发现问题）

| 优先级 | 类别   | 问题简述                                                               | 涉及文件                                           | 风险/影响                   | 状态                 |
| ------ | ------ | ---------------------------------------------------------------------- | -------------------------------------------------- | --------------------------- | -------------------- |
| P0     | 安全   | `JWT_SECRET` 默认值为明文弱口令 `clothing-store-secret-change-me`      | `backend/config.js:32`                             | 生产环境 Token 易被伪造     | ✅ 已修复            |
| P0     | 安全   | 登录/注册接口无频率限制，易遭暴力破解/撞库                             | `backend/routes/auth.js`                           | 账号安全风险                | ✅ 已修复            |
| P0     | 安全   | `cors()` 放行全部源；文件上传未限制类型与大小                          | `backend/server.js:28`、`backend/routes/upload.js` | 跨域与恶意上传风险          | ✅ 已修复            |
| P0     | 安全   | 错误处理中 `console.error(err)` 可能将堆栈/敏感信息写入日志            | `backend/server.js:48-51`                          | 信息泄露                    | ✅ 已修复            |
| P1     | 性能   | 商品列表接口对每个商品串行查询 SKU（N+1 查询）                         | `backend/routes/goods.js:99`                       | 商品多时接口响应变慢        | ✅ 已修复            |
| P1     | 性能   | 小程序开单页一次拉取 200 条商品，无分页/虚拟列表                       | `pages/billing/billing.js:187`                     | 首屏加载慢，内存占用高      | ✅ 已修复            |
| P1     | 性能   | 订单号 `Math.random()` 生成，高并发下存在重复概率                      | `backend/routes/orders.js:25-30`                   | 极小概率订单号冲突          | ✅ 已修复            |
| P2     | 可观测 | 仅使用 `console.error`，无结构化日志、无日志分级、无日志切割           | 全局                                               | 线上问题难以定位            | ✅ 已修复            |
| P2     | 可观测 | `/api/health` 仅返回 `ok`，不包含数据库/内存/版本状态                  | `backend/server.js:45`                             | 云托管健康探测能力弱        | ✅ 已修复            |
| P2     | 可靠性 | 数据库缺少部分查询索引（如 `orders(store_id, status, created_at)` 等） | `backend/db.js` 迁移部分                           | 随数据量增长查询变慢        | ✅ 已修复            |
| P3     | 工程化 | 无 TypeScript，JS 文件缺乏类型检查                                     | `pages/**/*.js`、`utils/**/*.js`                   | 类型错误易在运行期才暴露    | ✅ 核心工具已迁移 TS |
| P3     | 工程化 | 无单元/集成测试                                                        | —                                                  | 重构/修复缺乏回归保障       | ✅ 已建 36 个测试    |
| P3     | 工程化 | 无 API 在线文档                                                        | —                                                  | 前后端联调依赖口头/代码阅读 | ✅ 已接入 Swagger    |
| P3     | 工程化 | 代码规范工具不完整（无 Prettier/Husky pre-commit）                     | `.eslintrc.js` 仅有 ESLint                         | 提交代码质量不统一          | ✅ 已配置            |

---

## 三、优化目标

1. **安全**：消除弱默认密钥，增加登录频率限制，收紧 CORS 与上传策略，脱敏错误返回。
2. **性能**：消除后端 N+1 查询，小程序商品分页加载，订单号唯一性保障，图片懒加载。
3. **可观测性**：接入结构化日志，增强健康检查，补全数据库索引，支持优雅关闭。
4. **工程化**：引入 TypeScript（核心工具优先），增加核心接口测试，生成 Swagger API 文档，统一代码格式化。

---

## 四、优化任务明细（分阶段）

### P0 阶段：安全加固（建议第 1 周完成）

#### P0-1. 移除 JWT 弱默认密钥，强制生产环境配置

**涉及文件**：`backend/config.js`

**改动要点**：

- `JWT_SECRET` 生产环境下若未通过环境变量设置，应直接抛出错误拒绝启动，而非使用弱默认值。
- 开发环境可保留一个明显标记为 `dev` 的默认值，并提醒修改。

**验收标准**：

- 生产环境未设置 `JWT_SECRET` 时，服务启动失败并打印明确错误。
- 代码仓库中不再出现明文生产级默认密钥。

> **完成：2026-10-16 @助手** —— `config.js` 默认按生产环境处理（NODE_ENV 未设置即视为生产）：未配置 `JWT_SECRET` 时抛错拒绝启动，错误信息包含密钥生成命令；开发环境（`npm run start:dev` / `start.bat` 已设置 `NODE_ENV=development`）使用带 `dev-only-` 前缀的占位密钥并打印警告；`Dockerfile` 显式设置 `NODE_ENV=production`。

#### P0-2. 登录/注册接口增加速率限制

**涉及文件**：`backend/routes/auth.js`、`backend/config.js`

**改动要点**：

- 引入 `express-rate-limit`。
- `/api/auth/login` 和 `/api/auth/register` 各自添加限制中间件（建议：15 分钟窗口，每 IP 最多 10 次）。
- 返回结构化错误 `{ code: 1, message: '...' }`。

**验收标准**：

- 同一 IP 短时间内超过阈值的登录/注册请求被拒绝，返回友好提示。
- 正常登录不受影响。

> **完成：2026-10-16 @助手** —— 接入 `express-rate-limit`，登录/注册各一个独立计数器（默认 15 分钟 / 每 IP 10 次，可通过 `RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX` 调整）；超限返回 HTTP 429 + `{ code: 1, message: '尝试次数过多，请 15 分钟后再试' }`；`server.js` 设置 `trust proxy: 1` 保证云托管环境下按真实客户端 IP 统计；测试见 `backend/test/ratelimit.test.js`。

#### P0-3. 收紧 CORS 跨域策略

**涉及文件**：`backend/server.js`

**改动要点**：

- `cors()` 不再允许全部源，改为通过环境变量 `CORS_ORIGIN` 配置允许源，默认仅允许小程序开发者工具域名或生产域名。
- 显式声明允许的方法与头部。

**验收标准**：

- 非配置域名的浏览器请求被 CORS 拦截。
- 小程序正常请求不受影响。

> **完成：2026-10-16 @助手** —— CORS 改为白名单模式：默认仅放行 `https://uneistuo.github.io`（Web 后台），可用 `CORS_ORIGIN`（逗号分隔）覆盖；本地开发额外放行 localhost/127.0.0.1 来源；小程序 `wx.request` 不带 Origin 头，不受影响；显式声明 `GET/POST/PUT/DELETE/OPTIONS` 方法与 `Content-Type/Authorization/X-Request-Id` 头部；非白名单来源仅记录日志、不返回 CORS 头（由浏览器拦截）。

#### P0-4. 文件上传限制类型与大小

**涉及文件**：`backend/server.js`、`backend/routes/upload.js`

**改动要点**：

- `multer` 配置 `limits.fileSize`（建议 5MB）。
- `fileFilter` 仅允许 `image/jpeg`、`image/png`、`image/webp`。
- 上传路径 traversal 防护（文件名重命名，不直接使用原始文件名）。

**验收标准**：

- 上传非图片或超大文件时返回错误，不写入磁盘。
- 上传的图片文件名不可预测（防止覆盖/遍历）。

> **完成：2026-10-16 @助手** —— `fileFilter` 收紧为 JPG/PNG/WebP（MIME + 原扩展名双重校验，拒绝 `.php` 等伪装文件名）；`limits.fileSize` 从 config 读取（默认 5MB，`UPLOAD_MAX_BYTES` 可调）；文件名改为 `crypto.randomBytes(12)` 随机十六进制 + 由 MIME 推导的白名单扩展名（不再使用原始文件名）；multer 错误统一转为 HTTP 400 + `{ code: 1, message }`；测试见 `backend/test/goods.test.js`「图片上传限制」用例。

#### P0-5. 错误处理脱敏，不向前端返回堆栈

**涉及文件**：`backend/server.js`、`backend/db.js`

**改动要点**：

- 全局错误处理中仅记录完整堆栈到日志，前端返回固定脱敏信息 `{ code: 1, message: '服务器内部错误' }`。
- 敏感信息（数据库密码、密钥等）不写入日志。

**验收标准**：

- 接口异常时前端仅收到通用错误提示，无堆栈跟踪。
- 后端日志中可查看完整错误便于排查。

> **完成：2026-10-16 @助手** —— 全局错误处理器只向日志写完整堆栈（`reqId` 等请求上下文），前端固定返回 `{ code: 1, message: '服务器内部错误' }`；JSON 解析失败返回 400 `请求体格式错误`；`db.js` 单点包装 MySQL/网络错误（`ER_*`/`ECONN*` 等）：完整错误仅写日志、对外抛出通用错误（保留 error code 供业务分支判断），路由层原有的 `e.message` 返回即自动完成脱敏；日志器配置 `redact` 脱敏 password/token/密钥字段。

---

### P1 阶段：性能提升（建议第 2-4 周完成）

#### P1-1. 商品列表接口消除 N+1 SKU 查询

**涉及文件**：`backend/routes/goods.js`

**改动要点**：

- 当前第 99 行 `for (const g of list) await attachSkus(g)` 是串行查询，商品 20 条即产生 20 次额外 SQL。
- 优化为：查出商品列表后，一次性用 `IN (...)` 查出所有相关商品的 SKU，在内存按 `goods_id` 分组后附加到各商品对象。

**验收标准**：

- 商品列表接口无论返回多少条商品，SKU 相关查询不超过 2 次（1 次列表 + 1 次 SKU 批量查）。
- 接口响应时间在商品量较大时有明显下降。

> **完成：2026-10-16 @助手** —— 新增 `attachSkusBatch()`：以 `WHERE goods_id IN (?,?,...)` 一次查出全部 SKU 并按 `goods_id` 分组附加，列表接口 SQL 总数恒定为 3 次（COUNT + 列表 + SKU 批量）；商品详情仍使用单条查询；测试断言 `db.all` 恰好被调用 2 次且第二条 SQL 含 `IN (?,?,?)`（`backend/test/goods.test.js`）。

#### P1-2. 订单号生成增加去重保障

**涉及文件**：`backend/routes/orders.js`

**改动要点**：

- `genOrderNo()` 保留 `SO + 日期 + 6 位随机` 格式。
- 在事务中写入订单前，检查订单号是否已存在；若存在则重新生成，最多重试 5 次。

**验收标准**：

- 高并发下不再出现订单号重复导致插入失败。

> **完成：2026-10-16 @助手** —— 新增 `insertOrderWithUniqueNo()`：事务内查重（存在则换号）+ 捕获 `ER_DUP_ENTRY` 唯一索引冲突（并发竞态下换号重试），最多 5 次，仍失败返回「订单号生成失败，请重试」；格式保持 `SO+YYYYMMDD+6位随机` 不变；测试覆盖「首次撞号自动换号重试」（`backend/test/orders.test.js`）。

#### P1-3. 小程序开单页商品分页加载

**涉及文件**：`pages/billing/billing.js`、`pages/billing/billing.wxml`、`pages/billing/billing.wxss`

**改动要点**：

- `loadGoods()` 改为分页：`pageSize: 20`，下拉到底部加载更多（`onReachBottom`）。
- 增加 `hasMore`、`loading` 状态，避免重复请求。
- 搜索关键词变化时重置页码并重新加载第一页。

**验收标准**：

- 首屏不再一次性拉取 200 条商品，改为首屏 20 条。
- 滚动加载更多正常，无重复数据。

> **完成：2026-10-16 @助手** —— `loadGoods(reset)` 分页实现：首屏/下拉刷新/开单完成后重置第一页，`onReachBottom` 触底加载下一页（`pageSize: 20`）；新增 `page/hasMore/loading` 状态与请求序号（`_goodsSeq`）丢弃过期响应；搜索改为服务端过滤（防抖 400ms，重置分页）；WXML 补充「加载中…/上拉加载更多/没有更多商品了」提示，空状态仅在加载完成后展示；「商品列表」样式与项目既有 `goods` 页分页模式保持一致。

#### P1-4. 商品列表图片懒加载

**涉及文件**：`pages/billing/billing.wxml`、`pages/goods/goods.wxml` 及相关 wxss

**改动要点**：

- `image` 组件增加 `lazy-load="true"`。
- 商品封面统一通过 `resolveImg()` 处理，失败时展示占位图。

**验收标准**：

- 商品列表滚动时图片按需加载，首屏数据量减少。

> **完成：2026-10-16 @助手** —— 开单页与商品页列表图片均加 `lazy-load`；封面继续统一走 `resolveImg()`；新增 `binderror` 兜底（加载失败置空封面）并在 WXML 中渲染图标占位块（`.goods-img-empty` / `.img-placeholder`），无图/加载失败不再是空白；购物车小图同样启用懒加载。

---

### P2 阶段：可靠性与可观测性（建议第 5-8 周完成）

#### P2-1. 接入结构化日志系统

**涉及文件**：新建 `backend/utils/logger.js`，修改 `backend/server.js`、各 route 文件中的 `console.error`

**改动要点**：

- 引入 `pino`（或 `winston`），支持日志分级（info/warn/error）、JSON 格式、按天切割。
- 生产环境输出 JSON 日志，便于云日志平台采集。
- 替换全局 `console.error(err)` 为 `logger.error({ err, ... })`。

**验收标准**：

- 后端日志可按级别过滤，错误日志包含请求 ID 等上下文。
- 生产环境日志为结构化 JSON。

> **完成：2026-10-16 @助手** —— 新增 `backend/utils/logger.js`（pino）：生产输出 JSON 单行日志（可被云日志平台按级别采集），开发环境自动使用 pino-pretty 彩色输出（pino-pretty 为 devDependency，不进入生产镜像）；配置 `redact` 脱敏密码/令牌/密钥字段；`server.js` 为每个请求生成 `reqId`（支持透传 `X-Request-Id`）并挂载 `req.log` 子日志器，全局错误处理与健康检查错误均带请求上下文；`db.js`、`auth.js`、`upload.js` 的 `console.*` 全部替换为分级日志；访问日志以 debug 级别记录（状态码/耗时）。

#### P2-2. 增强健康检查接口

**涉及文件**：`backend/server.js`

**改动要点**：

- `GET /api/health` 返回数据库连接状态（`SELECT 1`）、内存占用（`process.memoryUsage()`）、服务版本号、运行时间。

**验收标准**：

- 云托管可基于该接口进行健康探测与自动重启。
- 数据库断开时健康检查返回非健康状态。

> **完成：2026-10-16 @助手** —— `/api/health` 返回 `data = { status, db, version, env, uptimeSeconds, memory{rss,heapUsed,heapTotal}, timestamp }`；数据库探测 `SELECT 1` 带 2 秒超时，失败返回 HTTP 503 + `status=down`；向后兼容仍返回 `{ code: 0, message: 'ok' }`；测试覆盖数据库正常/异常两种状态（`backend/test/auth.test.js`）。

#### P2-3. 补全数据库查询索引

**涉及文件**：`backend/schema.sql`、`backend/db.js`（迁移部分）

**改动要点**：

- 为高频筛选字段添加复合索引：
  - `orders(store_id, status, created_at)`
  - `goods(store_id, is_deleted, on_sale)`
  - `order_item(order_id)`
  - `customer(store_id, phone)`
- 迁移脚本保持幂等，已有表可安全重复执行。

**验收标准**：

- 订单列表、商品列表、会员查找等高频查询在数据量增长后响应时间稳定。

> **完成：2026-10-16 @助手** —— `db.js` 新增 `ensureIndex()` 幂等迁移（按索引名检查后创建）：`orders` 增加 `(store_id, status, created_at)` 与 `(store_id, created_at)`，`goods` 增加 `(store_id, is_deleted, on_sale)`，`goods_sku` 增加 `(goods_id, color, size)`（开单查规格热路径）；`schema.sql` 同步更新（新库直接带索引）。说明：`order_item(order_id)` 与 `customer(store_id, phone)` 在原表结构中已存在（`idx_order_item_order`、唯一键 `uniq_customer_store_phone`），无需重复添加。

#### P2-4. 支持优雅关闭与请求超时

**涉及文件**：`backend/server.js`、`backend/db.js`

**改动要点**：

- HTTP 服务监听后保留 `server` 引用。
- 监听 `SIGTERM`/`SIGINT`，先停止接受新连接，再关闭数据库连接池，最后退出进程。
- 给 `wx.request` 对应的后端路由增加超时中间件（可选，建议 `express-timeout` 或手动实现）。

**验收标准**：

- 容器重启/部署时，正在处理的请求能完成，无强制中断导致的事务异常。

> **完成：2026-10-16 @助手** —— 新增 `setupGracefulShutdown(server)`：收到 `SIGTERM`/`SIGINT` 后停止接收新连接，等待在途请求完成后调用 `closePool()` 关闭 MySQL 连接池再退出，10 秒兜底强制退出；超时采用 Node HTTP Server 级 `requestTimeout / headersTimeout / keepAliveTimeout`（默认 60s，可通过 `REQUEST_TIMEOUT_MS` 调整），超时以 408 结束慢连接，避免手动超时中间件在异步路由中「响应已发送后再次写入」的风险；`db.js` 新增导出 `closePool()`。

---

### P3 阶段：代码质量与工程化（建议第 9-12 周完成）

#### P3-1. 引入 TypeScript（小程序端）

**涉及文件**：`utils/api.js`、`utils/util.js`、`utils/dialog.js` 优先迁移，后续逐页迁移 `pages/**`

**改动要点**：

- 新增 `tsconfig.json`（面向微信小程序，`target: ES2020`, `module: commonjs` 等）。
- 核心工具类先改为 `.ts`，配合 `wx-types` 类型定义。
- `project.config.json` 中 `es6: true` 保持，开发者工具可编译 TS（或构建时预编译）。

**验收标准**：

- `utils/api.ts`、`utils/util.ts` 可正常编译并运行，无类型错误阻塞。

> **完成：2026-10-16 @助手** —— 新增根 `tsconfig.json`（ES2020 + CommonJS + strict，类型定义使用官方 `miniprogram-api-typings`）；`utils/api.js`、`utils/util.js`、`utils/dialog.js` 迁移为 `.ts` 并提供完整类型（请求参数/业务错误码/弹窗选项等），原 `.js` 已删除（页面 `require` 无需改动）；`project.config.json` 设置 `useCompilerPlugins: ["typescript"]` 由开发者工具编译；根目录 `npm run typecheck`（tsc --noEmit）校验通过，零类型错误；`pages/**` 保持 JS，后续可逐页迁移设置 `allowJs`。

#### P3-2. 增加后端核心接口集成测试

**涉及文件**：新建 `backend/test/`，修改 `backend/package.json`（添加 `jest`、`supertest`）

**改动要点**：

- 测试用例覆盖：
  - `/api/auth/login` / `/api/auth/register`（成功、失败、频率限制）
  - `/api/orders` 创建订单（库存扣减事务成功、库存不足回滚、并发超卖防护）
  - `/api/orders/:id/cancel` / `refund`（库存归还）
- 使用内存数据库或测试用 MySQL 实例运行测试。

**验收标准**：

- 核心接口测试覆盖率 ≥ 70%。
- `npm test` 能在 CI 中自动运行并通过。

> **完成：2026-10-16 @助手** —— 新增 4 个测试文件 36 个用例：`auth.test.js`（注册校验/成功、登录失败/成功、健康检查）、`ratelimit.test.js`（第 11 次登录请求 429）、`orders.test.js`（开单成功/库存不足回滚/订单号撞号重试/授权失效、列表/详情/状态流转、取消与退款库存归还）、`goods.test.js`（SKU 批量查询断言、上传类型/大小/伪装扩展名限制、错误脱敏、未知接口 404）；`server.js` 重构导出 `createApp()` 工厂，db 层 jest.mock，无需真实 MySQL 即可运行；核心模块（routes/auth、routes/orders、routes/goods、middleware）行覆盖率 71%（`npm run test:coverage`，阈值 70% 已写入 jest 配置）。

#### P3-3. 生成 Swagger API 在线文档

**涉及文件**：新建 `backend/swagger.js`，挂载到 `backend/server.js`

**改动要点**：

- 引入 `swagger-jsdoc` + `swagger-ui-express`。
- 为各路由添加 JSDoc 注解，生成 `/api-docs` 在线文档。

**验收标准**：

- 可通过浏览器访问 `/api-docs` 查看全部接口定义、请求参数与返回示例。

> **完成：2026-10-16 @助手** —— 新增 `backend/swagger.js`（OpenAPI 3.0.3：统一响应/错误、Goods/Order/Sku schema、bearerAuth 安全定义、分组 tags、三套服务器地址）；9 个路由文件均添加 `@openapi` 注解（共 32 个接口，含请求参数与响应说明）；`server.js` 挂载 `/api-docs`（UI）与 `/api-docs.json`（原始规范），可用 `ENABLE_API_DOCS=false` 关闭；因 Windows 下 glob 通配符兼容问题，文档扫描改为显式枚举路由文件。

#### P3-4. 统一代码格式化与提交检查

**涉及文件**：新建 `.prettierrc`、`.husky/pre-commit`，修改 `package.json`（小程序根及 backend）

**改动要点**：

- 引入 Prettier 统一代码格式。
- Husky pre-commit hook 运行 `eslint --fix` + `prettier --check`。
- 小程序与 backend 分别配置，避免互相干扰。

**验收标准**：

- `git commit` 前自动检查代码格式，不符合规范的提交被拦截。

> **完成：2026-10-16 @助手** —— 根目录新增 `package.json`（typescript/prettier/husky/lint-staged/eslint 工具链）与 `.prettierrc`、`.prettierignore`；`backend/` 独立 `.prettierrc`、`.prettierignore` 互不干扰；Husky 已执行 `husky init`（`core.hooksPath=.husky/_`），`.husky/pre-commit` 运行 `npx lint-staged`：暂存文件自动执行 `eslint --fix`（JS）、`prettier --write`（JS/TS/JSON/MD/WXSS），lint/格式错误将阻断提交；本次改动文件已全量按 Prettier 规范格式化；`.eslintrc.js` 清理了废弃的 `ecmaFeatures` 配置。

---

## 五、实施路线图（执行结果）

| 阶段            | 计划       | 主要任务                                                    | 执行结果               |
| --------------- | ---------- | ----------------------------------------------------------- | ---------------------- |
| **P0 安全加固** | 第 1 周    | JWT 密钥强制、登录频率限制、CORS 限制、上传限制、错误脱敏   | ✅ 2026-10-16 全部完成 |
| **P1 性能优化** | 第 2-4 周  | 商品列表批量查 SKU、订单号去重、小程序商品分页、图片懒加载  | ✅ 2026-10-16 全部完成 |
| **P2 可观测性** | 第 5-8 周  | 接入结构化日志、健康检查增强、DB 索引补全、优雅关闭         | ✅ 2026-10-16 全部完成 |
| **P3 工程化**   | 第 9-12 周 | TypeScript 核心迁移、集成测试、Swagger 文档、Prettier/Husky | ✅ 2026-10-16 全部完成 |

---

## 六、给后续执行助手的建议

1. **先读代码再改**：每个任务开始前，先完整阅读涉及文件，理解现有逻辑再做修改。
2. **一个分支完成一个任务**：建议每个优化任务独立建 Git 分支，完成后合并并回归测试。
3. **优先 P0**：安全问题属于“阻塞项”，必须在其他性能/工程化工作之前完成。
4. **保持向后兼容**：接口返回结构 `{ code, message, data }` 不要擅自改变，避免影响小程序端和 Web 后台。
5. **记录变更**：每个任务完成后，在本文档对应条目下标注 `完成：YYYY-MM-DD @助手`，并简要说明实际改动。

---

## 七、上线前检查清单（本次优化引入的部署注意项）

1. **云托管必须配置 `JWT_SECRET` 环境变量**，否则服务拒绝启动（见 P0-1）；配置后旧 Token 全部失效，用户需重新登录。
2. 浏览器端访问后端若来自新域名，需在 `CORS_ORIGIN` 中追加（默认仅放行 GitHub Pages 后台域名）。
3. 小程序端已启用 TypeScript 编译插件（`useCompilerPlugins`），需使用支持该功能的开发者工具版本（近几年的稳定版均支持）。
4. 首次启动后端：`ensureIndex()` 会自动为存量库补索引；建议在低峰期部署（大表加索引可能短暂锁表）。
5. 提交代码前请先在根目录执行一次 `npm install`（激活 Husky pre-commit hook）。

---

## 附录：关键文件索引

| 文件                                                       | 用途                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `backend/config.js`                                        | 后端运行时配置（端口、MySQL、JWT 强制校验、CORS、限流、日志、超时）               |
| `backend/server.js`                                        | Express 入口、中间件、健康检查、优雅关闭、全局错误处理（导出 `createApp` 供测试） |
| `backend/db.js`                                            | 数据库连接池、事务封装、建库建表迁移、索引迁移、错误脱敏、`closePool`             |
| `backend/schema.sql`                                       | 数据库表结构定义（含新增复合索引）                                                |
| `backend/routes/*.js`                                      | 各业务模块路由（auth/store/goods/orders/...）与 Swagger 注解                      |
| `backend/middleware/*.js`                                  | 鉴权与权限守卫（auth/requireStore/requirePlatform）                               |
| `backend/utils/logger.js`                                  | pino 结构化日志（分级 / JSON / 脱敏）                                             |
| `backend/swagger.js`                                       | OpenAPI 规范生成（/api-docs）                                                     |
| `backend/test/*.test.js`                                   | jest + supertest 集成测试（36 个用例）                                            |
| `utils/api.ts`                                             | 小程序请求封装（Token、重试、401 处理，TypeScript）                               |
| `utils/util.ts`、`utils/dialog.ts`                         | 通用工具与弹窗（TypeScript）                                                      |
| `pages/billing/billing.js`                                 | 开单收银核心页面（分页加载商品）                                                  |
| `pages/goods/goods.js`                                     | 商品管理页（图片懒加载 + 占位图）                                                 |
| `app.json`                                                 | 小程序全局配置                                                                    |
| `project.config.json`                                      | 微信开发者工具项目配置（启用 TypeScript 编译插件）                                |
| `tsconfig.json`                                            | 小程序端 TypeScript 配置（`npm run typecheck`）                                   |
| `package.json`（根） / `.prettierrc` / `.husky/pre-commit` | 前端工具链：Prettier、ESLint、Husky、lint-staged                                  |

---

_文档版本：v1.1（2026-10-16 完成 P0-P3 全阶段优化并标注执行结果）_  
_如需调整优先级或任务拆分，请在执行前更新本文档并同步给相关协作人员。_
