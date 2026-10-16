# 服装店管理系统

服装零售门店进销存 / 收银管理系统，包含 **微信小程序客户端**、**Web 管理后台** 与 **Node.js 后端服务** 三部分。

## 功能特性

### 小程序端

- **账号体系**：账号密码自由注册登录，JWT 登录态持久化
- **店铺管理**：创建店铺（店主上限 3 家）、凭店铺码加入、多店切换、成员管理、重置店铺码
- **商品管理**：商品列表搜索、上下架、颜色 / 尺码 SKU 组合、库存管理、分类拖拽排序
- **开单收银**：选规格组购物车、开单自动扣库存（事务保证）、订单流转（待收款 → 已收款 → 已完成）、取消 / 售后自动归还库存
- **经营看板**：今日销售额、订单数、待收款、商品在售统计及最近单据
- **蓝牙打印**：ESC/POS 小票打印机配对、连接、测试打印与补打小票（内置 UTF-8 → GBK 编码表支持中文）
- **平台管理**：平台管理员控制各店铺"开单"功能的授权时效（白名单）

### Web 管理后台（GitHub Pages）

纯静态单页应用，与小程序功能对齐：登录注册、店铺绑定、仪表盘、商品 / 分类 / 开单 / 订单管理、平台管理页，支持 502/503/504 自动重试（应对云托管冷启动）。

### 后端服务

- Express + MySQL（mysql2 连接池），bcrypt 密码加密，JWT 鉴权
- 三级中间件守卫：登录鉴权（auth）→ 店铺绑定（requireStore）→ 平台权限（requirePlatform）
- 图片上传：multer 接收（限制 5MB 与 JPG/PNG/WebP），可配置腾讯云 COS，否则落本地磁盘
- 建库建表自动迁移（`schema.sql`），查询索引幂等补全
- 安全与可观测：登录/注册频率限制、CORS 白名单、错误脱敏、pino 结构化日志、增强健康检查、优雅关闭
- 接口文档：Swagger UI（`/api-docs`）；集成测试：jest + supertest（`npm test`）

## 角色体系

| 角色       | 权限                               |
| ---------- | ---------------------------------- |
| 平台管理员 | 查看全部店铺，设置各店开单授权时效 |
| 店主       | 创建 / 管理多家店铺、店铺码、成员  |
| 店员       | 凭店铺码加入店铺，开单收银         |

## 目录结构

```
├── app.js / app.json / app.wxss    # 小程序全局入口与配置
├── pages/                          # 小程序页面
│   ├── index/                      # 首页仪表盘
│   ├── login/                      # 登录 / 注册
│   ├── store/                      # 店铺管理（多店切换）
│   ├── goods/ goods-edit/ category/# 商品与分类管理
│   ├── billing/                    # 开单收银
│   ├── orders/ order-detail/       # 订单列表与详情
│   ├── printer-pair/               # 蓝牙打印机配对
│   └── platform/                   # 平台管理（开单授权）
├── utils/                          # 工具模块（核心工具已迁移 TypeScript）
│   ├── api.ts                      # 请求封装（Token / 401 / 自动重试）
│   ├── util.ts                     # 金额格式化、状态文案等
│   ├── dialog.ts                   # 对话框与提示（Promise 化）
│   ├── escpos.js gbk.js printer.js receipt.js   # ESC/POS 蓝牙打印
│   └── theme.js                    # 主题换肤
├── components/navigation-bar/      # 自定义导航栏组件
├── web/                            # Web 管理后台（静态 SPA）
├── backend/                        # Node.js 后端
│   ├── server.js config.js db.js   # 服务入口 / 配置 / 数据库
│   ├── swagger.js                  # Swagger/OpenAPI 文档生成（/api-docs）
│   ├── schema.sql                  # MySQL 表结构
│   ├── routes/                     # 业务路由（auth/store/goods/orders/...）
│   ├── middleware/                 # 鉴权与权限守卫
│   ├── utils/logger.js             # pino 结构化日志
│   ├── test/                       # jest + supertest 集成测试
│   └── Dockerfile                  # 云托管部署镜像
├── docs/optimization-plan.md       # 项目优化方案与完成情况
└── .github/workflows/              # CI/CD 工作流
```

> 注：`.json` 配置文件因格式限制无法包含注释，各文件用途见对应模块的同名 `.js` / `.wxml` 文件头注释。

## 快速开始

### 后端（本地开发）

```bash
cd backend
npm install            # 或 Windows 下双击 install.bat
npm run start:dev      # 开发模式启动（或双击 start.bat，日志写入 server.log）
npm test               # 运行 jest + supertest 集成测试（无需真实 MySQL）
```

依赖 MySQL，连接参数通过环境变量配置（见 `backend/config.js`），首次启动自动建库建表：

| 环境变量                                                                         | 说明                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `JWT_SECRET`                                                                     | JWT 密钥。**生产环境必填**（未配置拒绝启动）；开发模式用 `npm run start:dev` 可省略       |
| `MYSQL_ADDRESS` / `MYSQL_USERNAME` / `MYSQL_PASSWORD`                            | 云托管自动注入的 MySQL 连接信息                                                           |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | 本地开发覆盖用                                                                            |
| `CORS_ORIGIN`                                                                    | 浏览器来源白名单（英文逗号分隔），默认仅 `https://uneistuo.github.io`；小程序请求不受影响 |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`                                        | 登录/注册频率限制（默认 15 分钟 10 次）                                                   |
| `LOG_LEVEL`                                                                      | 日志级别（默认 info；生产输出 JSON 结构化日志）                                           |
| `ENABLE_API_DOCS`                                                                | 设为 `false` 可关闭 `/api-docs` 在线接口文档                                              |
| `UPLOAD_MAX_BYTES` / `REQUEST_TIMEOUT_MS`                                        | 上传大小上限（默认 5MB）/ 请求超时（默认 60s）                                            |

接口文档：启动后访问 `http://127.0.0.1:3000/api-docs`（OpenAPI 原始规范：`/api-docs.json`）。
健康检查：`GET /api/health` 返回数据库状态、内存占用、版本号与运行时间。

### 后端（Docker / 微信云托管）

`backend/Dockerfile` 基于 node:22-alpine，推送 master 分支后由 GitHub Actions 自动构建验证镜像。
**部署前请在云托管「服务设置-环境变量」中配置 `JWT_SECRET`**（随机长字符串，可用
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` 生成），否则服务将拒绝启动。

### 小程序

微信开发者工具导入项目根目录即可预览；`utils/api.ts` 自动切换本地 / 云托管请求地址。
核心工具类（`utils/api`、`utils/util`、`utils/dialog`）已迁移 TypeScript，
开发者工具通过 `project.config.json` 的 `useCompilerPlugins: ["typescript"]` 编译；
本地类型检查：根目录执行 `npm install && npm run typecheck`。

### 代码规范（根目录）

```bash
npm run lint           # ESLint 检查小程序端 JS
npm run format         # Prettier 全量格式化（含 TS / JSON / Markdown）
```

Git 提交前由 Husky + lint-staged 自动对暂存文件执行 ESLint/Prettier 修复，格式不合格的提交无法通过。

### Web 管理后台

`web/` 目录变更时由 GitHub Actions 自动发布到 GitHub Pages，无需手动部署。

## CI / CD 工作流

| 工作流                            | 触发条件                  | 作用                                    |
| --------------------------------- | ------------------------- | --------------------------------------- |
| `deploy-web.yml`                  | push 修改 `web/**` 或手动 | 发布 Web 后台到 GitHub Pages            |
| `docker-image.yml`                | push master / PR          | 构建后端 Docker 镜像验证                |
| `npm-publish-github-packages.yml` | 创建 Release              | 测试通过后发布 npm 包到 GitHub Packages |

## 版本历史

| 版本    | 说明                                                                                                                                                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.11   | 蓝牙小票打印 + 店主多店铺支持                                                                                                                                                                                                                                                                                                    |
| v1.12   | Web 版管理系统（GitHub Pages 部署）、平台管理页、权限探测兜底                                                                                                                                                                                                                                                                    |
| v1.13   | 全站 UI/UX 优化（设计变量、矢量图标、自定义 TabBar）、购物车持久化、成功卡片、低库存预警、批量上下架/删除、订单状态 tab + 时间筛选、近 7 天销售趋势、登录记住账号、Web 端同步优化、后端配套（货号搜索、dashboard 周期/趋势/低库存）                                                                                              |
| v1.14.0 | 首页精简（移除快捷入口与今日单据模块，销售额与单数合并同行）；全站导航栏标题统一为「裁间」；商品页分类入口改为三横杠图标按钮并移至行首（无底框）；自定义 TabBar 背景兜底 + 五个标签统一按下反馈；会员弹窗性别选择改为胶囊分段、姓氏与性别同行；空状态文案减淡去粗                                                                |
| v1.14.1 | 全面优化（P0-P3）：安全加固（JWT 密钥强制、登录限流、CORS 白名单、上传校验、错误脱敏）；性能优化（SKU 批量查询、订单号唯一防重、开单页分页 + 搜索、图片懒加载占位）；可观测性与稳定性（结构化日志、健康检查、索引自动迁移、优雅关闭）；工程化（TypeScript 迁移、Jest 测试与覆盖率、Swagger 在线文档、Prettier + husky 提交钩子） |
