# 清透质感 UI 改版方案（Glassmorphism × Soft UI）

> 状态：**方案草案（待确认后实施）** ｜ 日期：2026-10-20
> 范围：**微信小程序端 + Web 管理后台**（全项目视觉语言统一）
> 约束：**只改视觉层（WXSS / CSS / 少量 className），不改业务逻辑、不动接口、不调整信息架构与文案**；现有「裁间」品牌名与功能流程保持不变。

---

## 参考与借鉴

本方案在整理过程中参考了以下开源项目的实践，汲取其成熟的设计哲学与工程化经验：

| 参考源 | 核心借鉴点 |
|--------|-----------|
| **jdubois/boot-ui**（`github.com/jdubois/boot-ui`） | "Calm Control Room"理念：表面用 `surface-frost`（82% 白玻璃）+ 双层环境阴影（Ambient SM/MD）+ 发丝描边；渐变仅用于选中态，危险色仅在真正风险时出现 |
| **mkbabb/glass-ui**（`github.com/mkbabb/glass-ui`） | 七档玻璃层级（Wash/Quiet/Resting/Floating/Overlay/Dock/Chassis）、六层光学复合结构（模糊+底色+描边+内高光+外阴影+纹理）、"玻璃不能叠玻璃"原则、tap-squish 规范（scale 0.96 为默认按压回弹值） |
| **RanaAhmar/vanilla-css-glassmorphism**（`github.com/RanaAhmar/vanilla-css-glassmorphism`） | 纯变量驱动的玻璃配方（`--glass-blur` / `--glass-opacity` / `--glass-border-opacity`），零依赖可直接移植到 `tokens.wxss` |
| **glasshome/ui**（`github.com/glasshome/ui`） | 单公式驱动全局样式（一个 `.glass` 类 + 旋钮变量），避免每个组件手撸样式；OKLCH 语义色体系 |
| **creativetimofficial/vue-soft-ui-dashboard**（`github.com/creativetimofficial/vue-soft-ui-dashboard`） | Soft UI 双层阴影（外阴影 + 内高光）写法、按钮按下态 `scale(0.98)` 配方 |

---

## 1. 设计目标与原则

### 1.1 一句话定位

> 轻盈通透的服装店工作台：内容浮在柔光上，玻璃只做衬托，不做主角。

### 1.2 关键词

| 维度 | 目标感受 |
|------|----------|
| 光 | 低饱和渐变光晕、边缘极柔，营造空间感 |
| 透 | 半透明卡片、毛玻璃层次，信息有前后关系 |
| 柔 | 大圆角、多层淡阴影、内高光，无硬边 |
| 静 | 大量留白、克制动效，久看不累 |
| 净 | 低饱和配色、内容优先，不抢视线 |

### 1.3 四条设计原则

1. **内容优先**：玻璃只承载层级，不承载装饰；正文对比度不低于现有水平。
2. **光而不炫**：光晕大而淡（透明度 ≤ 30%），禁止高饱和霓虹色。
3. **透而不乱**：全站最多 3 档玻璃层级，单屏模糊层 ≤ 4 个。
4. **柔而有界**：用「外阴影 + 1rpx 内高光 + 发丝描边」界定边界，不用重边框。

### 1.4 四条命名规则（借鉴 boot-ui / glass-ui）

| 规则 | 内容 |
|------|------|
| **渐变是状态** | 品牌渐变（主色→点缀）只用于"选中/激活"态，不做装饰性背景 |
| **冷而不暖** | 背景使用冷调浅灰蓝，禁用奶油/沙色/米色（那是 AI-SaaS 默认风格） |
| **Earned Red** | 危险色只在真正需要时出现，正常状态下页面不含红色 |
| **玻璃不叠玻璃** | 两个 `backdrop-filter` 重叠会产生黑/灰色复合，嵌套表面改用 `--bg-subtle` + 发丝线 |

### 1.5 本期不做

- 深色模式（Token 结构预留，后续可扩展）；
- 页面信息架构 / 导航结构调整（仅底部 TabBar 改为悬浮玻璃样式）；
- 图标重绘（沿用现有 `styles/icons.wxss` 的 24px 线性图标，仅换颜色）；
- 插画 / 3D 元素 / 复杂动效；
- 自定义通栏玻璃导航（一期保留原生导航栏，风险可控）。

---

## 2. 视觉语言定义

### 2.1 三层背景模型（全站统一）

```
第 1 层  底色：极浅冷灰蓝渐变（页面最底）
第 2 层  光晕：2–3 个大面积低饱和径向渐变（紫 / 暖橙 / 天蓝）
第 3 层  内容：玻璃卡片、列表、按钮浮在光晕之上
```

- 光晕使用 **radial-gradient 直接绘制**，不使用 `filter: blur()`（省 GPU，低端机友好）；
- 光晕固定在视口（`position: fixed`），滚动时内容从光上滑过，形成通透感；
- 小程序通过 `page::before / page::after` 全局实现，Web 通过 `body::before / ::after` 实现，**页面根容器不得再铺不透明底色**（见 5.1 清理清单）。

### 2.2 玻璃七档层级（扩展自原三档）

借鉴 glass-ui 的七档分层体系，结合本项目实际精简为五档：

| 层级 | 用途 | 底色 | 模糊 | 阴影 | 典型位置 |
|------|------|------|------|------|----------|
| **Wash 薄纱** | 输入框底、TabBar、轻量轨道 | `rgba(255,255,255,0.40)` | `blur(14px) saturate(140%)` | 无（或 `--shadow-soft-1`） | TabBar、输入框底、分段控件轨道 |
| **Standard 标准** | 大多数功能卡、普通面板 | `rgba(255,255,255,0.68)` | `blur(20px) saturate(150%)` | `--shadow-soft-2` | 功能卡片、弹窗面板 |
| **Dense 密集** | 长列表行、表格、密集表单 | `rgba(255,255,255,0.86)` | 无 | `--shadow-soft-1` | 商品行、订单行、成员行 |
| **Hero 主卡** | 首页销售额、欢迎页、登录面板 | 品牌低饱和渐变 90% 或白 55% | `blur(26px) saturate(150%)` | `--shadow-float` | 首页销售额卡、登录面板、会员头部 |
| **Overlay 浮层** | 确认弹窗、遮罩面板 | `rgba(255,255,255,0.82)` | `blur(26px)` | `--shadow-float` | 自定义弹窗、模态面板 |

> **关键原则**：玻璃效果 = 半透明白底 + 光晕背景 + 内高光 + 发丝描边；`backdrop-filter` 只是增强项。即使设备不支持模糊，视觉依然成立、不发灰。

### 2.3 光影规则（Soft UI + "Calm Control Room"）

- **光源统一在左上**：内高光在顶部（`inset 0 1rpx 0 rgba(255,255,255,.85)`），外阴影向右下扩散；
- **环境阴影（Ambient Shadow）**：阴影一律低透明度、大模糊半径，模拟大气散射而非硬投影：
  - `--shadow-soft-1`（Ambient SM）：`0 6rpx 20rpx rgba(35,45,75,0.06)` — 卡片 resting 态
  - `--shadow-soft-2`（Ambient MD）：`0 14rpx 40rpx rgba(35,45,75,0.08)` — 标准玻璃卡
  - `--shadow-float`（Sidebar/Surface）：`0 24rpx 60rpx rgba(35,45,75,0.12)` — TabBar、弹窗等高浮层
- **主色投影**：`--shadow-primary: 0 16rpx 36rpx rgba(123,140,247,0.26)` — 主按钮 / Hero 卡专用
- **按钮/可点击卡片按下**：`scale(0.98)` + 阴影减弱（模拟被按下去的柔性回弹）；
- **浮层阴影更深一档**：与内容区拉开距离。

> 禁止 `0 2px 4px rgba(0,0,0,.3)` 这类 2014 年风格的硬阴影。

### 2.4 圆角与留白

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-card` | 36rpx（Web 18px） | 标准卡片 |
| `--radius-hero` | 44rpx（Web 22px） | Hero 卡、弹窗 |
| `--radius-input` | 24rpx（Web 12px） | 输入框、分段控件 |
| `--radius-pill` | 999rpx | 按钮、标签、TabBar |

- 页面左右留白 32rpx；卡片内边距 32rpx；卡片间距 24rpx；分区间距 40rpx；
- 相比现状整体**略微增加留白**（约 +4~8rpx），但不缩小字号、不改变行高逻辑，避免打乱现有布局。

### 2.5 动效规范（借鉴 glass-ui spring physics）

**时长规范：**

| Token | 值 | 用途 |
|-------|-----|------|
| `--duration-fast` | 150ms | 按钮按下/释放反馈 |
| `--duration-normal` | 220ms | 页面淡入、卡片 hover |
| `--duration-slow` | 350ms | 弹窗/遮罩入场 |

**缓动曲线：**

| 场景 | 曲线 |
|------|------|
| 按下回弹 | `ease-out`（`cubic-bezier(0, 0, 0.2, 1)`）|
| 弹窗入场 | 轻微弹性（`cubic-bezier(0.175, 0.885, 0.32, 1.275)`）|
| 路由过渡 | 平滑减速（`cubic-bezier(0.4, 0, 0.2, 1)`）|

**规范要点：**

- 时长 150–350ms；只动 `transform` / `opacity`，**不动 `backdrop-filter`**；
- 页面进入：淡入 + 上移 8rpx（沿用现有 `page-fade` 思路）；
- 卡片/按钮按压：`scale(0.98)`，恢复时带轻微弹性；
- 骨架屏保留现有 shimmer，颜色改为柔和白/紫灰渐变；
- 尊重 `prefers-reduced-motion`：所有动效在此模式下自动降级为 instant。

---

## 3. Design Tokens（新版）

### 3.1 配色方案（蓝紫 + 暖橙）

> 以浅色为基底，蓝紫作主色、暖橙作点缀；危险色仅在真正风险时出现（Earned Red）。

| 类别 | Token | 值 | 说明 |
|------|-------|-----|------|
| 基底 | `--bg-app` | `#F3F5FA` | 页面底色（取代原暖米色 #F3EFE7） |
| 基底渐变 | `--bg-gradient` | `linear-gradient(180deg, #F7F8FC 0%, #EEF1F8 100%)` | 页面大背景 |
| 玻璃 | `--bg-card` | `rgba(255,255,255,0.68)` | Standard 标准卡 |
| 玻璃 | `--bg-card-strong` | `rgba(255,255,255,0.86)` | Dense 密集列表 |
| 玻璃 | `--bg-subtle` | `rgba(255,255,255,0.46)` | 输入框底 / 分区底 / 嵌套内层 |
| 玻璃 | `--bg-overlay` | `rgba(255,255,255,0.82)` | Overlay 浮层面板 |
| 描边 | `--glass-border` | `rgba(255,255,255,0.72)` | 玻璃外描边 |
| 描边 | `--hairline` | `rgba(29,34,43,0.06)` | 发丝分割线（列表行、表格行） |
| 文字 | `--text-1` | `#1D222B` | 主文字（对比度 > 12:1 on 68%白玻璃） |
| 文字 | `--text-2` | `#5A6270` | 次文字（对比度 > 5:1） |
| 文字 | `--text-3` | `#97A0AE` | 弱文字 / 标签 |
| 文字 | `--text-placeholder` | `#B6BDC9` | 占位符 |
| 主色 | `--primary` | `#7B8CF7` | 低饱和蓝紫 |
| 主色深 | `--primary-dark` | `#6675E8` | 按下 / 强调 |
| 主色浅底 | `--primary-tint` | `rgba(123,140,247,0.12)` | 标签 / 选中底 / TabBar 选中胶囊 |
| 点缀 | `--warm` | `#F2A57C` | 暖橙点缀（徽标、图表重点） |
| 点缀浅底 | `--warm-tint` | `rgba(242,165,124,0.16)` | 暖橙标签底 |
| 成功 | `--success` | `#3BAE76` | 柔化绿 |
| 警告 | `--warning` | `#D69A3C` | 柔化琥珀 |
| 危险 | `--danger` | `#E05D57` | 柔化红（Earned Red，非装饰） |
| 信息 | `--info` | `#4C8FE8` | 柔化蓝 |
| 光晕 1 | — | `rgba(140,150,255,0.30)` | 左上紫光 |
| 光晕 2 | — | `rgba(255,176,140,0.24)` | 右下暖橙光 |
| 光晕 3 | — | `rgba(120,200,255,0.18)` | 中部天蓝光（可选） |

**渐变（仅用于选中/激活态，遵守"渐变是状态"规则）：**

- 主按钮 / Hero 卡：`linear-gradient(135deg, #8A9BF9 0%, #B3A1FB 100%)`
- 暖橙点缀：`linear-gradient(135deg, #FFC7A6 0%, #F7A87E 100%)`
- 危险操作：`linear-gradient(135deg, #E87872 0%, #D95750 100%)`

**备选方案 B（保留品牌红延续性）：** 主色改为柔化番茄红 `#E8695F → #F09A83` 渐变，光晕用暖橙 + 淡粉，其余不变。两者切换只改 Token，不改动任何类名或组件代码。

### 3.2 模糊 / 阴影 / 圆角 Token

```css
page, :host {
  /* 模糊（仅供 backdrop-filter 使用） */
  --blur-sm: 14px;    /* Wash 薄纱层 */
  --blur-md: 20px;    /* Standard 标准层 */
  --blur-lg: 26px;    /* Hero / Overlay 高浮层 */

  /* Ambient 环境阴影（蓝灰调，避免死黑） */
  --shadow-soft-1: 0 6rpx 20rpx rgba(35, 45, 75, 0.06);   /* Dense 卡 resting */
  --shadow-soft-2: 0 14rpx 40rpx rgba(35, 45, 75, 0.08);  /* Standard 卡 resting */
  --shadow-float:  0 24rpx 60rpx rgba(35, 45, 75, 0.12);  /* TabBar / 弹窗高浮层 */
  --shadow-primary: 0 16rpx 36rpx rgba(123, 140, 247, 0.26); /* 主按钮 / Hero 投影 */

  /* 内高光（左上光源） */
  --inner-light: inset 0 1rpx 0 rgba(255, 255, 255, 0.85);

  /* 圆角 */
  --radius-card: 36rpx;
  --radius-hero: 44rpx;
  --radius-input: 24rpx;
  --radius-sheet: 44rpx;
  --radius-pill: 999rpx;

  /* 间距（8rpx 基准） */
  --space-1: 8rpx;
  --space-2: 16rpx;
  --space-3: 24rpx;
  --space-4: 32rpx;
  --space-5: 40rpx;
  --space-6: 48rpx;

  /* 动效时长 */
  --duration-fast: 150ms;
  --duration-normal: 220ms;
  --duration-slow: 350ms;

  /* 按压缩放 */
  --scale-press: 0.98;
  --scale-press-dock: 0.94; /* TabBar 中间圆钮更深 */
}
```

> 字号体系保持不变（现有 22/24/26/28/30/32/52/84rpx 已合理），只调整颜色、字重与字距，控制回归风险。

### 3.3 玻璃配方（全局类）

借鉴 vanilla-css-glassmorphism 的变量驱动思路 + glass-ui 的六层复合结构：

```css
/* ── Wash 薄纱层：输入框底 / TabBar ── */
.glass-wash {
  background: rgba(255, 255, 255, 0.40);
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-input);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
}

/* ── Standard 标准层：功能卡片 ── */
.glass-card {
  background: var(--bg-card);
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft-2), var(--inner-light);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  backdrop-filter: blur(20px) saturate(150%);
}

/* ── Dense 密集层：长列表、表格（不模糊，性能优先） ── */
.glass-dense {
  background: var(--bg-card-strong);
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft-1);
}

/* ── Hero 主卡：首页销售额、登录面板 ── */
.glass-hero {
  background: linear-gradient(135deg, rgba(138, 155, 249, 0.92), rgba(179, 161, 251, 0.9));
  color: #fff;
  border: 1rpx solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-hero);
  box-shadow: var(--shadow-primary), var(--inner-light);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
  backdrop-filter: blur(26px) saturate(150%);
}

/* ── Overlay 浮层：弹窗面板 ── */
.glass-overlay {
  background: var(--bg-overlay);
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-hero);
  box-shadow: var(--shadow-float), var(--inner-light);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
  backdrop-filter: blur(26px) saturate(150%);
}
```

**兼容性与退化策略：**

- 玻璃底色本身不依赖模糊即可成立（白色 68% 叠加在浅色光晕上仍有层次）；
- 采用"默认半透明 + 模糊渐进增强"策略，不依赖 WXSS 的 `@supports`（各基础库支持度不一致）；
- 低端安卓若不支持 `backdrop-filter`，自动退化为半透明卡；不出现白块、黑块或文字不可读；
- 尊重 `prefers-reduced-transparency`：系统开启时玻璃类自动退化为不透明纯色底（Token 驱动）。

### 3.4 背景光晕配方

借鉴 vanilla-css-glassmorphism 的径向渐变写法，增加中间色阶避免硬过渡：

```css
page {
  background: var(--bg-gradient);
  background-attachment: fixed;
}
page::before,
page::after {
  content: '';
  position: fixed;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
}
page::before {
  width: 640rpx; height: 640rpx;
  top: -220rpx; left: -180rpx;
  /* 左上紫光：增加中间色阶，渐变更柔和 */
  background: radial-gradient(
    circle at 30% 30%,
    rgba(140, 150, 255, 0.32) 0%,
    rgba(140, 150, 255, 0.15) 40%,
    transparent 70%
  );
}
page::after {
  width: 560rpx; height: 560rpx;
  right: -200rpx; bottom: 120rpx;
  /* 右下暖橙光 */
  background: radial-gradient(
    circle at 70% 70%,
    rgba(255, 176, 140, 0.26) 0%,
    rgba(255, 176, 140, 0.12) 40%,
    transparent 70%
  );
}
```

> Web 端用同一套光晕参数（px 单位），`body::before/::after` + `position: fixed` 实现。

---

## 4. 组件规范

### 4.1 底部导航（自定义 TabBar）

**改为悬浮玻璃胶囊（Wash 层）：**

- 容器：左右各留 24rpx，底部距安全区 16rpx；高 108rpx；圆角 36rpx；`backdrop-filter: blur(14px) saturate(140%)`（Wash 层）；描边 `--glass-border`；阴影 `--shadow-float`；
- 选中项：图标与文字使用主色，图标轻微上移 2rpx，背景加 `--primary-tint` 圆角胶囊（渐变仅用于选中态，遵守"渐变是状态"规则）；
- 中间「开单」圆钮：108rpx 圆形，主色渐变 + 柔和外发光（`--shadow-primary`），白色图标；按下 `scale(var(--scale-press-dock))`（0.94，更深回弹）；
- **布局影响**：页面底部占位从 180rpx 提升到 **220rpx + 安全区**（需逐页检查 `page-bottom-space`、悬浮结算栏、FAB 是否与 TabBar 重叠）；
- 非 tabBar 页面（登录 / 注册 / 欢迎 / 编辑页）不受影响。

### 4.2 顶部导航栏

- 一期保留原生导航栏：`navigationBarBackgroundColor` / `backgroundColor` 统一改为 `#F3F5FA`，`navigationBarTextStyle: black`；
- 原生栏无法透明/模糊，属于平台限制；页面光晕从导航栏下方开始，颜色与底色一致，视觉上仍连续；
- 二期可选：登录 / 注册 / 欢迎 / 首页改用 `navigationStyle: custom` 实现通栏玻璃导航（需自行处理状态栏高度与返回键，风险较高，默认不做）。

### 4.3 卡片（五档分级）

| 变体 | 使用场景 | CSS 类 | 规范 |
|------|----------|--------|------|
| Hero | 首页销售额、欢迎页、登录面板、会员头部 | `.glass-hero` | 品牌渐变底 + `blur-lg` + `--shadow-primary` |
| Standard | 绝大多数功能卡 | `.glass-card` | `--bg-card` + `blur-md` + `--shadow-soft-2` + 内高光 |
| Dense | 商品行、订单行、成员行、表格行 | `.glass-dense` | `--bg-card-strong`（不模糊）+ `--shadow-soft-1` |
| Wash | TabBar、输入框底、分段控件轨道 | `.glass-wash` | `rgba(255,255,255,0.40)` + `blur-sm` |
| Tinted | 提示条、到期提醒、低库存 | 无类（语义色底 + 文字） | 语义色 12% 透明度底 + 同色文字，无模糊 |

- 卡片嵌套时，内层改用 `--bg-subtle` 或透明 + 发丝线，**禁止玻璃叠玻璃**。
- 卡片间距 24rpx；左右内边距 32rpx。

### 4.4 按钮（四态完整）

| 类型 | rest | hover | active | disabled |
|------|------|-------|--------|----------|
| 主按钮 | 主色渐变 + 白字 + `--shadow-primary` | 上浮 1rpx + 阴影加深 | `scale(var(--scale-press))` + 阴影减弱 | 透明度 45%，无阴影，无 cursor |
| 次按钮 | `--bg-card` + 主色文字 + `--glass-border` | `--bg-card` 升至 80% | `scale(var(--scale-press))` | 透明度 45% |
| 文字按钮 | 透明底，主色文字 | 不加底色，仅下划线 | `scale(var(--scale-press))` | 透明度 45% |
| 危险按钮 | 柔化红渐变 + 白字 | 上浮 1rpx | `scale(var(--scale-press))` | 透明度 45% |

- 保留现有 `.btn-loading` 结构与加载转圈，仅调整颜色与圆角；
- 所有按钮按下统一走 `scale(var(--scale-press)) = 0.98`，TabBar 中间圆钮单独用 `0.94`。

### 4.5 输入框 / 表单

- 底：`rgba(255,255,255,.46)`（`--bg-subtle`），内阴影 `inset 0 1rpx 2rpx rgba(35,45,75,.04)`，圆角 24rpx；
- 聚焦：白底 80% + 3rpx 主色 14% 光环（替代硬边框）；
- 错误：`--danger` 描边 + 8% 红光环；
- 标签字号/位置不变，颜色用 `--text-3`；
- placeholder 颜色用 `--text-placeholder`，对比度 ≥ 4.5:1。

### 4.6 分段控件 / 标签

- 分段控件：Wash 层轨道（白 40%）+ 白色胶囊滑块 + `--shadow-soft-1`，选中文字主色；
- 标签：语义色 12% 透明底 + 对应深色文字，圆角胶囊，无边框；
- 状态徽标（Web）：同规则，`badge` 系列全部换成半透明底。

### 4.7 弹窗 / 遮罩

- 遮罩：`rgba(20,25,40,.32)` + `backdrop-filter: blur(6px)`（不支持则纯色遮罩）；
- 面板：`.glass-overlay`（`--bg-overlay` 82% + `blur-lg`、`--radius-hero`、`--shadow-float`）；
- 小程序原生 `wx.showModal` 无法改样式，保持系统样式；自定义弹窗（订单确认等）按此规范；
- 弹窗入场动效：`scale(0.96 → 1)` + 淡入，时长 `--duration-slow`（350ms）。

### 4.8 列表 / 表格（Web）

- 行分割线改为 `--hairline`；hover 行背景 `rgba(255,255,255,.5)`；
- 表头文字 `--text-3`，去掉重底色；
- 表格外层包一层 `.glass-card`，避免行级模糊。

### 4.9 空状态 / 骨架屏 / 图片占位

- 空状态：图标透明度 40%，文案 `--text-2/3`，可加一层浅玻璃圆角容器（`.glass-dense`）；
- 骨架屏：`linear-gradient(90deg, rgba(255,255,255,.5), rgba(255,255,255,.85), rgba(255,255,255,.5))`；
- 图片占位：浅紫灰渐变（`#EEF0F9 → #F7F4F0`），不再是纯灰块。

### 4.10 图表（首页趋势）

- 柱形：默认 `rgba(123,140,247,.18)`，激活为主色渐变（圆角 8rpx）；
- 选中日期文字主色；金额数字主色加粗；
- 网格/基线使用发丝线（`--hairline`）。

### 4.11 图标

- 沿用现有 mask 图标（`currentColor`），不改图形；
- 常规图标 `--text-2`，激活/强调用 `--primary`，TabBar 选中用主色；
- 图标底色块（如空状态）改为浅色玻璃圆（`.glass-wash`）。

---

## 5. 小程序改造清单

### 5.1 全局层（先行）

| 文件 | 改动 |
|------|------|
| `styles/tokens.wxss` | 全量替换为第 3 节 Token（保留旧变量名，确保存量页面即时生效） |
| `app.wxss` | `.card` / `.list-card` / `.btn-*` / `.tag-*` / `.modal` / `.skeleton` / `.empty*` / `.mask` 等全局类改为玻璃规范；**新增** `.glass-wash` / `.glass-card` / `.glass-dense` / `.glass-hero` / `.glass-overlay` 五档类 |
| `app.json` | `navigationBarBackgroundColor` / `backgroundColor` → `#F3F5FA`；TabBar 兜底色值同步新 Token |
| `custom-tab-bar/index.wxss` | Wash 层悬浮玻璃胶囊 + 主色渐变圆钮（wxml 不改） |

**页面根容器背景清理**（这些页面当前铺了不透明底色，会盖住全局光晕，需改为 `transparent`）：

- `pages/index/index.wxss`（`.home`）
- `pages/login/login.wxss`（`.login-page`）
- `pages/register/register.wxss`（`.register-page` 等）
- `pages/welcome/welcome.wxss`
- `pages/store/store.wxss`（`.store-page`）
- `pages/platform/stores.wxss`
- `pages/printer-pair/printer-pair.wxss`

同时把各页零散硬编码色（共约 63 处）替换为 Token，重点：`#f0b4ae`（禁用按钮）、`#f0cfcb`（图表底）、`#F3EFE7` 关联色、`#fff` 卡片底。

### 5.2 页面级改造要点

| 页面 | 改造要点 |
|------|----------|
| `pages/login` | 登录面板 → Hero 玻璃（`.glass-hero`）；输入框 Wash 层玻璃化；底部链接主色；背景光晕从 page::before 透出 |
| `pages/register` | 三步向导：步骤条节点改主色渐变 + Wash 层玻璃轨道；表单卡 Standard 玻璃；完成页成功标记加柔光 |
| `pages/welcome` | 品牌区 + 欢迎文案保持；功能引导卡改 Standard 玻璃；按钮主色渐变；入场动效保留 |
| `pages/index` | 销售额卡 → Hero 玻璃（`.glass-hero`）；双卡/三栏 → Standard 玻璃（`.glass-card`）；趋势柱改渐变；低库存列表 Dense（`.glass-dense`） |
| `pages/goods` | 搜索框 Wash 层玻璃化；商品卡 Dense；图片占位改浅紫灰渐变；空状态加 `.glass-dense` 容器 |
| `pages/billing` | 搜索/Wash层、商品行/Dense、购物车面板/Standard、结算栏/Floating（`--shadow-float`）；长列表强制 Dense，避免卡顿（该页样式最多，459 行，重点回归） |
| `pages/orders` | 状态 Tab 改 Glass 分段控件；订单卡 Standard/Dense 分级；状态标签半透明语义色 |
| `pages/store` | 店铺头部 → Hero 玻璃；功能卡 Standard；切换店铺弹窗 Overlay；店铺码卡片 Dense |
| `pages/goods-edit` | 表单卡片 Standard 玻璃；图片上传区柔和底（`--bg-subtle`） |
| `pages/category` | 分类行 Dense；新增/编辑弹窗 Overlay 玻璃 |
| `pages/order-detail` | 明细分区卡 Standard 玻璃；金额数字主色加粗强调 |
| `pages/customer/list` | 搜索 Wash 层 + 客户卡 Dense；空状态 |
| `pages/customer/detail` | 资料卡/消费记录卡 Standard 玻璃 |
| `pages/platform/stores` | 列表卡 Standard 玻璃；改名弹窗 Overlay；危险操作用柔化红渐变 |
| `pages/printer-pair` | 状态卡/步骤卡 Standard 玻璃；扫描按钮主色渐变 |

> 所有页面仅改样式与必要的 className，**不改 WXML 结构与 JS**（个别页面如需新增一层背景容器，优先用全局 `page::before/after`，避免改动结构）。

---

## 6. Web 管理后台适配

`web/` 为单文件样式（`style.css` 282 行）+ SPA 模板（`app.js`），与小程序共用同一套 Token 命名，适配成本低：

| 区域 | 改造 |
|------|------|
| `:root` | 替换为第 3 节同源 Token（px 单位） |
| `body` | 底色渐变 + `::before/::after` 固定光晕（紫 / 暖橙） |
| 侧边栏 | 由深红实色 → **Wash 层浅色玻璃面板**：白 40% + `blur(14px)` + 右侧发丝线；导航项选中态为主色 12% 胶囊 + 主色文字；品牌字用墨色 |
| 主区域 | 标题、卡片、统计卡全部玻璃化；卡片间距 20px |
| 按钮 | 主按钮渐变 + `--shadow-primary`；ghost 玻璃（Standard）；danger 柔化红 |
| 输入 / 下拉 | Wash 层玻璃底 + 主色光环聚焦 |
| 表格 | 外层 `.glass-card`；行 hover `rgba(255,255,255,.5)`；分割线 `--hairline` |
| 状态徽标 | 半透明语义色底 |
| 弹窗 / toast | 弹窗用 `.glass-overlay` + 模糊遮罩；toast 改深色半透明胶囊 |
| 登录页 | 居中 Hero 玻璃卡（`.glass-hero`）+ 光晕背景 |
| 响应式 | 断点与布局不动，仅换视觉 |

- 使用 `@supports not (backdrop-filter: blur(1px))` 提供纯半透明兜底（Web 端可安全使用）；
- `web/index.html` 可补充 `<meta name="theme-color" content="#F3F5FA">`；
- **不改 `web/app.js` 的模板结构**，只改 class 样式（必要时补 1–2 个 class 名）。

---

## 7. 兼容性、无障碍与性能

### 7.1 兼容性矩阵

| 平台 | `backdrop-filter` 支持 | 退化策略 |
|------|----------------------|----------|
| 微信 iOS | ✅ 完整支持（需 `-webkit-` 前缀） | 无需退化 |
| 微信 Android（XWeb 新版） | ✅ 支持 | 自动降级为半透明底色，视觉成立 |
| 微信 Android（旧版） | ❌ 不支持 | `backdrop-filter` 被忽略，`rgba` 底色仍生效 |
| 微信开发者工具 | ✅ 支持 | 作为日常预览基准 |
| Chrome / Edge | ✅ 完整支持 | 无需退化 |
| Safari | ✅ 完整支持 | 无需退化 |
| Firefox 103+ | ✅ 支持 | 旧版走 `@supports` 兜底 |

### 7.2 无障碍（Accessibility Brackets）

借鉴 glass-ui 的三档无障碍降级策略，本项目自动响应以下系统偏好：

| 系统偏好 | 受影响子系统 | 本项目降级行为 |
|----------|-------------|--------------|
| `prefers-reduced-transparency` | 透明/模糊 | 所有玻璃类自动切换为不透明底色（`--bg-card` → 不透明近似值）；`backdrop-filter` 移除；内高光保留 |
| `prefers-reduced-motion` | 动效/弹簧 | 所有过渡时长降至 0；`scale` 按下改为 opacity 变化；骨架屏 shimmer 保留但加速 |
| `prefers-contrast: more` | 对比度 | 文字颜色切换为高对比版本（`--text-1` 加深）；描边改为实心 2rpx；禁止透明底色 |

### 7.3 性能约束

| 约束 | 数值 | 说明 |
|------|------|------|
| 单屏模糊层 | ≤ 4 层 | 超过则低端机掉帧 |
| 光晕 | 用 `radial-gradient` | 禁用 `filter: blur()` 绘制光晕 |
| 长列表 | 强制 `.glass-dense` | 不加 `backdrop-filter` |
| 动效 | 只动 `transform` / `opacity` | 禁止动 `backdrop-filter`、`filter`、`border-radius` |
| 嵌套玻璃 | 禁止 | 嵌套改用 `--bg-subtle` + 发丝线 |

### 7.4 文字可读性

- 正文 `#1D222B` 在 68% 白玻璃 + 浅底上对比度 > **12:1**，远超 WCAG AA（4.5:1）要求；
- 次级文字 `#5A6270` 在相同背景下对比度 > **5:1**，满足 AA；
- placeholder `#B6BDC9` 在白色输入底上对比度约 3:1（大字号可达 AA）。

**测试矩阵**：微信开发者工具 + iOS 真机 + Android 真机（至少一台中低端）+ Chrome / Safari 后台。

---

## 8. 实施计划（建议 3–4 个工作日）

| 阶段 | 内容 | 产出 / 验收门 |
|------|------|---------------|
| **P0 基础层**（0.5–1d） | Token 重写、全局五档 glass 类、背景光晕、TabBar Wash 层、导航栏配色 | 登录页 + 首页两页试点通过真机预览，五级 glass 类全部可用 |
| **P1 核心页**（1–1.5d） | 登录 / 注册 / 欢迎 / 首页 / 商品 / 开单 | 主流程视觉统一，开单页无卡顿（长列表 Dense，模糊层 ≤ 4） |
| **P2 其余页**（1d） | 订单 / 我的 / 客户 / 订单详情 / 商品编辑 / 分类 / 平台 / 打印机 + 硬编码色清理 | 全站无残留旧色、无布局溢出、无玻璃叠玻璃 |
| **P3 Web 后台**（0.5–1d） | style.css 重写 + 登录页 + 侧边栏 Wash 层玻璃化 + 弹窗 Overlay 玻璃化 | 桌面/移动端断点正常，无功能回归 |
| **P4 回归与打磨**（0.5d） | 双端真机走查、低端机退化验证、对比度检查、`prefers-reduced-motion` 验证、截图归档 | 验收清单全过 |

**关键策略：**

- 所有旧 class 名保持不变（`.card`、`.btn-primary` 等），只改样式定义 → 页面无需大改 WXML，降低回归风险；
- 分期上线：P0+P1 可先合并验证，再推进 P2/P3；
- 每阶段提交前跑 `npm run lint` + 开发者工具预览；Web 端本地打开 `index.html` 走查；
- 每次改动后用 grep 检查是否有残留硬编码色（`#f0b4ae`、`#F3EFE7` 等）。

---

## 9. 验收清单

**视觉**

- [ ] 全站底色为浅色冷灰蓝渐变，可见 2 处低饱和光晕（紫 / 暖橙），无高饱和色块
- [ ] 卡片具有半透明玻璃质感：白底透光、内高光（顶部 1rpx 亮边）、发丝描边、柔和环境投影
- [ ] 圆角、阴影、间距在全站一致（36rpx 卡片 / 24rpx 输入 / 999rpx 胶囊按钮）
- [ ] 底部导航为悬浮 Wash 层玻璃胶囊，中间开单圆钮凸出且不遮挡内容
- [ ] 页面无玻璃叠玻璃导致的发灰、浑浊现象
- [ ] 危险色（红）仅出现在真正危险操作，正常页面不含红色

**交互**

- [ ] 按钮按下有柔性回弹（`scale(0.98)` + 阴影变化），松开后弹性复位
- [ ] 输入框聚焦为主色柔光光环，不再是硬描边
- [ ] 弹窗/遮罩为 Overlay 玻璃面板 + 模糊遮罩
- [ ] 动效克制（≤350ms），无持续闪烁

**兼容 / 无障碍 / 性能**

- [ ] iOS 真机模糊正常；Android 真机（含低端）不发灰、不白屏
- [ ] 开单页 / 商品长列表滚动流畅，单屏模糊层 ≤ 4
- [ ] `prefers-reduced-motion` 生效时所有动效静止
- [ ] `prefers-reduced-transparency` 生效时玻璃类退化为不透明底色
- [ ] 正文对比度 > 12:1，次级文字 > 5:1
- [ ] 原生导航栏颜色与页面底色衔接自然
- [ ] Web 端 Chrome/Safari 正常，Firefox 兜底可读

**功能回归**

- [ ] 登录 / 注册 / 绑定三步 / 欢迎页全流程正常
- [ ] 开单、订单、商品、会员、店铺、平台、打印机功能无异常
- [ ] 所有弹窗、加载态、空状态、错误提示显示正常
- [ ] 无 JS 逻辑变更，接口与数据结构零改动
- [ ] 无残留旧硬编码色（grep 确认）

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 低端安卓模糊失效 | 玻璃感减弱，但视觉仍成立 | 设计以半透明底色托底；Dense 层本就无模糊；`prefers-reduced-transparency` 自动触发不透明降级 |
| 玻璃层过多导致卡顿 | 滚动掉帧 | 单屏模糊层 ≤ 4；长列表强制 Dense；光晕用 radial-gradient（不用 filter） |
| 密集页面信息密度下降 | 开单效率 | 不放大字号/行高，仅换色与圆角；开单页单独走查，确认操作路径不变短 |
| 大范围改样式引发回归 | 页面错位 | 类名兼容策略 + 分阶段 + 每页视觉走查；旧 class 名不变 |
| 原生导航与光晕割裂 | 顶部突兀 | 导航色对齐底色（`#F3F5FA`）；二期可选自定义导航 |
| 主色更换影响品牌认知 | 品牌感变化 | 提供方案 B（保留柔化品牌红），Token 一键切换，不改组件代码 |
| Web 与小程序风格漂移 | 不一致 | 共用 Token 表与五档配方，同批走查；Token 命名完全对齐 |
| 卡片嵌套发灰 | 视觉浑浊 | 严禁玻璃叠玻璃；嵌套内层改用 `--bg-subtle` 或透明 + 发丝线 |

---

## 11. 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `styles/tokens.wxss` | 全量替换 Token（保留变量名） |
| 修改 | `app.wxss` | 全局组件玻璃化 + 新增五档 glass 类（`.glass-wash` / `.glass-card` / `.glass-dense` / `.glass-hero` / `.glass-overlay`） |
| 修改 | `app.json` | 导航栏 / 页面底色 |
| 修改 | `custom-tab-bar/index.wxss` | Wash 层悬浮玻璃 TabBar |
| 修改 | `pages/**/*.wxss`（15 个页面） | 逐页玻璃化 + 硬编码色清理 |
| 修改 | `web/style.css` | Web 端同源 Token 与全组件玻璃化 |
| 修改 | `web/index.html` | 可选：`<meta name="theme-color">` |
| 新增 | `docs/ui-redesign-plan.md` | 本文档 |
| 不改 | 业务 JS / WXML 结构 / `backend/` | 零逻辑改动 |

---

## 12. 待确认事项

1. **主色方向**：A. 蓝紫 + 暖橙（推荐）；B. 保留柔化品牌红 + 暖橙点缀。确认后只改 Token 即可切换。
2. **Web 后台是否同期改版**：推荐同期（同一套 Token，风格统一）；若先做小程序，Web 可在 P3 单独排期。
3. **顶部导航**：一期保留原生导航（稳），还是直接上自定义通栏玻璃导航（更好看但需处理状态栏/返回键）？
4. **深色模式**：本期不做，Token 结构已预留扩展接口，确认无异议即可。
5. **动效强度**：默认克制（仅按压回弹 + 页面淡入）；如需更强的入场动效（卡片错峰浮现）请说明。
6. **GlassHome 单公式 vs 多类名**：当前方案用五档独立类（`.glass-wash` / `.glass-card` 等），如需完全对齐 GlassHome 的单公式模式可后续重构，不影响本期进度。

确认以上几点后，即可按第 8 节阶段开始实施。
