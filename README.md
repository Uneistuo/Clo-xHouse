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
- 图片上传：multer 接收，可配置腾讯云 COS，否则落本地磁盘
- 建库建表自动迁移（`schema.sql`）

## 角色体系

| 角色 | 权限 |
|------|------|
| 平台管理员 | 查看全部店铺，设置各店开单授权时效 |
| 店主 | 创建 / 管理多家店铺、店铺码、成员 |
| 店员 | 凭店铺码加入店铺，开单收银 |

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
├── utils/                          # 工具模块
│   ├── api.js                      # 请求封装（Token / 401 / 自动重试）
│   ├── escpos.js gbk.js printer.js receipt.js   # ESC/POS 蓝牙打印
│   └── util.js                     # 金额格式化、状态文案等
├── components/navigation-bar/      # 自定义导航栏组件
├── web/                            # Web 管理后台（静态 SPA）
├── backend/                        # Node.js 后端
│   ├── server.js config.js db.js   # 服务入口 / 配置 / 数据库
│   ├── schema.sql                  # MySQL 表结构
│   ├── routes/                     # 业务路由（auth/store/goods/orders/...）
│   ├── middleware/                 # 鉴权与权限守卫
│   └── Dockerfile                  # 云托管部署镜像
└── .github/workflows/              # CI/CD 工作流
```

> 注：`.json` 配置文件因格式限制无法包含注释，各文件用途见对应模块的同名 `.js` / `.wxml` 文件头注释。

## 快速开始

### 后端（本地开发）

```bash
cd backend
npm install          # 或 Windows 下双击 install.bat
npm start            # 或双击 start.bat，日志写入 server.log
```

依赖 MySQL，连接参数通过环境变量配置（见 `backend/config.js`）：
`DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `JWT_SECRET` 等，首次启动自动建库建表。

### 后端（Docker / 微信云托管）

`backend/Dockerfile` 基于 node:22-alpine，推送 master 分支后由 GitHub Actions 自动构建验证镜像。

### 小程序

微信开发者工具导入项目根目录即可预览；`utils/api.js` 自动切换本地 / 云托管请求地址。

### Web 管理后台

`web/` 目录变更时由 GitHub Actions 自动发布到 GitHub Pages，无需手动部署。

## CI / CD 工作流

| 工作流 | 触发条件 | 作用 |
|--------|----------|------|
| `deploy-web.yml` | push 修改 `web/**` 或手动 | 发布 Web 后台到 GitHub Pages |
| `docker-image.yml` | push master / PR | 构建后端 Docker 镜像验证 |
| `npm-publish-github-packages.yml` | 创建 Release | 测试通过后发布 npm 包到 GitHub Packages |

## 版本历史

| 版本 | 说明 |
|------|------|
| v1.11 | 蓝牙小票打印 + 店主多店铺支持 |
| v1.12 | Web 版管理系统（GitHub Pages 部署）、平台管理页、权限探测兜底 |
