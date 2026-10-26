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
├── web/                            # Web 管理后台（静态 SPA，零构建）
│   ├── index.html                  # 入口（加载 js/app.js 模块）
│   ├── manifest.json sw.js         # PWA 清单与 Service Worker
│   ├── js/                         # 原生 ES Modules（shell/store/ui/pages/...）
│   ├── styles/                     # 拆分样式（base/theme/layout/components/pages/responsive/print）
│   └── assets/                     # PWA 图标与 favicon
├── styles/icons.source.json        # Web 与小程序共享的图标源
├── scripts/build-icons.js          # 图标生成 / 校验脚本
├── scripts/build-pwa-icons.js      # PWA 图标生成脚本
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

- **样式拆分**：`web/styles/` 按 `base` / `theme` / `layout` / `components` / `pages` / `responsive` / `print` 分层，页面只引用汇总入口。
- **JS 模块化**：`web/js/` 使用原生 ES Modules（无打包器），入口 `app.js`；`bus.js` 事件总线解除 store → shell 循环依赖，页面通过 `requestRender()` 触发重渲染。
- **图标共享**：图标统一收敛到 `styles/icons.source.json`，由 `npm run icons:build` 生成 `web/icons.css` 与小程序 `styles/icons.wxss` / `styles/icons-extra.wxss`；`npm run icons:check` 校验生成物是否同步。
- **深色模式**：`data-theme="dark"` 覆盖语义 Token，首屏内联脚本提前应用避免闪白，可在侧边栏 / 登录页切换并记忆。
- **侧边栏折叠**：桌面端可收起为图标模式（移动端保持横向导航），状态持久化到 `localStorage`。
- **效率增强**：面包屑导航、键盘快捷键（`Ctrl/Cmd+K`、`S`、`N`、`Alt+1~7`、`?`、`Esc`）、订单小票打印（`styles/print.css`）、全局错误边界（异常不白屏）。
- **性能**：开单页商品按 30 条/页加载并提供「加载更多」，商品与开单图片使用原生 `loading="lazy"` 懒加载。
- **PWA**：`manifest.json` + `sw.js`（缓存版本 `cj-admin-v5`），可安装到桌面；导航与脚本 / 样式网络优先（离线回退缓存），图片 / 字体 Stale-While-Revalidate，`/api/` 与跨域请求不缓存。PWA 图标由 `node scripts/build-pwa-icons.js` 生成。

## CI / CD 工作流

| 工作流                            | 触发条件                  | 作用                                    |
| --------------------------------- | ------------------------- | --------------------------------------- |
| `deploy-web.yml`                  | push 修改 `web/**` 或手动 | 发布 Web 后台到 GitHub Pages            |
| `docker-image.yml`                | push master / PR          | 构建后端 Docker 镜像验证                |
| `npm-publish-github-packages.yml` | 创建 Release              | 测试通过后发布 npm 包到 GitHub Packages |

## 版本历史

| 版本    | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.11   | 蓝牙小票打印 + 店主多店铺支持                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| v1.12   | Web 版管理系统（GitHub Pages 部署）、平台管理页、权限探测兜底                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| v1.13   | 全站 UI/UX 优化（设计变量、矢量图标、自定义 TabBar）、购物车持久化、成功卡片、低库存预警、批量上下架/删除、订单状态 tab + 时间筛选、近 7 天销售趋势、登录记住账号、Web 端同步优化、后端配套（货号搜索、dashboard 周期/趋势/低库存）                                                                                                                                                                                                                                                                                                                                                                                      |
| v1.14.0 | 首页精简（移除快捷入口与今日单据模块，销售额与单数合并同行）；全站导航栏标题统一为「裁间」；商品页分类入口改为三横杠图标按钮并移至行首（无底框）；自定义 TabBar 背景兜底 + 五个标签统一按下反馈；会员弹窗性别选择改为胶囊分段、姓氏与性别同行；空状态文案减淡去粗                                                                                                                                                                                                                                                                                                                                                        |
| v1.14.1 | 全面优化（P0-P3）：安全加固（JWT 密钥强制、登录限流、CORS 白名单、上传校验、错误脱敏）；性能优化（SKU 批量查询、订单号唯一防重、开单页分页 + 搜索、图片懒加载占位）；可观测性与稳定性（结构化日志、健康检查、索引自动迁移、优雅关闭）；工程化（TypeScript 迁移、Jest 测试与覆盖率、Swagger 在线文档、Prettier + husky 提交钩子）                                                                                                                                                                                                                                                                                         |
| v1.15.0 | 注册与绑定流程重构：登录页精简为纯登录，新增独立「注册+绑定」页（三步：注册账号 → 绑定店铺 → 完成，含步骤条与进度线）；新增欢迎页（品牌 + 成功动效 + 功能引导）；未绑定兜底入口统一（首页 / 我的页 / 接口 1001 / 登录成功）指向注册页 mode=bind；退役 `pages/setup`；后端零改动                                                                                                                                                                                                                                                                                                                                          |
| v1.15.1 | 全站 UI 清透质感改版（Glassmorphism × Soft UI：三层背景光晕、玻璃五档分层、统一圆角/阴影/动效、TabBar 与弹层重做、无障碍降级）；开单页结算栏由底部吸附改为随内容滚动；移除「当场已收款」卡片，开单后订单统一为待收款                                                                                                                                                                                                                                                                                                                                                                                                     |
| v1.16.0 | P0–P3 UI/交互修复：经营看板书签配色与凹角过渡；店铺卡右下角把手拖拽展开/收起、收起高度实测、拖拽期间页面滚动锁定与空成员降级；开单页结算栏固定并与自定义 TabBar 融合，无开单权限保持完整胶囊；补充安全区与无障碍降级                                                                                                                                                                                                                                                                                                                                                                                                     |
| v1.17.0 | P0–P3 UI/UX 落地：订单状态时间线（后端状态时间戳 + 详情页时间线/脉冲）；商品图片裁剪（原生 `wx.editImage` 裁剪、预览与设封面）；首页快捷开单/拍照上传、今日待办、同比环比与错峰淡入；开单规格选择器（常用规格记忆、低库存虚线橙框、长按每次加 5）；会员 CRM（等级徽章/标签/生日提醒/快捷备注）；打印设置（三模板 + 58/80mm、最近 10 条打印记录、离线提示）；Web 侧边栏导航分组；补充矢量图标与光晕按需渲染；补做：商品图片长按拖拽排序、通用骨架屏组件 `skeleton-card`、补齐 `star/crown/gem/gift/layout/document` 图标、快速开单预置常用商品                                                                            |
| v1.17.1 | UI 规范审核整改 + 首屏防抖：首页信息层级重排（销售额主卡 → 快捷开单/商品上传 → 今日待办 → 「商品概览 + 近 7 天销售」合并数据卡 → 低库存），移除独立的待收款/本期订单卡；自定义 TabBar 由 `billingDock` 泛化为 `dock`（开单结算栏 / 商品批量栏共用），`attached` 首帧按当前路由推导选中态与拼接态且关闭形变动画，状态未变不下发 `setData`，消除进页面瞬间的跳动与重绘；开单页接入店铺授权缓存首帧渲染、按字段增量更新、购物车无变化不回填、二次进入静默刷新并接入 `skeleton-card`；全局导航栏/窗口底色微调（`app.json`）；依 `UI-AUDIT-REPORT.md` 统一各页间距为 4 的倍数、圆角/字号走 Token                              |
| v1.17.2 | 请求链路改造（云托管默认域名仅供测试，微信不允许用于正式环境）：业务请求改走 `wx.cloud.callContainer`（云开发 → 云托管，免服务器域名白名单与备案校验，无云开发时回退 `wx.request`）；重试改为指数退避 1.5/3/6/10s 覆盖冷启动，失败提示带 `errMsg` 便于定位；商品图片上传改为压缩后 base64 经后端 `POST /api/upload/base64` 保存（后端新增该接口，JSON 体上限 1MB→8MB，复用 COS 持久化），Web 后台同样可显示，后端不可用时回退云开发存储直传；`resolveImg` 兼容 `cloud://` fileID；部署修复：`Dockerfile` 的 Alpine 源换腾讯镜像且 `tzdata` 安装失败不阻断构建，`nowStr()` 改为显式按 UTC+8 计算（不依赖容器时区/tzdata） |
| v1.18.0 | 性能与文档双整改：Web 管理后台拆分为 16 个原生 ES Module（`web/js/`，零构建）+ 7 层 CSS，`bus.js` 解除 store→shell 循环依赖；开单页改 `pageSize=30` 分页 + 加载更多、图片 `loading="lazy"` 懒加载，开单后重置分页；新增面包屑、快捷键、错误边界、小票打印、PWA（SW v5 / 32 项预缓存）、深色模式与侧边栏折叠；小程序购物车数量改为 `setData` 路径更新，15/15 页面补 ARIA，图片上传压缩；新增 `scripts/build-icons.js` 统一生成 Web/小程序图标并校验；补全设计规范、优化方案与两轮审查报告；接入 `lint:web` / `format:check`                                                                                               |
