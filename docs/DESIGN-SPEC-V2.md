# 🎨 「裁间」服装店管理系统 — 设计方案 v2.0

> 生成时间：2026-10-26 | 基于 UI-AUDIT-REPORT.md + GitHub 优秀项目调研  
> 设计方向：**清透质感 × B端效率**（Glassmorphism × Soft UI）

---

## 一、项目设计资产全景图

### 1.1 已有设计资产 ✅

| 资产类型   | 位置                                     | 状态                      | 评分       |
| ---------- | ---------------------------------------- | ------------------------- | ---------- |
| 品牌命名   | 全局导航栏「裁间」                       | ✅ 已统一                 | ⭐⭐⭐⭐⭐ |
| Token 体系 | `styles/tokens.wxss`                     | ✅ 四维度完整             | ⭐⭐⭐⭐⭐ |
| 玻璃层级   | Wash/Standard/Dense/Hero+Overlay         | ✅ 五档已定义             | ⭐⭐⭐⭐⭐ |
| 矢量图标   | `styles/icons.wxss` + `icons-extra.wxss` | ✅ 28个图标               | ⭐⭐⭐⭐   |
| 底部 Dock  | `custom-tab-bar/index.wxss`              | ✅ 悬浮胶囊+拼接态        | ⭐⭐⭐⭐⭐ |
| 无障碍降级 | 三色媒体查询                             | ✅ 低透明/减动效/增强对比 | ⭐⭐⭐⭐   |
| 进场动画   | 错峰淡入卡片                             | ✅ 340ms stagger          | ⭐⭐⭐⭐   |

### 1.2 待完善的设计短板 ⚠️

| 短板             | 现状                                                                                                                  | 影响                 | 优先级 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------- | ------ |
| **Token 补充**   | 已补齐 `--font-xs-sm`、`--font-h4`、`--anim-duration-page`；仍缺基础 `--shadow-glow`（现仅有 success / warning 两档） | 通用光晕无统一 Token | P2     |
| **Token 文档**   | 本节即 Token 说明；`docs/DESIGN-SPEC-WEB.md` 2.3 / 2.4 节对齐 Web 侧                                                  | 已可作为协作依据     | ✅     |
| **空状态规范**   | 分散在各页，无统一空态组件                                                                                            | 体验不一致           | P1     |
| **骨架屏规范**   | 只有 skeleton-card 组件，无列表级骨架                                                                                 | 长列表加载无反馈     | P2     |
| **深色模式**     | 仅有无障碍降级，无真正 Dark Mode                                                                                      | 夜间使用疲劳         | P3     |
| **设计规范文档** | 已建立本文档 `docs/DESIGN-SPEC-V2.md`                                                                                 | 作为团队设计依据     | ✅     |
| **组件命名规范** | BEM 未严格执行                                                                                                        | 样式冲突风险         | P2     |

---

## 二、设计原则（已确立）

> 源自微信官方设计指南 + GitHub 优秀项目提炼

### 原则 1：重点突出

每个页面应有明确视觉重心，减少无关设计元素干扰。

**落地：**

- 首页：销售额 Hero 卡为唯一焦点（渐变 + 大字号）
- 开单页：结算栏为操作焦点（固定底部 + 高对比色）
- 订单页：状态胶囊为信息焦点

### 原则 2：流程明确

操作流程中不出现打断用户目标的内容。

**落地：**

- 开单后订单统一为「待收款」，不强制当场收款
- 成功态弹窗一次，不中断主流程
- 页面切换 dock 栏无缝拼接，无跳变

### 原则 3：反馈及时

等待时给予明确反馈，操作结果立即可见。

**落地：**

- 按钮点击 scale(0.98) 按压反馈
- 加载状态 btn-loading 转圈动画
- 开单成功卡片 + 脉冲动画

### 原则 4：包容性

所有用户可访问，尊重系统偏好设置。

**落地：**

- `prefers-reduced-transparency` → 退化为纯色底
- `prefers-reduced-motion` → 动画全部静止
- `prefers-contrast: more` → 文字加深、描边实心

---

## 三、Token 体系完整规范

### 3.1 现有 Token 清单（styles/tokens.wxss）

```
page, :host {
  /* 基底 */
  --bg-app: #eff3fa;
  --bg-gradient: linear-gradient(180deg, #f5f7fc 0%, #e6ecf7 100%);
  --bg-card: rgba(255, 255, 255, 0.68);
  --bg-card-strong: rgba(255, 255, 255, 0.86);
  --bg-subtle: rgba(255, 255, 255, 0.46);
  --bg-overlay: rgba(255, 255, 255, 0.82);
  --dock-bg: rgba(255, 255, 255, 0.94);

  /* 描边 */
  --glass-border: rgba(255, 255, 255, 0.72);
  --hairline: rgba(29, 34, 43, 0.06);
  --border: rgba(29, 34, 43, 0.08);
  --border-strong: rgba(29, 34, 43, 0.16);
  --divider: rgba(29, 34, 43, 0.06);

  /* 文字 */
  --text-1: #1d222b;
  --text-2: #5a6270;
  --text-3: #97a0ae;
  --text-placeholder: #b6bdc9;

  /* 品牌 */
  --primary: #7b8cf7;
  --primary-dark: #6675e8;
  --primary-tint: rgba(123, 140, 247, 0.12);

  /* 点缀 */
  --warm: #f2a57c;
  --warm-tint: rgba(242, 165, 124, 0.16);

  /* 语义色 */
  --success: #3bae76;
  --success-tint: rgba(59, 174, 118, 0.12);
  --warning: #d69a3c;
  --warning-tint: rgba(214, 154, 60, 0.12);
  --danger: #e05d57;
  --danger-tint: rgba(224, 93, 87, 0.12);
  --info: #4c8fe8;
  --info-tint: rgba(76, 143, 232, 0.12);

  /* 风险分级 */
  --stock-critical: #e05d57;
  --stock-warning: #d69a3c;
  --rssi-strong: #3bae76;
  --rssi-normal: #d69a3c;
  --rssi-weak: #e05d57;

  /* 模糊 */
  --blur-sm: 14px;
  --blur-md: 20px;
  --blur-lg: 26px;

  /* 圆角 */
  --radius-sm: 16rpx;
  --radius-md: 24rpx;
  --radius-card: 36rpx;
  --radius-hero: 44rpx;
  --radius-input: 24rpx;
  --radius-sheet: 44rpx;
  --radius-pill: 999rpx;

  /* 间距 */
  --space-1: 8rpx;
  --space-2: 16rpx;
  --space-3: 24rpx;
  --space-4: 32rpx;
  --space-5: 40rpx;
  --space-6: 48rpx;
  --space-7: 56rpx;
  --space-8: 64rpx;
  --space-9: 80rpx;
  --space-10: 96rpx;
  --space-11: 112rpx;

  /* 字号 */
  --font-xs: 22rpx;
  --font-body: 28rpx;
  --font-h3: 32rpx;
  --font-h2: 44rpx;
  --font-h1: 72rpx;

  /* 布局 */
  --space-tabbar-height: 108rpx;
  --space-tabbar-gap: 16rpx;
  --space-tabbar-bottom: 124rpx;
  --space-fab-bottom: 160rpx;
  --dock-bar-height: 136rpx;
  --space-fixed-bottom: 140rpx;

  /* 阴影 */
  --shadow-soft-1: 0 6rpx 20rpx rgba(35, 45, 75, 0.06);
  --shadow-soft-2: 0 14rpx 40rpx rgba(35, 45, 75, 0.08);
  --shadow-float: 0 24rpx 60rpx rgba(35, 45, 75, 0.12);
  --shadow-1: 0 6rpx 20rpx rgba(35, 45, 75, 0.06);
  --shadow-2: 0 14rpx 40rpx rgba(35, 45, 75, 0.08);
  --shadow-3: 0 24rpx 60rpx rgba(35, 45, 75, 0.12);
  --shadow-primary: 0 16rpx 36rpx rgba(123, 140, 247, 0.26);

  /* 内高光 */
  --inner-light: inset 0 1rpx 0 rgba(255, 255, 255, 0.85);

  /* 动效 */
  --duration-fast: 150ms;
  --duration-normal: 220ms;
  --duration-slow: 350ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --scale-press: 0.98;
  --scale-press-dock: 0.94;
}
```

### 3.2 建议新增 Token

#### 3.2.1 字号补充

```css
/* 新增：补充当前缺失的字号档位 */
--font-xs-sm: 20rpx; /* 辅助注释、时间戳、次级说明 */
--font-h4: 26rpx; /* 列表项副标题（当前无 token，硬编码） */
```

**依据：** TDesign 的 `--fs-*` 命名规范与 schoolv2 的 tokengov 体系，字号应覆盖 13 档。当前项目仅 5 档，建议在后续迭代中补齐。

#### 3.2.2 阴影补充

```css
/* 新增：成功态光晕阴影 */
--shadow-glow-success: 0 0 40rpx rgba(59, 174, 118, 0.2);
--shadow-glow-warning: 0 0 40rpx rgba(214, 154, 60, 0.2);
```

**依据：** aqua-weapp-ui 的 success/warning 光晕效果，用于库存告急时的微弱提醒。

#### 3.2.3 动效补充

```css
/* 新增：页面切换时长 */
--anim-duration-page: 400ms;
```

**依据：** 微信官方设计指南建议页面切换动画 300-400ms，当前项目无此 token。

### 3.3 Token 命名规范（对齐 TDesign）

| 类别 | 当前命名                   | 建议改进              |
| ---- | -------------------------- | --------------------- |
| 颜色 | `--primary`, `--success`   | ✅ 已符合语义命名     |
| 圆角 | `--radius-sm/md/card/hero` | ✅ 已符合语义命名     |
| 间距 | `--space-1~11`             | ✅ 已符合数字阶梯规范 |
| 字号 | `--font-xs/body/h3/h2/h1`  | ⚠️ 建议补齐 h4/xs-sm  |
| 阴影 | `--shadow-soft-1/2/float`  | ✅ 已符合层级命名     |

---

## 四、玻璃层级规范（Five-Tier Glass）

### 4.1 层级定义

| 层级         | 类名             | 不透明度 | 模糊 | 适用场景                     |
| ------------ | ---------------- | -------- | ---- | ---------------------------- |
| **Wash**     | `.glass-wash`    | 40%      | 14px | 搜索框、TabBar、分段控件轨道 |
| **Standard** | `.glass-card`    | 68%      | 20px | 普通功能卡、列表项背景       |
| **Dense**    | `.glass-dense`   | 86%      | 无   | 密集列表、表格（性能优先）   |
| **Hero**     | `.glass-hero`    | 渐变 92% | 26px | 首页销售额卡、登录面板       |
| **Overlay**  | `.glass-overlay` | 82%      | 26px | 弹窗、遮罩层面板             |

### 4.2 参考对标

| 项目          | 层级命名                            | 本项目对齐情况                    |
| ------------- | ----------------------------------- | --------------------------------- |
| glass-ui      | Wash/Quiet/Resting/Floating/Overlay | ✅ 完全对齐                       |
| Aqua UI WeApp | glass/solid/tint/ocean              | ⚠️ 部分对齐（Dense 层对应 solid） |
| TDesign       | shadow-1/2/3 (elevation)            | ⚠️ 本项目用 glass 替代 elevation  |

### 4.3 使用规则

```
✅ 正确用法
  - 滚动内容卡使用 Standard 或 Dense（不加 backdrop-filter）
  - 固定层（结算栏、Dock）使用 Overlay 或 Dock-bg
  - 弹窗始终使用 Overlay

⚠️ 注意事项
  - 单屏 backdrop-filter 元素 ≤ 4 个（性能约束）
  - Dense 层不启用模糊，长列表性能优先
  - Wash 层仅用于低层级的输入底/轨道
```

---

## 五、间距与圆角规范

### 5.1 间距基准（4rpx 网格）

```
所有 padding / margin 必须是 4 的倍数
当前项目主要使用 8rpx 基准（--space-1 = 8rpx）
```

**验证命令：**

```bash
grep -rn "[0-9][0-9]*rpx" *.wxss pages/**/**/*.wxss | \
  grep -vE '(0rpx|8rpx|16rpx|24rpx|32rpx|40rpx|48rpx|56rpx|64rpx|72rpx|80rpx|88rpx|96rpx|104rpx|112rpx)'
```

### 5.2 圆角嵌套规则

```
外层容器圆角 ≥ 内层元素圆角
  - .goods-card (36rpx) → .goods-img (16rpx) ✅
  - .billing .goods-row (36rpx) → .goods-img (16rpx) ✅
  - .wc-guide (36rpx) → .guide-icon (16rpx) ✅
```

### 5.3 历史修复记录（UI-AUDIT-REPORT，40/40 已完成）

圆角相关条目已全部落地，详见 `UI-AUDIT-REPORT.md` 第 2 节（作为历史基线保留）。

---

## 六、字号层级规范

### 6.1 当前 Token 覆盖

| Token         | 值    | 用途                     |
| ------------- | ----- | ------------------------ |
| `--font-xs`   | 22rpx | 辅助文字、标签、注释     |
| `--font-body` | 28rpx | 正文、输入框             |
| `--font-h3`   | 32rpx | 卡片标题、小标题         |
| `--font-h2`   | 44rpx | 页面主标题               |
| `--font-h1`   | 72rpx | 数据突出显示（销售额等） |

### 6.2 建议扩展至 13 档（参考 schoolv2 tokengov）

| Token             | 值    | 用途                   |
| ----------------- | ----- | ---------------------- |
| `--font-xs-sm`    | 20rpx | 次级注释、时间戳       |
| `--font-xs`       | 22rpx | 标签、徽标             |
| `--font-body-sm`  | 26rpx | 辅助正文               |
| `--font-body`     | 28rpx | 正文                   |
| `--font-h4`       | 30rpx | 副标题（当前硬编码）   |
| `--font-h3`       | 32rpx | 卡片标题               |
| `--font-subtitle` | 36rpx | 分区标题（当前硬编码） |
| `--font-h2`       | 44rpx | 页面主标题             |
| `--font-h1`       | 72rpx | 数据突出               |
| `--font-hero`     | 96rpx | 空状态图标             |

### 6.3 历史修复记录（UI-AUDIT-REPORT，40/40 已完成）

字号相关条目已全部落地，详见 `UI-AUDIT-REPORT.md` 第 3 节（作为历史基线保留）。

---

## 七、颜色规范

### 7.1 品牌色板

```
主色（蓝紫）:
  --primary:    #7b8cf7
  --primary-dark: #6675e8
  --primary-tint: rgba(123, 140, 247, 0.12)

点缀色（暖橙）:
  --warm:       #f2a57c
  --warm-tint:  rgba(242, 165, 124, 0.16)
```

### 7.2 语义色板（饱和度 ≤ 70%，已验证）

| 语义 | 色值      | 饱和度 | 状态 |
| ---- | --------- | ------ | ---- |
| 成功 | `#3bae76` | ~55%   | ✅   |
| 警告 | `#d69a3c` | ~55%   | ✅   |
| 危险 | `#e05d57` | ~55%   | ✅   |
| 信息 | `#4c8fe8` | ~55%   | ✅   |

### 7.3 文字色板

```
--text-1:  #1d222b  /* 主文字（深灰蓝，非纯黑） */
--text-2:  #5a6270  /* 次要文字 */
--text-3:  #97a0ae  /* 弱化文字 */
--text-placeholder: #b6bdc9  /* 占位符 */
```

### 7.4 参考对标

| 项目          | 品牌色策略             | 本项目对比           |
| ------------- | ---------------------- | -------------------- |
| TDesign       | 单一主色 + 语义色      | ✅ 一致              |
| aqua-weapp-ui | Ocean 深海 + Aqua 荧光 | ⚠️ 本项目用蓝紫+暖橙 |
| schoolv2      | 角色多品牌色           | ⚠️ 本项目单一品牌    |

---

## 八、图标规范

### 8.1 现有图标集

**基础图标（icons.wxss - 28个）：**

```
search, package, receipt, shopping-bag, folder, hourglass, lock,
menu, home, plus, shirt, store, shield, swap, refresh,
chevron-right, printer, clipboard, check-circle, x-circle,
eye, eye-off, chevron-down
```

**补充图标（icons-extra.wxss - 10个）：**

```
cash-register, clock, cake, star, crown, gem, gift, layout, document
```

### 8.2 图标尺寸规范

| 场景        | 推荐尺寸 | 示例           |
| ----------- | -------- | -------------- |
| TabBar 图标 | 44rpx    | .tabbar-icon   |
| 按钮图标    | 28-36rpx | .pwd-toggle    |
| 列表图标    | 24-28rpx | .search-icon   |
| 空状态图标  | 80-96rpx | .empty-icon    |
| 欢迎页图标  | 68rpx    | .wc-ring-inner |

### 8.3 图标颜色规范

```css
/* 图标颜色随 currentColor，由父容器决定 */
.icon {
  color: var(--text-2);
} /* 次要图标 */
.icon {
  color: var(--primary-dark);
} /* 品牌图标 */
.icon {
  color: var(--text-3);
} /* 弱化图标 */
.icon {
  color: #fff;
} /* 白色图标（渐变底上） */
```

### 8.4 建议新增图标

| 图标             | 用途           | 优先级 |
| ---------------- | -------------- | ------ |
| `icon-chart`     | 经营看板趋势图 | P2     |
| `icon-calendar`  | 时间筛选       | P2     |
| `icon-upload`    | 图片上传       | P2     |
| `icon-download`  | 数据导出       | P3     |
| `icon-bluetooth` | 蓝牙打印状态   | P3     |

---

## 九、组件规范

### 9.1 按钮体系

```
.btn-primary    → 渐变背景 + pill 圆角 + shadow-primary
.btn-ghost      → 白色底 + primary 文字 + border
.btn-danger     → 红色渐变 + pill 圆角
.btn-mini       → 24rpx 字号 + pill 圆角（辅助操作）
```

**状态：**

```
:active     → scale(var(--scale-press)) = 0.98
[disabled]  → opacity: 0.45, box-shadow: none
.btn-loading → spinner 转圈动画
```

### 9.2 标签/徽标体系

```
.tag-blue     → var(--primary-tint) + var(--primary-dark)
.tag-green    → var(--success-tint) + var(--success)
.tag-orange   → var(--warning-tint) + var(--warning)
.tag-red      → var(--danger-tint) + var(--danger)
.tag-gray     → var(--bg-subtle) + var(--text-2)
```

### 9.3 表单体系

```
.form-item        → padding: 24rpx 0, border-bottom: hairline
.form-label       → width: 170rpx, font-size: 28rpx
.form-input       → flex: 1, font-size: 28rpx
.form-textarea    → height: 140rpx
.form-arrow       → color: var(--text-placeholder), font-size: 26rpx
.pwd-field        → position: relative, toggle at right: 20rpx
```

### 9.4 空状态体系

```
.empty-state      → text-align: center, padding: 120rpx 40rpx
.empty-state-icon → font-size: 96rpx, opacity: 0.4
.empty-state-title → font-size: 30rpx, color: var(--text-2)
.empty-state-sub  → font-size: 26rpx, color: var(--text-2), margin-top: 16rpx
```

### 9.5 弹窗体系

```
.modal            → width: 640rpx, border-radius: var(--radius-hero)
.modal-title      → font-size: 32rpx, font-weight: bold
.modal-sub        → font-size: 24rpx, color: var(--text-3)
.modal-btns       → display: flex, margin-top: 32rpx
.modal-btn.primary → margin-left: 24rpx
```

**入场动画：**

```css
@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

---

## 十、Dock 栏规范

### 10.1 结构

```
.custom-tab-bar（悬浮 Wash 玻璃胶囊）
├── .tabbar-item × 5
│   ├── .tabbar-icon-wrap（选中时 translateY(-2rpx)）
│   │   ├── .tabbar-icon（44rpx）
│   │   └── .tabbar-text（22rpx，margin-top: 4rpx）
│   └── ::before（选中态背景胶囊，104rpx 宽）
└── .tabbar-item-middle（开单键，绝对定位凸起）
    ├── .tabbar-icon-wrap（translateY(-28rpx)）
    │   ├── ::before（圆钮底衬，108rpx）
    │   └── .tabbar-icon（44rpx）
    └── .tabbar-text
```

### 10.2 状态机

| 状态   | 类名            | 中间键表现          |
| ------ | --------------- | ------------------- |
| 普通   | -               | 凸起圆钮 + 白色图标 |
| 选中   | .active         | 凸起圆钮 + 白色图标 |
| 按下   | :active         | scale(0.94)         |
| 拼接   | .tabbar-docked  | 收平 + 灰色图标     |
| 开单页 | .tabbar-billing | 收平 + 灰色图标     |

### 10.3 跨页切换动画

| 场景         | 动画                             |
| ------------ | -------------------------------- |
| a：拼接→拼接 | 高亮胶囊淡入                     |
| b：拼接→普通 | 栏体收方 + 中间键抬起            |
| c：普通→拼接 | 栏体收方 + 中间键收平 + 面板拉出 |
| d：普通→普通 | 按键落位动画                     |

---

## 十一、动效规范

### 11.1 共享动效 Token

```css
/* 时长 */
--duration-fast: 150ms; /* 按钮按压、标签切换 */
--duration-normal: 220ms; /* 卡片进场、状态切换 */
--duration-slow: 350ms; /* 弹窗、Dock 拉出 */

/* 缓动 */
--ease-out: cubic-bezier(0, 0, 0.2, 1); /* 通用 */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* 弹性 */
--ease-dock: cubic-bezier(0.32, 0.72, 0, 1); /* Dock 拉出 */

/* 缩放 */
--scale-press: 0.98; /* 普通按钮 */
--scale-press-dock: 0.94; /* Dock 中间键 */
```

### 11.2 关键动画

| 动画名               | 时长  | 缓动        | 触发场景                     |
| -------------------- | ----- | ----------- | ---------------------------- |
| `card-in`            | 340ms | ease-out    | 首页卡片进场（stagger 70ms） |
| `modal-in`           | 350ms | ease-spring | 弹窗出现                     |
| `dock-card-pull`     | 360ms | ease-dock   | 结算栏/批量栏从 TabBar 拉出  |
| `tabbar-item-settle` | 220ms | ease-out    | 普通→普通页面切换            |
| `tabbar-mid-raise`   | 280ms | ease-out    | 中间键抬起（拼接消失）       |
| `tabbar-mid-flatten` | 280ms | ease-out    | 中间键收平（拼接出现）       |
| `ringPulse`          | 1.8s  | ease-out    | 欢迎页品牌环脉冲             |
| `btnSpin`            | 0.8s  | linear      | 按钮加载转圈                 |
| `status-pulse`       | 600ms | ease-spring | 状态变化脉冲                 |
| `fadeUp`             | 500ms | ease        | 欢迎页依次淡入               |

---

## 十二、无障碍规范

### 12.1 三色降级策略

| 媒体查询                       | 降级行为                         | 适用场景     |
| ------------------------------ | -------------------------------- | ------------ |
| `prefers-reduced-transparency` | 玻璃 → 纯色底，模糊 → 无         | 高透明度过敏 |
| `prefers-reduced-motion`       | 所有 transition/animation → none | 动效敏感     |
| `prefers-contrast: more`       | 文字加深，描边实心，去透明底     | 对比度不足   |

### 12.2 降级实现

```css
/* app.wxss 已实现三色降级 */
@media (prefers-reduced-transparency: reduce) {
  --bg-card: #ffffff;
  --bg-card-strong: #ffffff;
  --bg-subtle: #f4f6fa;
  --bg-overlay: #ffffff;
  backdrop-filter: none;
}

@media (prefers-reduced-motion: reduce) {
  view,
  text,
  button {
    transition: none;
    animation: none;
  }
}

@media (prefers-contrast: more) {
  --text-1: #0c1016;
  --text-2: #3c434f;
  --glass-border: rgba(29, 34, 43, 0.35);
}
```

---

## 十三、参考对标分析

### 13.1 GitHub 优秀项目对比

| 项目                            | Stars | 核心借鉴点                                                               |
| ------------------------------- | ----- | ------------------------------------------------------------------------ |
| **aqua-weapp-ui**               | 5     | 阅读优先玻璃、Ocean/Aqua 双色、140-240ms 动效共享 Token                  |
| **JUNGHERZ/GlassKit**           | 14    | iOS Liquid Glass 五档层级、背景光晕 SVG                                  |
| **themesberg/glass-ui**         | 407   | 五档玻璃命名（Wash→Overlay）完全对齐                                     |
| **Tencent/tdesign-miniprogram** | 1689  | CSS Variables 主题定制、深色模式适配                                     |
| **schoolv2 (tokengov)**         | -     | 多角色 Token 对齐、AUD-003 审计机制                                      |
| **PoemUI**                      | Beta  | 5 个布尔开关（shadow/frosted-glass/large-radius/bordered/equal-spacing） |

### 13.2 收银/POS 系统参考

| 项目                                   | 核心借鉴点                                  |
| -------------------------------------- | ------------------------------------------- |
| **renkunx/pos-app-demo**               | 状态驱动屏幕切换、支付结果页全屏            |
| **niokagi/wabw-cashier-fe**            | 分屏 POS 布局（60%商品/40%购物车）          |
| **uvindu94/pos**                       | Bento Grid 仪表盘、touch-optimized terminal |
| **Charith-Dhananjaya/saas-pos-system** | Glassmorphism Dashboard + Emerald 强调色    |
| **PAkash7/asc-manage**                 | 玻璃结算栏 + 声音反馈                       |

---

## 十四、P0 修复清单（40处）

### 14.1 间距修复（17处）

将 `12rpx` → `16rpx`（即 `--space-2`），`22rpx` → `24rpx`（即 `--space-3`），`10rpx` → `8rpx`，`6rpx` → `8rpx`。

| 文件                             | 行号 | 选择器                         | 当前值                 | 建议修正    |
| -------------------------------- | ---- | ------------------------------ | ---------------------- | ----------- |
| `app.wxss`                       | L326 | `.customer-arrow`              | `margin-right: 12rpx`  | → `16rpx`   |
| `app.wxss`                       | L447 | `.modal-sub`                   | `margin-bottom: 12rpx` | → `16rpx`   |
| `app.wxss`                       | L519 | `.empty-state-sub`             | `margin-bottom: 12rpx` | → `16rpx`   |
| `billing/billing.wxss`           | L22  | `.search-icon`                 | `margin-right: 12rpx`  | → `16rpx`   |
| `billing/billing.wxss`           | L484 | `.success-order`               | `margin-top: 12rpx`    | → `16rpx`   |
| `customer/list.wxss`             | L202 | `.customer-arrow`              | `margin-left: 12rpx`   | → `16rpx`   |
| `goods/goods.wxss`               | L131 | `.goods-meta text:first-child` | `margin-right: 12rpx`  | → `16rpx`   |
| `order-detail/order-detail.wxss` | L46  | `.status-sub`                  | `margin-top: 12rpx`    | → `16rpx`   |
| `order-detail/order-detail.wxss` | L69  | `.item-spec`                   | `margin-top: 10rpx`    | → `8rpx`    |
| `order-detail/order-detail.wxss` | L75  | `.item-price`                  | `margin-left: 12rpx`   | → `16rpx`   |
| `order-detail/order-detail.wxss` | L86  | `.total-row`                   | `padding-top: 22rpx`   | → `24rpx`   |
| `order-detail/order-detail.wxss` | L116 | `.action-btn`                  | `margin: 12rpx 0`      | → `16rpx 0` |
| `order-detail/order-detail.wxss` | L150 | `.timeline-dot`                | `margin-top: 6rpx`     | → `8rpx`    |
| `printer-pair/printer-pair.wxss` | L35  | `.status-icon`                 | `margin-bottom: 12rpx` | → `16rpx`   |
| `printer-pair/printer-pair.wxss` | L178 | `.settings-label`              | `margin-bottom: 12rpx` | → `16rpx`   |
| `printer-pair/printer-pair.wxss` | L361 | `.help-title`                  | `margin-bottom: 12rpx` | → `16rpx`   |
| `store/store.wxss`               | L191 | `.popup-cancel`                | `padding: 12rpx 0`     | → `16rpx 0` |

### 14.2 圆角修复（5处）

全部替换为 `var(--radius-sm)` = 16rpx。

| 文件                         | 行号 | 选择器        | 当前值                 |
| ---------------------------- | ---- | ------------- | ---------------------- |
| `goods/goods.wxss`           | L85  | `.goods-img`  | `border-radius: 20rpx` |
| `billing/billing.wxss`       | L46  | `.goods-img`  | `border-radius: 20rpx` |
| `goods-edit/goods-edit.wxss` | L27  | `.img-thumb`  | `border-radius: 20rpx` |
| `goods-edit/goods-edit.wxss` | L51  | `.img-add`    | `border-radius: 20rpx` |
| `welcome/welcome.wxss`       | L115 | `.guide-icon` | `border-radius: 20rpx` |

### 14.3 字号修复（4处）

| 文件                         | 行号 | 选择器          | 当前值  | 建议值                  |
| ---------------------------- | ---- | --------------- | ------- | ----------------------- |
| `goods-edit/goods-edit.wxss` | L196 | `.sku-name`     | `27rpx` | `28rpx` (`--font-body`) |
| `index/index.wxss`           | L162 | `.bookmark-tab` | `25rpx` | `22rpx` (`--font-xs`)   |
| `goods/goods.wxss`           | L54  | `.goods-no`     | `23rpx` | `22rpx` (`--font-xs`)   |
| `welcome/welcome.wxss`       | L130 | `.guide-sub`    | `23rpx` | `22rpx` (`--font-xs`)   |

### 14.4 padding 标准化（10处）

| 文件                             | 行号 | 选择器                | 当前值        | 建议修正        |
| -------------------------------- | ---- | --------------------- | ------------- | --------------- |
| `category/category.wxss`         | L30  | `.cat-manage-btn`     | `12rpx 32rpx` | → `8rpx 32rpx`  |
| `goods-edit/goods-edit.wxss`     | L121 | `.tag-edit`           | `12rpx 20rpx` | → `8rpx 16rpx`  |
| `goods-edit/goods-edit.wxss`     | L158 | `.size-opt`           | `12rpx 32rpx` | → `8rpx 32rpx`  |
| `goods-edit/goods-edit.wxss`     | L207 | `.sku-input`          | `12rpx 16rpx` | → `16rpx 16rpx` |
| `goods/goods.wxss`               | L189 | `.manage-entry`       | `12rpx 24rpx` | → `8rpx 24rpx`  |
| `orders/orders.wxss`             | L35  | `.filter-entry`       | `12rpx 4rpx`  | → `12rpx 8rpx`  |
| `orders/orders.wxss`             | L52  | `.status-tab`         | `12rpx 24rpx` | → `8rpx 24rpx`  |
| `printer-pair/printer-pair.wxss` | L186 | `.setting-chip`       | `12rpx 28rpx` | → `8rpx 24rpx`  |
| `printer-pair/printer-pair.wxss` | L230 | `.logs-clear`         | `6rpx 12rpx`  | → `4rpx 16rpx`  |
| `store/store.wxss`               | L333 | `.drag-handle-bottom` | `12rpx 16rpx` | → `8rpx 16rpx`  |

### 14.5 字号 Token 引用（5处）

| 文件                                 | 行号 | 选择器              | 当前值  | 建议 Token               |
| ------------------------------------ | ---- | ------------------- | ------- | ------------------------ |
| `custom-confirm/custom-confirm.wxss` | L43  | `.c-confirm-title`  | `34rpx` | `var(--font-h3)` = 32rpx |
| `order-detail/order-detail.wxss`     | L89  | `.total-row .price` | `36rpx` | `var(--font-h3)` = 32rpx |
| `billing/billing.wxss`               | L487 | `.success-amount`   | `60rpx` | `var(--font-h1)` = 72rpx |
| `category/category.wxss`             | L22  | `.cat-page-title`   | `38rpx` | `var(--font-h2)` = 44rpx |
| `store/store.wxss`                   | L426 | `.settings-arrow`   | `34rpx` | `var(--font-h3)` = 32rpx |

---

## 十五、执行顺序建议

```
第 1 步：修复 P0 间距（17处）—— 批量 grep + replace
第 2 步：修复 P0 圆角（5处）—— 20rpx → var(--radius-sm)
第 3 步：修复 P0 字号（4处）—— 27/25/23rpx → 标准值
第 4 步：修复 P1 padding（10处）
第 5 步：修复 P1 字号（5处）
第 6 步：全量验证，确认无遗漏
第 7 步：补充 Token（--font-xs-sm, --shadow-glow）
第 8 步：更新 UI-AUDIT-REPORT.md 状态
```

**预计工作量：约 40 处修改，可在 1 次迭代内完成。**

---

## 十六、后续设计优化建议

### 16.1 短期（P2-P3）

| 任务         | 说明                                           | 优先级    |
| ------------ | ---------------------------------------------- | --------- |
| 空状态组件化 | 提取 `.empty-state` 为通用组件                 | P2        |
| 骨架屏扩展   | 列表级骨架屏（非仅卡片）                       | P2        |
| 字号补全     | `--font-xs-sm`、`--font-h4` 已加入 tokens.wxss | ✅ 已完成 |
| 深色模式     | 基于 tokens.wxss 的 dark theme 覆盖            | P3        |

### 16.2 中期

| 任务           | 说明                                  | 优先级 |
| -------------- | ------------------------------------- | ------ |
| 设计规范文档   | 已建立本文档 `docs/DESIGN-SPEC-V2.md` | ✅     |
| Token 审计工具 | 类似 tokengov 的自动化检查脚本        | P3     |
| 图标扩充       | 新增 chart/calendar/upload 等         | P3     |
| BEM 规范化     | 统一 class 命名规范                   | P3     |

### 16.3 长期

| 任务       | 说明                       | 优先级 |
| ---------- | -------------------------- | ------ |
| 主题切换   | 支持蓝紫/深海/暖橙等多主题 | P3     |
| 动画库抽象 | 抽取动画为可配置 Token     | P3     |
| 设计交付物 | Figma 组件库同步           | P3     |

---

## 附录 A：设计参考来源

| 来源              | 链接                                   | 借鉴点                                        |
| ----------------- | -------------------------------------- | --------------------------------------------- |
| Glass UI          | github.com/themesberg/glass-ui         | 五档玻璃命名（Wash→Overlay）                  |
| GlassKit          | github.com/JUNGHERZ/GlassKit           | iOS Liquid Glass 灵感和背景光晕               |
| Aqua UI WeApp     | github.com/getaskclaw/aqua-weapp-ui    | 阅读优先玻璃、Ocean/Aqua 双色、动效共享 Token |
| TDesign           | github.com/Tencent/tdesign-miniprogram | CSS Variables 主题定制、深色模式              |
| schoolv2 tokengov | github.com/he2799388344-ctrl/schoolv2  | 多角色 Token 对齐、AUD-003 审计机制           |
| PoemUI            | github.com/fanxeon/poemui-miniprogram  | 5 个布尔开关控制视觉风格                      |
| POS Demo          | github.com/renkunx/pos-app-demo        | 状态驱动屏幕切换                              |
| 微信设计指南      | developers.weixin.qq.com               | 友好/清晰/便捷三大原则                        |

---

## 附录 B：验证命令

```bash
# 1. 检查非 4 倍数间距
grep -rn "[0-9][0-9]*rpx" *.wxss pages/**/**/*.wxss | \
  grep -vE '(0rpx|8rpx|16rpx|24rpx|32rpx|40rpx|48rpx|56rpx|64rpx|72rpx|80rpx|88rpx|96rpx|104rpx|112rpx)'

# 2. 检查硬编码圆角 20rpx
grep -rn "border-radius: 20rpx" *.wxss pages/**/**/*.wxss

# 3. 检查非常规字号
grep -rn "font-size: [0-9]*rpx" *.wxss pages/**/**/*.wxss | \
  grep -vE '(font-size: (20|22|24|26|28|30|32|34|36|38|40|44|48|52|56|60|64|68|72|80|96)rpx|var\(--font-)'

# 4. 检查非 Token 颜色（排除合法渐变）
grep -rn "#[0-9a-fA-F]\{3\}\(\|[0-9a-fA-F]\{6\}\)" *.wxss pages/**/**/*.wxss | \
  grep -vE '(background|linear-gradient|radial-gradient|rgba)'

# 5. 检查未使用 Token 的 padding/margin
grep -rn "padding: [0-9]*rpx" *.wxss pages/**/**/*.wxss | \
  grep -vE '(padding: (8|16|24|32|40|48|rpx)|var\(--space-)'
```

---

_设计方案 v2.0 | 2026-10-26_  
_基于：UI-AUDIT-REPORT.md + GitHub 优秀项目调研 + 微信官方设计指南_  
_设计方向：清透质感 × B端效率（Glassmorphism × Soft UI）_
