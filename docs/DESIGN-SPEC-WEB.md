# 🎨 「裁间」Web 管理后台 — 设计方案

> 版本：v1.1 | 日期：2026-10-26  
> 部署：GitHub Pages 纯静态 SPA（PWA 可安装）  
> 与小程序共享设计语言：Glassmorphism × Soft UI（蓝紫 + 暖橙）  
> 状态：品牌统一、图标共享、CSS 拆分、JS 模块化、暗色模式、侧边栏折叠、PWA、开单分页与图片懒加载均已落地

---

## 一、Web 端现状全景图

### 1.1 文件结构

```
web/
├── index.html          # 单页入口（#app + #toast + #modal-root）
├── icons.css           # 矢量图标（由 scripts/build-icons.js 生成）
├── styles/             # base / theme / layout / components / pages / responsive / print
├── manifest.json       # PWA 清单
├── sw.js               # Service Worker（离线外壳，预缓存 32 项）
├── assets/             # PWA 图标与 favicon
└── js/                 # 16 个原生 ES Modules（无构建）
    ├── app.js          # 入口：鉴权分流、路由与页面挂载
    ├── shell.js        # 侧边栏 / 顶栏 / 面包屑 / 鉴权外壳
    ├── bus.js          # 轻量事件总线（解耦 store ↔ shell）
    ├── config.js       # API 基址、状态映射、导航配置
    ├── store.js        # 登录态、token 持久化、API 请求
    ├── theme.js        # 明暗主题切换与持久化
    ├── shortcuts.js    # 全局键盘快捷键与帮助弹窗
    ├── ui.js           # Toast / 弹窗 / 确认框 / 按钮 loading
    ├── utils.js        # DOM、转义、图片地址、防抖
    └── pages/          # 7 个页面模块（dashboard / goods / billing / orders / customers / shop / platform）
```

### 1.2 路由体系（Hash 路由）

| 路由          | 页面       | 图标           | 分组                 |
| ------------- | ---------- | -------------- | -------------------- |
| `#/dashboard` | 首页仪表盘 | icon-home      | 工作台               |
| `#/goods`     | 商品管理   | icon-shirt     | 经营                 |
| `#/billing`   | 开单收银   | icon-receipt   | 经营                 |
| `#/orders`    | 订单管理   | icon-package   | 经营                 |
| `#/customers` | 会员管理   | icon-clipboard | 客户                 |
| `#/store`     | 店铺管理   | icon-store     | 系统                 |
| `#/platform`  | 平台管理   | icon-shield    | 系统（仅平台管理员） |

### 1.3 与小程序的设计差异

| 维度         | 小程序端                                | Web 端                                 |
| ------------ | --------------------------------------- | -------------------------------------- |
| **单位**     | rpx（750rpx = 屏宽）                    | px（固定布局）                         |
| **导航**     | 底部悬浮 Dock 栏（5 个 Tab + 中间凸起） | 左侧侧边栏（分组导航）                 |
| **布局**     | 单列流式                                | 侧边栏 + 主内容区（max-width: 1280px） |
| **操作方式** | 触摸优先（大热区、缩放反馈）            | 鼠标优先（hover 态、精确点击）         |
| **玻璃强度** | 高（backdrop-filter 频繁使用）          | 中等（侧边栏 Wash 层 + Hero 层）       |
| **构建**     | 微信开发者工具编译 TS                   | 零构建，直接浏览器运行                 |
| **部署**     | 云开发推送                              | GitHub Pages（自动 CI）                |

### 1.4 已建立的设计资产 ✅

| 资产       | 状态 | 说明                                            |
| ---------- | ---- | ----------------------------------------------- |
| 品牌命名   | ✅   | 「裁间 · 管理后台」侧边栏顶部                   |
| Token 体系 | ✅   | 色彩/圆角/阴影/动效完整；字号与 Z 轴未 Token 化 |
| 玻璃层级   | ✅   | Wash/Standard/Dense/Hero/Overlay 五档           |
| 矢量图标   | ✅   | `styles/icons.source.json` 统一生成，两端共享   |
| 主题模式   | ✅   | 浅色 / 深色（`data-theme`，支持跟随系统）       |
| 侧边栏     | ✅   | 桌面端可折叠为图标栏（64px），状态持久化        |
| PWA        | ✅   | `manifest.json` + Service Worker 离线外壳       |
| Toast 提示 | ✅   | 固定顶部深色胶囊 + 成功/错误双色                |
| 弹窗系统   | ✅   | modal-mask + modal 标准结构                     |
| 表单反馈   | ✅   | input.error + form-error 字段级报错             |
| 加载骨架   | ✅   | .skeleton 流光动画                              |
| 响应式     | ✅   | ≤768px 侧边栏变顶部横条                         |
| 无障碍降级 | ✅   | 三色媒体查询 + @supports backdrop-filter 兜底   |

---

## 二、Token 体系对比（Web vs 小程序）

### 2.1 共用 Token（已对齐）

```css
/* web/styles/base.css :root */
--primary: #7b8cf7; /* 一致 */
--primary-dark: #6675e8; /* 一致 */
--primary-tint: rgba(123, 140, 247, 0.12); /* 一致 */
--warm: #f2a57c; /* 一致 */
--success: #3bae76; /* 一致 */
--warning: #d69a3c; /* 一致 */
--danger: #e05d57; /* 一致 */
--text-1: #1d222b; /* 一致 */
--text-2: #5a6270; /* 一致 */
--text-3: #97a0ae; /* 一致 */
--radius-pill: 999px; /* 一致（px/rpx 单位不同但值比例相同） */
--duration-fast: 150ms; /* 一致 */
--duration-normal: 220ms; /* 一致 */
--duration-slow: 350ms; /* 一致 */
```

### 2.2 Web 端特有 Token

```css
/* Web 端独有，小程序无对应物 */
--primary-hover: #6675e8; /* 鼠标 hover 态，小程序用 :active */
--danger-hover: #d95750; /* 危险按钮 hover 态 */
--warning-ink: #8a5f12; /* 警告文字实色（表格低库存列） */
--border-focus: var(--primary); /* 输入框 focus 描边色 */
```

### 2.3 圆角单位换算差异

| Token            | 小程序 (rpx) | Web (px) | 比例           |
| ---------------- | ------------ | -------- | -------------- |
| `--radius-sm`    | 16           | 8        | 0.5            |
| `--radius`       | —            | 12       | Web 新增中间档 |
| `--radius-card`  | 36           | 18       | 0.5            |
| `--radius-hero`  | 44           | 22       | 0.5            |
| `--radius-input` | 24           | 12       | 0.5            |
| `--radius-modal` | —            | 22       | Web 独有       |
| `--radius-pill`  | 999          | 999      | 一致           |

> **注**：Web 端圆角整体约为小程序的 0.5 倍，符合桌面端视觉比例习惯。

### 2.4 已落地的布局 Token（Web 端）

```css
:root {
  /* 已落地于 web/styles/base.css */
  --sidebar-width: 220px; /* 展开态侧边栏宽度 */
  --sidebar-collapsed-width: 64px; /* 折叠态图标栏宽度 */
  --main-max-width: 1280px; /* 主内容区最大宽度 */
  --main-padding-x: 32px; /* 主内容区左右内边距 */
}
```

> 字号、行高、Z 轴层级目前仍使用页面内的固定值，**尚未抽象为 Token**。下方仅作为后续建议，不代表当前代码状态；若后续引入，应先落地到 `web/styles/base.css` 再更新本节。

```css
/* 建议方案（未落地） */
:root {
  --content-gap: 20px; /* 卡片间距 */

  --fs-xs: 12px; /* 辅助文字、表头 */
  --fs-sm: 13px; /* 次级文字、描述 */
  --fs-base: 14px; /* 正文 */
  --fs-md: 15px; /* 按钮、标签 */
  --fs-lg: 18px; /* 卡片标题 */
  --fs-xl: 20px; /* 页面标题 */
  --fs-2xl: 24px; /* 大标题、登录卡片 */

  --lh-tight: 1.3;
  --lh-normal: 1.5;
  --lh-relaxed: 1.7;

  --z-content: 1;
  --z-sidebar: 50;
  --z-dropdown: 150;
  --z-modal-mask: 200;
  --z-modal: 201;
  --z-toast: 300;
}
```

---

## 三、布局规范

### 3.1 整体布局结构

```
.layout (display: flex, min-height: 100vh)
├── .sidebar (width: 220px, sticky top: 0, height: 100vh)
│   ├── .brand (品牌名 + 底部分割线)
│   ├── nav (flex: 1, overflow-y: auto)
│   │   ├── .nav-group
│   │   │   ├── .nav-group-title (分组小标题)
│   │   │   └── a.nav-item (导航项)
│   └── .side-user (底部用户信息 + 退出按钮)
│
└── .main (flex: 1, padding: 26px 32px, max-width: 1280px)
    ├── .page-title (页面标题)
    └── #view (动态内容区)
```

### 3.2 侧边栏规范

```
宽度：220px（desktop） / 100%（mobile，<768px）
高度：100vh（sticky 定位）
背景：rgba(255,255,255,0.4) + blur(14px) saturate(140%)
分隔线：border-bottom 1px solid var(--hairline)
活动项背景：var(--primary-tint) + inset 1px 边框
悬停背景：rgba(255,255,255,0.5)
过渡：var(--transition) = 220ms ease-out
```

**导航项尺寸：**

```
padding: 11px 16px
margin: 2px 12px（左右留白，形成悬浮胶囊效果）
border-radius: 12px
font-size: 14px
gap（图标+文字）: 10px
图标尺寸: 1em（随 font-size）
```

### 3.3 主内容区规范

```
padding: 26px 32px（桌面）
max-width: 1280px（限制阅读宽度）
margin: 0 auto（居中）

@media (max-width: 768px):
  padding: 18px 16px
  .sidebar: position: static, height: auto
  .sidebar nav: display: flex, overflow-x: auto（横向滚动）
  .nav-group-title: display: none（移动端隐藏分组标题）
```

### 3.4 页面标题规范

```
.page-title
  font-size: 20px
  font-weight: 700
  color: var(--text-1)
  margin-bottom: 22px
  letter-spacing: -0.2px
```

---

## 四、玻璃层级规范（Web 端）

### 4.1 五档玻璃定义

| 层级         | 类名             | 背景                   | 模糊 | 适用场景         |
| ------------ | ---------------- | ---------------------- | ---- | ---------------- |
| **Wash**     | `.glass-wash`    | rgba(255,255,255,0.4)  | 14px | 搜索框、输入底   |
| **Standard** | `.glass-card`    | rgba(255,255,255,0.68) | 20px | 普通卡片、统计卡 |
| **Dense**    | `.glass-dense`   | rgba(255,255,255,0.86) | 无   | 密集表格行       |
| **Hero**     | `.glass-hero`    | 渐变 92%               | 26px | 登录面板、重点卡 |
| **Overlay**  | `.glass-overlay` | rgba(255,255,255,0.82) | 26px | 弹窗、遮罩       |

### 4.2 侧边栏特殊处理

```
.sidebar 不使用 .glass-wash 类，而是直接定义：
  background: rgba(255,255,255,0.4)
  backdrop-filter: blur(var(--blur-sm)) saturate(140%)

原因：侧边栏为 fixed/sticky 布局，不使用通用类更灵活
```

### 4.3 兼容性降级

```css
/* @supports not backdrop-filter：玻璃退化为纯色半透明 */
.sidebar,
.auth-card,
.modal,
.toast {
  backdrop-filter: none;
  background: rgba(255, 255, 255, 0.94); /* 提高不透明度保证可读性 */
}
```

---

## 五、组件规范

### 5.1 按钮体系

```
.btn（主按钮）
  background: linear-gradient(135deg, #8a9bf9 0%, #b3a1fb 100%)
  padding: 9px 18px
  font-size: 14px, font-weight: 600
  border-radius: var(--radius-pill)
  box-shadow: 0 4px 12px rgba(123,140,247,0.22)
  :hover → translateY(-1px) + 增强阴影
  :active → scale(0.98)
  :disabled → opacity: 0.45

.btn.ghost（次要按钮）
  background: var(--bg-card)
  color: var(--primary-dark)
  border: 1px solid var(--glass-border)

.btn.danger（危险按钮）
  background: linear-gradient(135deg, #e87872 0%, #d95750 100%)
  box-shadow: 0 4px 12px rgba(224,93,87,0.2)

.btn.light（弱化按钮）
  background: var(--bg-subtle)
  color: var(--text-2)
  box-shadow: none

.btn.small（小号按钮）
  padding: 6px 14px
  font-size: 12.5px

.btn.loading（加载状态）
  color: transparent !important
  ::after → spinner 转圈动画（16px，白色描边）
```

### 5.2 卡片体系

```
.card（标准玻璃卡）
  background: var(--bg-card)
  border-radius: var(--radius-card) (= 18px)
  padding: 22px
  box-shadow: var(--shadow-soft-2), var(--inner-light)
  border: 1px solid var(--glass-border)
  margin-bottom: 20px

.stat-card（仪表盘统计卡）
  padding: 20px
  .label → 13px, var(--text-2)
  .num → 28px, font-weight: 800, var(--primary-dark)

.g-item（开单页商品卡）
  padding: 14px
  cursor: pointer
  :hover → translateY(-3px) + 蓝色边框高亮
  img → 100% 宽度，height: 115px, border-radius: var(--radius-input)
```

### 5.3 表格规范

```
th
  font-size: 12px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--text-3)
  padding: 12px 10px

td
  font-size: 13.5px
  color: var(--text-2)
  padding: 12px 10px
  border-bottom: 1px solid var(--hairline)

tr:hover td
  background: rgba(255,255,255,0.5)

.t-center, .t-right（对齐工具类）
```

### 5.4 表单控件

```
input, select, textarea
  font-size: 14px
  border: 1px solid var(--border)
  border-radius: var(--radius-input) (= 12px)
  padding: 10px 14px
  background: rgba(255,255,255,0.55)
  box-shadow: inset 0 1px 2px rgba(35,45,75,0.04)
  transition: var(--transition)

  :focus
    border-color: rgba(123,140,247,0.45)
    background: rgba(255,255,255,0.8)
    box-shadow: 0 0 0 3px rgba(123,140,247,0.14)

  &.error
    border-color: var(--danger)
    :focus → box-shadow: 0 0 0 3px rgba(224,93,87,0.1)

label.field
  display: block
  margin-bottom: 16px

  .lbl
    display: block
    margin-bottom: 7px
    font-size: 13px
    font-weight: 500
    color: var(--text-2)

.form-error
  color: var(--danger)
  font-size: 12px
  margin-top: 6px
```

### 5.5 徽标/状态标签

```
.badge
  display: inline-flex
  align-items: center
  gap: 5px
  padding: 3px 10px
  border-radius: var(--radius-pill)
  font-size: 11.5px
  font-weight: 600
  white-space: nowrap

.badge.pending   → var(--warning-tint) + var(--warning-ink)
.badge.paid      → var(--success-tint) + var(--success)
.badge.done      → var(--info-tint) + var(--info)
.badge.cancelled → var(--bg-subtle) + var(--text-2)
.badge.refunded  → var(--danger-tint) + var(--danger)
.badge.on        → var(--success-tint) + var(--success)
.badge.off       → var(--bg-subtle) + var(--text-3)
```

### 5.6 弹窗体系

```
.modal-mask
  position: fixed, inset: 0
  background: rgba(20,25,40,0.32)
  backdrop-filter: blur(6px)
  z-index: 200
  display: flex, align-items: center, justify-content: center
  padding: 24px

.modal
  background: var(--bg-overlay)
  border-radius: var(--radius-hero) (= 22px)
  width: 600px, max-width: 94vw
  max-height: 88vh, overflow-y: auto
  padding: 28px
  box-shadow: var(--shadow-float), var(--inner-light)
  backdrop-filter: blur(var(--blur-lg)) saturate(150%)
  animation: modalShow 350ms ease-spring both

@keyframes modalShow
  from: opacity: 0; transform: scale(0.96) translateY(10px)
  to:   opacity: 1; transform: scale(1) translateY(0)

.modal h3
  font-size: 18px, font-weight: 700
  margin-bottom: 14px
  letter-spacing: -0.3px

.modal-actions
  display: flex
  justify-content: flex-end
  gap: 10px
  margin-top: 22px
  padding-top: 18px
  border-top: 1px solid var(--hairline)
```

### 5.7 Toast 通知

```
.toast
  position: fixed
  top: 24px, left: 50%
  transform: translateX(-50%) translateY(-100px)
  background: rgba(29,34,43,0.86)
  color: #fff
  padding: 10px 22px
  border-radius: var(--radius-pill)
  font-size: 14px
  max-width: 90vw
  box-shadow: var(--shadow-float)
  backdrop-filter: blur(var(--blur-sm)) saturate(140%)
  z-index: 300
  transition: transform 350ms ease-out, opacity 350ms ease-out

.toast.show
  transform: translateX(-50%) translateY(0)
  opacity: 1

.toast.err
  background: linear-gradient(135deg, #e87872 0%, #d95750 100%)
```

### 5.8 空状态

```
.empty
  text-align: center
  padding: 48px 20px
  color: var(--text-3)
  border: 1px dashed var(--border)
  border-radius: var(--radius-card)
  background: rgba(255,255,255,0.4)
  margin-bottom: 16px
```

### 5.9 骨架屏

```
.skeleton
  background: linear-gradient(90deg,
    rgba(255,255,255,0.5) 25%,
    rgba(255,255,255,0.85) 50%,
    rgba(255,255,255,0.5) 75%)
  background-size: 200% 100%
  animation: skeleton 1.2s infinite
  border-radius: 6px
  height: 16px

@keyframes skeleton
  0%   → background-position: 200% 0
  100% → background-position: -200% 0

.skeleton.h1 → height: 24px（标题骨架）
.skeleton.h2 → height: 20px（副标题骨架）
```

---

## 六、动效规范

### 6.1 共享动效 Token

```
--duration-fast:   150ms   /* 按钮 hover、输入框 focus */
--duration-normal: 220ms   /* 卡片 hover、导航项切换 */
--duration-slow:   350ms   /* 弹窗出现、Toast 进出 */

--ease-out:       cubic-bezier(0, 0, 0.2, 1)
--ease-spring:    cubic-bezier(0.175, 0.885, 0.32, 1.275)
--scale-press:    0.98
```

### 6.2 关键动画

| 动画名      | 时长  | 缓动        | 触发场景                                     |
| ----------- | ----- | ----------- | -------------------------------------------- |
| `pageFade`  | 220ms | ease-out    | 页面切换淡入（translateY 6px→0）             |
| `modalShow` | 350ms | ease-spring | 弹窗出现（scale 0.96→1 + translateY 10px→0） |
| `spin`      | 0.8s  | linear      | 按钮加载转圈                                 |
| `skeleton`  | 1.2s  | infinite    | 骨架屏流光                                   |
| Toast 进出  | 350ms | ease-out    | 通知弹出/收起                                |

### 6.3 交互微动效

```
/* 按钮 hover */
.btn:hover:not(:disabled)
  transform: translateY(-1px)
  box-shadow: var(--shadow-primary)

/* 按钮 active */
.btn:active:not(:disabled)
  transform: scale(var(--scale-press))
  box-shadow: 0 3px 8px rgba(123,140,247,0.18)

/* 商品卡 hover */
.g-item:hover
  transform: translateY(-3px)
  box-shadow: var(--shadow-soft-2)
  border-color: rgba(123,140,247,0.34)

/* 导航项 hover */
.sidebar nav a:hover
  background: rgba(255,255,255,0.5)
  color: var(--text-1)
```

---

## 七、响应式规范

### 7.1 断点定义

```
桌面端：> 768px
平板/手机：≤ 768px
```

### 7.2 移动端适配

```css
@media (max-width: 768px) {
  /* 布局：侧边栏 → 顶部横条 */
  .layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--hairline);
  }
  .sidebar nav {
    display: flex;
    overflow-x: auto;
    padding: 8px 0;
  }
  .sidebar nav a {
    padding: 11px 16px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
    font-size: 13px;
  }
  .sidebar nav .nav-group {
    display: contents;
  }
  .sidebar nav .nav-group-title {
    display: none;
  }

  /* 主内容区 */
  .main {
    padding: 18px 16px;
  }

  /* 开单页：上下布局 */
  .billing-wrap {
    flex-direction: column;
  }
  .cart-panel {
    width: 100%;
    position: static;
  }

  /* 弹窗适配 */
  .modal {
    width: 92vw;
    padding: 22px;
  }
  .auth-card {
    width: 90vw;
    padding: 32px 24px;
  }
}
```

---

## 八、无障碍规范

### 8.1 三色降级策略（已实现）

| 媒体查询                        | 降级行为                                           |
| ------------------------------- | -------------------------------------------------- |
| `prefers-reduced-transparency`  | 玻璃 → 纯色底（#ffffff 或 rgba(255,255,255,0.94)） |
| `prefers-reduced-motion`        | 所有 transition/animation → none                   |
| `prefers-contrast: more`        | 文字加深、描边实心、去除透明底                     |
| `@supports not backdrop-filter` | 玻璃 → 高不透明度纯色底                            |

### 8.2 键盘可访问性

```
弹窗支持 ESC 关闭（document keydown listener）
表单支持 Enter 提交（#goods-form, #auth-form, #cat-add 等）
导航链接支持 Tab 焦点遍历
```

---

## 九、图标规范（Web 端复用）

Web 端与小程序端完全共享同一套图标（内联 SVG base64），共 22 个图标：

```
search, package, receipt, shopping-bag, folder, hourglass, lock,
menu, home, plus, shirt, store, shield, swap, refresh,
chevron-right, printer, clipboard, check-circle, x-circle, eye, eye-off
```

**图标尺寸规范：**

```
侧边栏导航图标：1em（跟随 font-size: 14px）
按钮图标：1em
表格图标：1em
商品占位图标：18-24px
```

---

## 十、页面规范

### 10.1 登录/注册页

```
布局：居中卡片（auth-wrap + auth-card）
卡片尺寸：width: 400px, max-width: 92vw
卡片样式：Hero 玻璃（blur 26px）
标题：24px, font-weight: 700
副标题：13.5px, var(--text-3)
表单：field + lbl 结构
按钮：全宽，15px 字号
切换链接：auth-switch
```

### 10.2 仪表盘页

```
标题：今日概览
统计卡网格：stat-grid（auto-fit, minmax(210px, 1fr), gap: 14px）
今日订单表：card + table 结构
查看全部链接：color var(--primary-dark)
```

### 10.3 商品管理页

```
工具栏：goods-toolbar（flex, gap: 10px）
  - 搜索框（grow, flex: 1, min-width: 170px）
  - 状态筛选（select）
  - 分类筛选（select）
  - 分类管理按钮（ghost）
  - 新增商品按钮（primary）
表格：card 包裹，含分页（pager）
商品图片：46×46px，border-radius: var(--radius-sm)
操作按钮：small ghost/danger/light
```

### 10.4 开单页（双栏布局）

```
 billing-wrap（flex, gap: 18px）
 ├── .billing-goods（flex: 1）
 │   └── .billing-goods-grid（grid, auto-fill minmax(150px, 1fr), gap: 14px）
 │       └── .g-item × N（商品卡）
 └── .cart-panel（width: 340px, sticky top: 26px）
     ├── 当前订单标题
     ├── 购物车行列表（cart-line）
     │   ├── 商品信息（cl-name, cl-sku）
     │   └── 数量控制器（qty: - 数字 +）
     ├── 合计行（cart-total）
     ├── 顾客手机号输入
     ├── 备注输入
     ├── 已付款 checkbox
     └── 确认开单按钮（全宽）
```

### 10.5 订单管理页

```
工具栏：搜索框 + 状态筛选 + 时间范围筛选
表格：订单号、件数、金额、状态徽章、顾客、时间、操作
分页：pager（上一页 / 页码信息 / 下一页）
```

### 10.6 会员管理页

```
工具栏：搜索框（手机号/姓氏）+ 新增会员按钮
表格：会员名、手机号、消费次数、累计金额、最近到店、操作
操作：编辑 / 删除
```

### 10.7 店铺管理页

```
店铺信息卡片
店铺码展示（大字号，letter-spacing）
复制按钮
重置店铺码按钮
成员列表
```

### 10.8 平台管理页（仅平台管理员可见）

```
店铺列表
授权时效设置
```

---

## 十一、待优化问题清单

### 11.1 代码结构问题

| 问题              | 现状                                                                 | 建议                                    |
| ----------------- | -------------------------------------------------------------------- | --------------------------------------- |
| **单文件过大**    | style.css 已拆分为 7 个分层文件；app.js 已拆分为 16 个 ES Modules    | 后续新增页面继续按 `js/pages/*.js` 拆分 |
| **图标重复**      | 已提取到 `web/icons.css`，与小程序共用 `styles/icons.source.json`    | ✅ 已完成                               |
| **无 TypeScript** | `web/js/` 为原生 ES Modules                                          | 暂缓（与零构建部署目标冲突）            |
| **无 Lint 工具**  | 根目录 ESLint / Prettier 已覆盖 `web/`（`lint:web`、`format:check`） | ✅ 已完成                               |

### 11.2 设计一致性问题

| 问题                      | 现状                                                   | 建议                                                    |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| **品牌名不统一**          | 已统一为「裁间 · 管理后台」                            | ✅ 已完成                                               |
| **圆角不一致**            | Web 使用 18px/22px，小程序使用 36rpx/44rpx（比例 0.5） | 比例正确，但建议增加 `--radius` 中间档使过渡更平滑      |
| **缺少页面 loading 骨架** | 仅 .skeleton 基础类，无页面级骨架                      | 为各页面添加结构化骨架（如 stat-grid 骨架、table 骨架） |
| **Toast 无位置变化**      | 固定顶部居中                                           | 可考虑右下角（与桌面端习惯一致）                        |

### 11.3 体验优化建议

| 优先级 | 项目         | 说明                                                                     | 状态      |
| ------ | ------------ | ------------------------------------------------------------------------ | --------- |
| P1     | 侧边栏折叠态 | 桌面端折叠为图标栏（64px），移动端保持横向导航，状态持久化               | ✅ 已完成 |
| P1     | 暗色模式     | `data-theme="dark"` 覆盖语义 Token，支持手动切换 / 跟随系统 / 首屏防闪白 | ✅ 已完成 |
| P2     | 面包屑导航   | 次级页面添加面包屑（由 shell 在 `#view` 外统一渲染）                     | ✅ 已完成 |
| P2     | 键盘快捷键   | 全局快捷键（`Ctrl/Cmd+K`、`S`、`N`、`Alt+1~7`、`?`、`Esc`）              | ✅ 已完成 |
| P2     | 打印优化     | `styles/print.css` + 订单详情「打印小票」                                | ✅ 已完成 |
| P3     | PWA 支持     | `manifest.json` + Service Worker 离线外壳，可安装到桌面                  | ✅ 已完成 |
| P3     | 错误边界     | 全局错误捕获与降级页面，防止白屏                                         | ✅ 已完成 |

---

## 十二、参考对标

| 项目                    | Stars | 借鉴点                                      |
| ----------------------- | ----- | ------------------------------------------- |
| **TDesign Miniprogram** | 1689  | CSS Variables 主题定制、深色模式            |
| **PoemUI**              | Beta  | 视觉开关（shadow/frosted-glass/radius）     |
| **uvindu94/pos**        | -     | Bento Grid 仪表盘、touch-optimized terminal |
| **PAkash7/asc-manage**  | -     | Glassmorphism Dashboard                     |
| **wx-design/UI**        | -     | 小程序设计 Token 规范                       |
| **微信官方设计指南**    | -     | 友好/清晰/便捷原则                          |

---

## 附录：Web 端 vs 小程序端设计对比矩阵

| 维度       | 小程序端                                | Web 端                  | 对齐状态            |
| ---------- | --------------------------------------- | ----------------------- | ------------------- |
| 品牌色     | --primary: #7b8cf7                      | --primary: #7b8cf7      | ✅ 一致             |
| 玻璃层级   | 五档（rpx）                             | 五档（px）              | ✅ 对齐             |
| 圆角基准   | 8rpx 阶梯                               | 4px 阶梯                | ✅ 比例 0.5         |
| 字号基准   | 22rpx 起步                              | 12px 起步               | ✅ 比例 ~0.6        |
| 动效时长   | 150/220/350ms                           | 150/220/350ms           | ✅ 一致             |
| 无障碍降级 | 三色媒体查询                            | 三色 + @supports        | ✅ Web 更完善       |
| 图标系统   | icons.wxss（由 icons.source.json 生成） | icons.css（同源生成）   | ✅ 已统一           |
| 导航方式   | 底部 Dock 栏                            | 左侧侧边栏（可折叠）    | ✅ 符合各自平台习惯 |
| 品牌命名   | 「裁间」                                | 「裁间 · 管理后台」     | ✅ 已统一           |
| 主题模式   | 浅色                                    | 浅色 / 深色（跟随系统） | ✅ Web 更完善       |
| 部署方式   | 云开发推送                              | GitHub Pages + PWA      | ✅ 各有优势         |

---

_Web 端设计方案 v1.1 | 2026-10-27_  
_基于 `web/js` 模块、`web/styles/` 与 `web/icons.css` 分析_
