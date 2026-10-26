# 🚀 「裁间」Web 管理后台优化方案

> 版本：v1.1 | 日期：2026-10-26  
> 基于：GitHub 优秀项目调研 + 项目现状代码审计

> **实施状态（2026-10-26）**：图标提取、品牌统一、CSS 拆分（7 个分层文件）、侧边栏折叠、暗色模式、PWA、JS 模块化（原生 ES Modules）、键盘快捷键、面包屑、订单小票打印与错误边界均已完成。表格虚拟化、Vite/TypeScript 迁移与 E2E 测试列入暂缓（见文末执行计划）；实现以当前 `web/` 代码为准。

---

## 一、Web 端现状诊断

### 1.1 架构特点

```
纯静态 SPA（零框架、零构建）
├── index.html          → 入口（<script type="module" src="js/app.js">）
├── icons.css           → 共享矢量图标
├── manifest.json       → PWA 清单
├── sw.js               → Service Worker（v5）
├── styles/             → base / theme / layout / components / pages / responsive / print
└── js/
    ├── app.js          → 入口（错误边界 + PWA 注册）
    ├── config.js       → 后端地址 / 状态字典 / 导航
    ├── utils.js        → DOM / 转义 / 图片 / 防抖
    ├── bus.js          → 事件总线（requestRender，解除循环依赖）
    ├── store.js        → 登录态 + API（502/503/504 重试）
    ├── ui.js           → Toast / Modal / Confirm / Prompt
    ├── theme.js        → 暗色模式 + 侧边栏偏好
    ├── shell.js        → 登录 / 初始化 / 侧边栏 / 面包屑
    ├── shortcuts.js    → 全局键盘快捷键
    └── pages/          → dashboard / goods / billing / orders / customers / shop / platform
部署：GitHub Pages（自动 CI，仅发布 web/）
```

### 1.2 已知问题

> 以下为优化前基线记录；除「表格无虚拟化」暂缓外，其余问题均已在当前代码中处理，完成状态见第十一节执行计划。

| 问题               | 严重度 | 位置                              | 说明                               |
| ------------------ | ------ | --------------------------------- | ---------------------------------- |
| **单文件过大**     | 🔴 P0  | style.css 1272 行, app.js 1271 行 | 维护困难，无法 Tree-shaking        |
| **图标重复定义**   | 🔴 P0  | style.css 1054-1143 行            | 22 个 SVG base64 与小程序重复      |
| **品牌名不统一**   | 🟡 P1  | sidebar .brand                    | 小程序「裁间」vs Web「服装店管理」 |
| **无侧边栏折叠**   | 🟡 P1  | .sidebar                          | 桌面端浪费空间                     |
| **无暗色模式**     | 🟡 P1  | :root tokens                      | 夜间使用疲劳                       |
| **开单页全量加载** | 🟡 P1  | app.js renderBilling              | 一次性拉取 200 条商品              |
| **无键盘快捷键**   | 🟢 P2  | app.js                            | 无全局快捷键支持                   |
| **无 PWA 支持**    | 🟢 P2  | 无 manifest.json                  | 无法离线使用/安装                  |
| **表格无虚拟化**   | 🟢 P3  | renderOrders, renderGoods         | 大数据量时渲染慢                   |

---

## 二、P0 优化：代码结构重构

### 2.1 目录拆分方案

> 下图为重构初期的目标结构；最终落地使用原生 ES Modules，实际文件清单见 §1.1。

```
web/
├── index.html                    # 入口（不变）
├── style.css                     # 删除，拆分为：
│   ├── tokens.css                # :root 变量（60 行）
│   ├── layout.css                # 布局：sidebar, main, layout（120 行）
│   ├── components.css            # 组件：按钮/卡片/表单/表格/弹窗（400 行）
│   ├── pages.css                 # 页面级样式：仪表盘/商品/开单/订单（300 行）
│   └── responsive.css            # 响应式 + 无障碍（200 行）
├── app.js                        # 删除，拆分为：
│   ├── core.js                   # 工具函数：api, toast, confirm, prompt, debounce（200 行）
│   ├── auth.js                   # 认证逻辑：登录/注册/店铺绑定（150 行）
│   ├── router.js                 # 路由：hash 路由 + 页面分发（100 行）
│   ├── dashboard.js              # 仪表盘页面逻辑（150 行）
│   ├── goods.js                  # 商品管理页面逻辑（250 行）
│   ├── billing.js                # 开单页面逻辑（300 行）
│   ├── orders.js                 # 订单管理页面逻辑（200 行）
│   ├── customers.js              # 会员管理页面逻辑（150 行）
│   ├── store.js                  # 店铺管理页面逻辑（100 行）
│   └── platform.js               # 平台管理页面逻辑（100 行）
├── icons.css                     # 矢量图标（从 style.css 提取，200 行）
├── manifest.json                 # PWA 清单（新增）
├── sw.js                         # Service Worker（新增）
└── assets/
    └── images/                   # 静态资源
```

### 2.2 分步重构策略

**Step 1：提取图标（1 天）**

```bash
# 从 style.css 第 1054-1143 行提取为独立 icons.css
# 小程序端同步引入
```

**Step 2：拆分 CSS（2 天）**

```bash
# 按模块拆分为 5 个 CSS 文件
# 在 index.html 中按序引入
```

**Step 3：拆分 JS（3 天）**

```bash
# 按页面/模块拆分为 10 个 JS 文件
# 核心工具放 core.js，页面逻辑各自独立
```

### 2.3 HTML 入口更新

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#F3F5FA" />
    <meta name="description" content="裁间 - 服装店进销存管理系统" />
    <title>裁间 · 管理后台</title>

    <!-- 样式：按序加载 -->
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="icons.css" />
    <link rel="stylesheet" href="layout.css" />
    <link rel="stylesheet" href="components.css" />
    <link rel="stylesheet" href="pages.css" />
    <link rel="stylesheet" href="responsive.css" />

    <!-- PWA -->
    <link rel="manifest" href="manifest.json" />
    <link rel="apple-touch-icon" href="assets/icons/icon-192.png" />
  </head>
  <body>
    <div id="app"></div>
    <div id="toast" class="toast"></div>
    <div id="modal-root"></div>

    <!-- 脚本：按依赖顺序加载 -->
    <script src="core.js"></script>
    <script src="auth.js"></script>
    <script src="router.js"></script>
    <script src="dashboard.js"></script>
    <script src="goods.js"></script>
    <script src="billing.js"></script>
    <script src="orders.js"></script>
    <script src="customers.js"></script>
    <script src="store.js"></script>
    <script src="platform.js"></script>
    <script src="app-init.js"></script>
  </body>
</html>
```

---

## 三、P1 优化：侧边栏折叠

### 3.1 设计方案

```
折叠前（展开态，220px）：
┌────────────┬─────────────────────────────┐
│ 裁间        │                             │
│ ─────────  │                             │
│ 🏠 首页     │   主要内容区                 │
│ 👕 商品     │                             │
│ 📝 开单     │                             │
│ 📦 订单     │                             │
│ 👥 会员     │                             │
│ 🏪 店铺     │                             │
│ 🛡️ 平台     │                             │
│ ─────────  │                             │
│ 我的店铺    │                             │
│ 张三 · 店主 │                             │
└────────────┴─────────────────────────────┘

折叠后（收起态，64px）：
┌────┬─────────────────────────────┐
│裁  │                             │
│间  │   主要内容区（更宽）           │
│─   │                             │
│🏠  │                             │
│👕  │                             │
│📝  │                             │
│📦  │                             │
│👥  │                             │
│🏪  │                             │
│🛡️ │                             │
│─   │                             │
│👤  │                             │
└────┴─────────────────────────────┘
```

### 3.2 实现方案

```css
/* layout.css */
.sidebar {
  width: var(--sidebar-width, 220px);
  transition: width var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width, 64px);
}

.sidebar.collapsed .brand span,
.sidebar.collapsed .nav-group-title,
.sidebar.collapsed .side-user div:not(.store-name),
.sidebar.collapsed .side-user button {
  display: none;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 11px 0;
  margin: 2px 8px;
}

.sidebar.collapsed .nav-item .icon {
  font-size: 20px;
}

/* 折叠按钮 */
.sidebar-toggle {
  position: absolute;
  right: -12px;
  top: 50%;
  width: 24px;
  height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-3);
  font-size: 12px;
  transition: var(--transition);
  z-index: 10;
}

.sidebar-toggle:hover {
  color: var(--primary-dark);
  background: var(--bg-card-strong);
}
```

```javascript
// core.js - 折叠状态持久化
const COLLAPSED_KEY = 'cutian_sidebar_collapsed';

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem(COLLAPSED_KEY, isCollapsed ? '1' : '0');
}

function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (localStorage.getItem(COLLAPSED_KEY) === '1') {
    sidebar.classList.add('collapsed');
  }

  const toggleBtn = document.createElement('div');
  toggleBtn.className = 'sidebar-toggle';
  toggleBtn.innerHTML = '◀';
  toggleBtn.addEventListener('click', toggleSidebar);
  sidebar.style.position = 'relative';
  sidebar.appendChild(toggleBtn);
}
```

---

## 四、P1 优化：暗色模式

### 4.1 Token 扩展

```css
/* tokens.css - 新增暗色 Token */
:root {
  /* ===== 浅色主题（默认） ===== */
  --bg-app: #f3f5fa;
  --bg-gradient: linear-gradient(180deg, #f7f8fc 0%, #eef1f8 100%);
  --bg-card: rgba(255, 255, 255, 0.68);
  --bg-card-strong: rgba(255, 255, 255, 0.86);
  --bg-subtle: rgba(255, 255, 255, 0.46);
  --bg-overlay: rgba(255, 255, 255, 0.82);

  --text-1: #1d222b;
  --text-2: #5a6270;
  --text-3: #97a0ae;
  --text-placeholder: #b6bdc9;

  --glass-border: rgba(255, 255, 255, 0.72);
  --hairline: rgba(29, 34, 43, 0.06);
  --border: rgba(29, 34, 43, 0.08);

  /* 系统偏好：跟随系统主题 */
  @media (prefers-color-scheme: dark) {
    --bg-app: #0f1419;
    --bg-gradient: linear-gradient(180deg, #1a1f2e 0%, #0f1419 100%);
    --bg-card: rgba(30, 35, 50, 0.85);
    --bg-card-strong: rgba(30, 35, 50, 0.95);
    --bg-subtle: rgba(30, 35, 50, 0.6);
    --bg-overlay: rgba(30, 35, 50, 0.92);

    --text-1: #e8eaf0;
    --text-2: #9ca3af;
    --text-3: #6b7280;
    --text-placeholder: #4b5563;

    --glass-border: rgba(255, 255, 255, 0.08);
    --hairline: rgba(255, 255, 255, 0.06);
    --border: rgba(255, 255, 255, 0.1);
  }
}

/* 手动切换 */
:root[data-theme='dark'] {
  --bg-app: #0f1419;
  --bg-gradient: linear-gradient(180deg, #1a1f2e 0%, #0f1419 100%);
  --bg-card: rgba(30, 35, 50, 0.85);
  --bg-card-strong: rgba(30, 35, 50, 0.95);
  --bg-subtle: rgba(30, 35, 50, 0.6);
  --bg-overlay: rgba(30, 35, 50, 0.92);

  --text-1: #e8eaf0;
  --text-2: #9ca3af;
  --text-3: #6b7280;
  --text-placeholder: #4b5563;

  --glass-border: rgba(255, 255, 255, 0.08);
  --hairline: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.1);
}

:root[data-theme='light'] {
  /* 显式浅色 */
  --bg-app: #f3f5fa;
  --bg-gradient: linear-gradient(180deg, #f7f8fc 0%, #eef1f8 100%);
  --bg-card: rgba(255, 255, 255, 0.68);
  --text-1: #1d222b;
  --text-2: #5a6270;
  --text-3: #97a0ae;
  --glass-border: rgba(255, 255, 255, 0.72);
  --hairline: rgba(29, 34, 43, 0.06);
  --border: rgba(29, 34, 43, 0.08);
}
```

### 4.2 切换逻辑

```javascript
// core.js
const THEME_KEY = 'cutian_theme';

function getTheme() {
  return (
    localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  // 更新 meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#0f1419' : '#F3F5FA';
  }
}

// 初始化
setTheme(getTheme());
```

### 4.3 侧边栏添加主题切换按钮

```html
<!-- sidebar 底部新增 -->
<div class="side-theme">
  <button id="theme-toggle" class="btn small ghost" title="切换主题">
    <span class="icon icon-moon" id="theme-icon"></span>
    <span id="theme-label">暗色模式</span>
  </button>
</div>
```

```javascript
// 切换逻辑
function initThemeToggle() {
  const toggle = $('#theme-toggle');
  const icon = $('#theme-icon');
  const label = $('#theme-label');

  function updateIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon.className = `icon ${isDark ? 'icon-sun' : 'icon-moon'}`;
    label.textContent = isDark ? '亮色模式' : '暗色模式';
  }

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
    updateIcon();
  });

  updateIcon();
}
```

---

## 五、P1 优化：开单页性能

### 5.1 原问题（已修复）

```javascript
// 修复前：一次性拉取 200 条，商品超过 200 条会被截断
data = await api('/api/goods?status=on&page=1&pageSize=200');
```

### 5.2 已实现的分页加载

- 每页 `pageSize = 30`，首屏只拉第一页。
- 通过 `total` 计算 `hasMore`，商品网格下方提供「加载更多（已显示 x / y 件）」按钮。
- 追加数据使用 `insertAdjacentHTML`，不重绘购物车与滚动位置。
- 开单成功后重新拉取第一页并重置分页状态，保证库存刷新。
- 商品图片使用原生 `loading="lazy"` + `decoding="async"` 懒加载。

```javascript
// web/js/pages/billing.js
const BILLING_PAGE_SIZE = 30;

async function fetchBillingGoods(page) {
  const data = await api(`/api/goods?status=on&page=${page}&pageSize=${BILLING_PAGE_SIZE}`);
  return { list: data.list || [], total: Number(data.total || 0) };
}
```

---

## 六、P2 优化：键盘快捷键

### 6.1 快捷键映射

| 快捷键         | 功能             | 适用页面   |
| -------------- | ---------------- | ---------- |
| `N`            | 新增商品         | 商品管理   |
| `S`            | 聚焦搜索框       | 全部列表页 |
| `Esc`          | 关闭弹窗         | 全部页面   |
| `Ctrl / Cmd+K` | 聚焦当前页搜索框 | 全部页面   |
| `Alt + 1~7`    | 快速跳转左侧导航 | 全部页面   |
| `?`            | 打开快捷键帮助   | 全部页面   |

> 实际实现见 `web/js/shortcuts.js`；输入框聚焦时不会触发单键快捷键，避免影响输入。

### 6.2 实现

```javascript
// core.js
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Esc 关闭弹窗
    if (e.key === 'Escape') {
      const modal = document.querySelector('.modal-mask');
      if (modal) closeModal();
      return;
    }

    // Ctrl+K 全局搜索
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('#g-keyword, #o-keyword, #c-keyword');
      if (searchInput) searchInput.focus();
      return;
    }

    // 页面级快捷键
    const hash = location.hash;
    if (hash === '#/goods') {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const btn = document.getElementById('btn-add');
        if (btn) btn.click();
      }
    }

    if (hash === '#/orders') {
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        const input = document.getElementById('o-keyword');
        if (input) input.focus();
      }
    }
  });
}
```

---

## 七、P2 优化：PWA 支持

### 7.1 manifest.json

```json
{
  "name": "裁间 · 服装店管理",
  "short_name": "裁间",
  "description": "服装零售门店进销存/收银管理系统",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F3F5FA",
  "theme_color": "#7b8cf7",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "assets/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 7.2 Service Worker

实际实现见 `web/sw.js`（`CACHE = cj-admin-v5`，预缓存 32 个入口文件）：

```javascript
// 核心策略（简化示意）
const CACHE = 'cj-admin-v5';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 跨域 API 不拦截
  if (url.pathname.includes('/api/')) return; // 业务数据不缓存
  if (e.request.mode === 'navigate') e.respondWith(networkFirst(e.request, './index.html'));
  else if (e.request.destination === 'image') e.respondWith(staleWhileRevalidate(e.request));
  else e.respondWith(networkFirst(e.request));
});
```

- 导航：网络优先，离线回退 `index.html`（应用外壳）
- JS / CSS：网络优先，发布后立即生效；离线回退缓存
- 图片 / 字体：Stale-While-Revalidate
- `/api/` 与跨域请求：完全不拦截，避免缓存业务数据
- 注册入口在 `web/js/app.js`，仅 HTTPS / localhost 环境注册

```javascript
// web/js/app.js
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
```

---

## 八、P2 优化：表格虚拟化

### 8.1 现状问题

订单列表和商品列表在数据量大时（>100 条），表格渲染缓慢。

### 8.2 方案：虚拟滚动表格

```javascript
// 原理：只渲染可视区域内的行
function renderVirtualTable(container, items, rowHeight = 48, pageSize = 20) {
  const totalHeight = items.length * rowHeight
  const viewport = container.parentElement

  function render() {
    const scrollTop = container.parentElement.scrollTop
    const startIndex = Math.floor(scrollTop / rowHeight)
    const visibleCount = Math.ceil(viewport.clientHeight / rowHeight) + 2 // 缓冲区
    const endIndex = Math.min(startIndex + visibleCount, items.length)

    // 创建占位
    container.innerHTML = `
      <div style="height: ${totalHeight}px; position: relative;">
        <div style="position: absolute; top: ${startIndex * rowHeight}px; width: 100%;">
          ${items.slice(startIndex, endIndex).map(item => renderItem(item)).join('')}
        </div>
      </div>
    `
  }

  function renderItem(item) {
    return `<tr>${/* 行内容 */}</tr>`
  }

  viewport.addEventListener('scroll', render)
  render()

  return {
    destroy() {
      viewport.removeEventListener('scroll', render)
    }
  }
}
```

---

## 九、P3 优化：面包屑导航

### 9.1 设计规范

```
首页 > 商品管理 > 新增商品
首页 > 订单管理 > SO20261026001
```

### 9.2 实现

```javascript
// 面包屑数据
const BREADCRUMBS = {
  '#/dashboard': [{ label: '首页' }],
  '#/goods': [{ label: '首页' }, { label: '商品管理' }],
  '#/goods?edit=1': [{ label: '首页' }, { label: '商品管理' }, { label: '新增商品' }],
  '#/orders': [{ label: '首页' }, { label: '订单管理' }],
  '#/orders?detail=1': [{ label: '首页' }, { label: '订单管理' }, { label: '订单详情' }],
  '#/billing': [{ label: '首页' }, { label: '开单' }],
  '#/customers': [{ label: '首页' }, { label: '会员管理' }],
  '#/store': [{ label: '首页' }, { label: '店铺管理' }],
  '#/platform': [{ label: '首页' }, { label: '平台管理' }]
};

function renderBreadcrumb() {
  const crumbs = BREADCRUMBS[location.hash] || [];
  const el = document.getElementById('breadcrumb');
  if (el) {
    el.innerHTML = crumbs
      .map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return isLast
          ? `<span class="breadcrumb-current">${c.label}</span>`
          : `<a href="#" class="breadcrumb-link">${c.label} / </a>`;
      })
      .join('');
  }
}
```

```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-3);
}

.breadcrumb-link {
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--duration-fast);
}

.breadcrumb-link:hover {
  color: var(--primary-dark);
}

.breadcrumb-current {
  color: var(--text-1);
  font-weight: 500;
}
```

---

## 十、P3 优化：打印样式

### 10.1 @media print

```css
/* responsive.css */
@media print {
  /* 隐藏非必要元素 */
  .sidebar,
  .btn,
  .pager,
  .goods-toolbar,
  .nav-group-title {
    display: none !important;
  }

  /* 主内容区全宽 */
  .main {
    padding: 0 !important;
    max-width: none !important;
  }

  /* 卡片去除玻璃效果 */
  .card,
  .stat-card,
  .g-item {
    background: #fff !important;
    box-shadow: none !important;
    border: 1px solid #ddd !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }

  /* 文字颜色加深 */
  body {
    color: #000 !important;
    background: #fff !important;
  }

  /* 链接显示 URL */
  a[href]::after {
    content: ' (' attr(href) ')';
    font-size: 10px;
    color: #666;
  }

  /* 分页 */
  tr {
    page-break-inside: avoid;
  }
}
```

---

## 十一、优化执行计划

### 第一阶段：P0 必做（1 次迭代）

| 任务                                     | 工作量 | 风险 | 状态 |
| ---------------------------------------- | ------ | ---- | ---- |
| 提取图标为独立 icons.css                 | 0.5d   | 低   | ✅   |
| 品牌名统一（侧边栏「裁间」）             | 0.2d   | 低   | ✅   |
| 开单页分页加载（pageSize=30 + 加载更多） | 0.5d   | 中   | ✅   |

### 第二阶段：P1 重要（2-3 次迭代）

| 任务                         | 工作量 | 风险 | 状态 |
| ---------------------------- | ------ | ---- | ---- |
| CSS 拆分（7 个文件）         | 1d     | 中   | ✅   |
| JS 模块化（原生 ES Modules） | 2d     | 高   | ✅   |
| 侧边栏折叠功能               | 1d     | 低   | ✅   |
| 暗色模式                     | 1d     | 中   | ✅   |

### 第三阶段：P2 增强（3-4 次迭代）

| 任务                      | 工作量 | 风险 | 状态 |
| ------------------------- | ------ | ---- | ---- |
| 键盘快捷键                | 0.5d   | 低   | ✅   |
| PWA 支持（manifest + SW） | 1d     | 中   | ✅   |
| 面包屑导航                | 0.5d   | 低   | ✅   |
| 打印样式                  | 0.5d   | 低   | ✅   |
| 错误边界                  | 0.3d   | 低   | ✅   |
| 表格虚拟化（大数据量）    | 2d     | 高   | 暂缓 |

### 第四阶段：P3 完善（持续）

| 任务            | 说明                                                      | 状态 |
| --------------- | --------------------------------------------------------- | ---- |
| 代码质量工具    | ESLint + Prettier（`lint` / `lint:web` / `format:check`） | ✅   |
| 构建工具        | Vite 与零构建部署目标冲突                                 | 暂缓 |
| TypeScript 迁移 | 核心逻辑类型安全                                          | 暂缓 |
| E2E 测试        | Playwright 自动化测试                                     | 暂缓 |

---

## 十二、Web 端 vs 小程序端优化对比

| 优化项           | 小程序端                       | Web 端                          | 优先级 |
| ---------------- | ------------------------------ | ------------------------------- | ------ |
| 长列表虚拟滚动   | recycle-view                   | IntersectionObserver 表格虚拟化 | 暂缓   |
| 分页加载         | ✅ 已实现                      | ✅ 已实现                       | -      |
| setData/API 优化 | 数量增减路径更新，结构变更全量 | 页面级重渲染 + 局部更新         | ⚠️     |
| 图片懒加载       | ✅ 已实现                      | ✅ 已实现（`loading="lazy"`）   | -      |
| 分包/代码拆分    | subPackages（暂缓）            | ✅ CSS/JS 模块拆分              | 部分   |
| 主题切换         | 深色模式（未开始 / 暂缓）      | ✅ 深色模式 + 手动切换          | P2     |
| 侧边栏折叠       | N/A                            | ✅ 新增功能                     | -      |
| 键盘快捷键       | N/A                            | ✅ 新增功能                     | -      |
| PWA/离线         | N/A                            | ✅ manifest + Service Worker    | -      |
| 打印支持         | N/A                            | ✅ @media print                 | -      |
| Skyline 引擎     | 可选迁移                       | N/A                             | 暂缓   |

---

## 十三、参考对标

| 项目                                                   | Stars | 借鉴点                                          |
| ------------------------------------------------------ | ----- | ----------------------------------------------- |
| **nesdesignco/Glassmorphism-Admin-Panel-UI**           | 41    | Glassmorphism 主题系统（8 色板 + 4 档玻璃强度） |
| **ifeekz/next-shadcn-dashboard-with-collapsible-menu** | 0     | 可折叠侧边栏模式                                |
| **Arshiamk/vue-glass-dashboard**                       | 0     | 响应式侧边栏（移动端 off-canvas）               |
| **smartflow-systems/sfs-genesis-template**             | 0     | Animated circuit flow 背景 + hamburger menu     |
| **wechat-miniprogram/recycle-view**                    | -     | 微信官方虚拟列表组件                            |
| **zhanghaoxu/wechat-long-list-chunk**                  | -     | 不定高虚拟列表（IntersectionObserver）          |
| **awesome-skyline**                                    | -     | Skyline 渲染引擎最佳实践                        |

---

_Web 端优化方案 v1.1 | 2026-10-26_  
_参考：glassmorphism-admin-panel-ui, wechat-miniprogram/recycle-view, awesome-skyline, miniprogram-performance-optimizer_
