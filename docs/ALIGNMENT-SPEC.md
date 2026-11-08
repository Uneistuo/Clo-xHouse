# 🎯 「裁间」视觉对齐方案

> 版本：v1.0 | 日期：2026-10-27  
> 基于：GitHub 优秀设计系统调研 + 项目现状审计  
> 参考：IBM Carbon 2x Grid、GitHub Primer、TDesign、Apple Human Interface、USWDS

---

## 一、视觉对齐核心原则

### 1.1 设计哲学

> **对齐不是装饰，是秩序。**  
> 当元素的边缘、基线、间距遵循同一套隐形的网格，用户会感到「安静」——不需要思考为什么这样排列，因为一切都在正确的位置。

### 1.2 三大对齐维度

| 维度         | 说明                                            | 本项目状态                 |
| ------------ | ----------------------------------------------- | -------------------------- |
| **空间对齐** | 所有间距基于同一基准（4rpx/8rpx），形成视觉节奏 | ⚠️ 85% 达标，P0 修复后 95% |
| **边缘对齐** | 卡片、按钮、输入框的左/右/顶部边缘对齐到隐形列  | ⚠️ 部分页面不一致          |
| **基线对齐** | 文字内容的基线（baseline）跨列对齐              | ✅ 已实现（flexbox）       |

---

## 二、8pt 网格系统（基础层）

### 2.1 基准单位定义

```
小程序端：4rpx 为最小单位，8rpx 为 dominant rhythm
Web 端：  4px 为最小单位，8px 为 dominant rhythm
```

### 2.2 间距刻度表（小程序端 rpx）

| Token        | 值    | 用途                    | 层级      |
| ------------ | ----- | ----------------------- | --------- |
| `--space-px` | 4rpx  | 发丝间隙、icon-to-label | Micro     |
| `--space-1`  | 8rpx  | 紧凑内边距、chip 间距   | Tight     |
| `--space-2`  | 16rpx | 标准行间距、按钮内边距  | Default   |
| `--space-3`  | 24rpx | 卡片内边距、列表行高    | Section   |
| `--space-4`  | 32rpx | 分区间距、表单组间距    | Group     |
| `--space-5`  | 40rpx | 页面区块间距            | Page      |
| `--space-6`  | 48rpx | 大区块间距              | Outer     |
| `--space-7`  | 56rpx | 超大区块                | Container |
| `--space-8`  | 64rpx | 最大间距                | Global    |

### 2.3 间距刻度表（Web 端 px）

| Token        | 值   | 用途         | 层级    |
| ------------ | ---- | ------------ | ------- |
| `--space-px` | 4px  | 发丝间隙     | Micro   |
| `--space-1`  | 8px  | 紧凑内边距   | Tight   |
| `--space-2`  | 16px | 标准行间距   | Default |
| `--space-3`  | 24px | 卡片内边距   | Section |
| `--space-4`  | 32px | 分区间距     | Group   |
| `--space-5`  | 40px | 页面区块间距 | Page    |
| `--space-6`  | 48px | 大区块间距   | Outer   |

### 2.4 关键规则

```
✅ 规则 1：所有 padding / margin / gap 必须是 4 的倍数
✅ 规则 2：组内间距 < 组间间距（至少 1.5× 比例）
✅ 规则 3：默认使用 Block(16px) 作为独立元素间距
✅ 规则 4：默认使用 Section(24px) 作为分组间距
✅ 规则 5：默认使用 Page(40px) 作为页面外边距
❌ 禁止：出现 13px、19px、27px 等非常规值
```

---

## 三、三层 Token 架构

### 3.1 架构总览

```
┌─────────────────────────────────────────────────┐
│  Tier 3: Component Tokens                       │  ← 组件级（可选）
│  button.padding, card.gap, input.height        │
├─────────────────────────────────────────────────┤
│  Tier 2: Semantic Tokens                        │  ← 语义层（主要使用）
│  --space-sm/md/lg, --radius-sm/card/hero       │
│  --text-primary/secondary, --bg-card-overlay   │
├─────────────────────────────────────────────────┤
│  Tier 1: Primitive Tokens                       │  ← 原始值层
│  --s-4: 4rpx, --s-8: 8rpx, --s-16: 16rpx      │
│  --c-blue-500: #7b8cf7, --c-gray-900: #1d222b  │
└─────────────────────────────────────────────────┘
```

### 3.2 当前 Token 层级分析

| 层级          | 当前状态        | 缺失项                       |
| ------------- | --------------- | ---------------------------- |
| **Primitive** | ⚠️ 部分缺失     | 缺少 `--s-4` 4rpx/px 档位    |
| **Semantic**  | ✅ 完整         | 无                           |
| **Component** | ⚠️ 分散在各页面 | 无统一 component tokens 文件 |

### 3.3 建议补充的 Primitive Tokens

```css
/* styles/tokens.wxss - 新增 */
page,
:host {
  /* ========== 间距原始值（补全 4rpx 起步）========== */
  --s-4: 4rpx; /* 新增：发丝间隙 */
  --s-8: 8rpx; /* 新增：对应 --space-1 */
  --s-12: 12rpx; /* 新增：紧凑场景 */
  --s-16: 16rpx; /* 对应 --space-2 */
  --s-20: 20rpx; /* 新增：按钮高度细分 */
  --s-24: 24rpx; /* 对应 --space-3 */
  --s-28: 28rpx; /* 新增：特殊场景 */
  --s-32: 32rpx; /* 对应 --space-4 */
  --s-40: 40rpx; /* 对应 --space-5 */
  --s-48: 48rpx; /* 对应 --space-6 */
  --s-56: 56rpx; /* 对应 --space-7 */
  --s-64: 64rpx; /* 对应 --space-8 */
  --s-80: 80rpx; /* 对应 --space-9 */
  --s-96: 96rpx; /* 对应 --space-10 */
  --s-112: 112rpx; /* 对应 --space-11 */

  /* ========== 字号原始值（补全 20rpx 档位）========== */
  --fs-20: 20rpx; /* 新增：辅助注释 */
  --fs-22: 22rpx; /* 对应 --font-xs */
  --fs-24: 24rpx; /* 新增：次级文字 */
  --fs-26: 26rpx; /* 新增：标签文字 */
  --fs-28: 28rpx; /* 对应 --font-body */
  --fs-30: 30rpx; /* 新增：分区标题 */
  --fs-32: 32rpx; /* 对应 --font-h3 */
  --fs-36: 36rpx; /* 新增：数据强调 */
  --fs-40: 40rpx; /* 新增：大标题 */
  --fs-44: 44rpx; /* 对应 --font-h2 */
  --fs-52: 52rpx; /* 新增：双卡数字 */
  --fs-64: 64rpx; /* 新增：完成动画 */
  --fs-72: 72rpx; /* 对应 --font-h1 */
  --fs-96: 96rpx; /* 对应空状态图标 */
}
```

---

## 四、对齐规则细则

### 4.1 水平对齐规则

#### 规则 H1：内容左边缘对齐

```
所有卡片、列表项、表单组的左边缘应对齐到同一垂直线。

page padding: 24rpx（左右统一）
card padding: 32rpx（内部统一）
list padding: 24rpx 32rpx（左右统一）
```

**当前状态验证：**

```css
/* ✅ 正确：统一 page padding */
.page {
  padding: 24rpx;
}

/* ✅ 正确：统一 card padding */
.card {
  padding: 32rpx;
}

/* ⚠️ 待检查：各页面 padding 是否一致 */
```

#### 规则 H2：多列等宽对齐

```
使用 grid 或 flex:1 确保多列等宽，避免手动计算宽度。

❌ 错误：
.goods-row { width: 33.33%; }  /* 浮点精度问题 */

✅ 正确：
.goods-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}
```

#### 规则 H3：按钮组对齐

```
同一操作组的按钮，高度必须一致，基线对齐。

.action-btns {
  display: flex;
  gap: 16rpx;
  align-items: center;  /* 垂直居中 */
}
```

### 4.2 垂直对齐规则

#### 规则 V1：行内元素基线对齐

```
图标 + 文字的組合，图标应光学居中（非几何居中）。

.icon-text {
  display: flex;
  align-items: center;  /* 垂直居中 */
  gap: 8rpx;
}

/* 图标高度与文字行高匹配 */
.icon { font-size: 28rpx; line-height: 1; }
.text  { font-size: 28rpx; line-height: 1.5; }
```

#### 规则 V2：卡片内元素间距层级

```
卡片内部间距遵循「内紧外松」原则：

.card {
  padding: 32rpx;           /* 外边距：40rpx */
}
.card-section {
  margin-bottom: 24rpx;     /* 分区间距 */
}
.card-item {
  padding: 16rpx 0;         /* 行内间距 */
}
```

**比例关系：** 行内间距(16) < 分区间距(24) < 卡片外边距(40) ≈ 2.5×

#### 规则 V3：表单字段对齐

```
label + input 组合，label 右边缘与下一行 input 左边缘对齐。

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.form-label {
  width: 160rpx;  /* 固定宽度，确保对齐 */
  text-align: right;
  padding-right: 16rpx;
}
.form-input {
  flex: 1;
}
```

### 4.3 边缘对齐规则

#### 规则 E1：卡片与页面边缘

```
卡片左右 margin 应等于 page padding，形成「嵌套对齐」。

.page { padding: 24rpx; }
.card { margin: 0; }  /* card 直接贴 page padding 边缘 */
```

**当前项目验证：**

```css
/* app.wxss */
.page {
  padding: 24rpx;
} /* ✅ */

/* index/index.wxss */
.home {
  padding: 24rpx 32rpx;
} /* ⚠️ 左右不一致 */
/* 建议统一为 padding: 24rpx; */
```

#### 规则 E2：搜索框与卡片对齐

```
搜索框宽度应与下方卡片宽度对齐（或略宽）。

.search-wrap {
  width: 100%;  /* 与 card 等宽 */
}
.card {
  width: 100%;
  margin-top: 24rpx;
}
```

#### 规则 E3：Bottom Dock 对齐

```
结算栏/批量栏与 page padding 对齐，形成连续边缘。

.footer-bar {
  left: 24rpx;    /* 与 page padding 一致 */
  right: 24rpx;
}
.tabbar {
  left: 24rpx;    /* 与 page padding 一致 */
  right: 24rpx;
}
```

---

## 五、网格系统设计

### 5.1 小程序端网格

```
┌─────────────────────────────────────────┐
│  page padding: 24rpx                    │
│  ┌───────────────────────────────────┐  │
│  │  card padding: 32rpx              │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐      │  │
│  │  │ item│  │ item│  │ item│  gap │  │
│  │  │ 280 │  │ 280 │  │ 280 │ 24  │  │
│  │  └─────┘  └─────┘  └─────┘      │  │
│  │                                   │  │
│  │  [销售额 Hero 卡]                  │  │
│  │  padding: 40rpx 32rpx             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│  tabbar: left/right 24rpx              │
└─────────────────────────────────────────┘

可用宽度 = 750 - 24×2 = 702rpx
三列布局 = (702 - 24×2) / 3 ≈ 218rpx/列
```

### 5.2 Web 端网格

```
┌──────────┬─────────────────────────────────────┐
│ sidebar  │  main padding: 26px 32px           │
│ 220px    │  ┌─────────────────────────────┐   │
│          │  │ card padding: 22px         │   │
│ nav item │  │ ┌────┐ ┌────┐ ┌────┐     │   │
│ 11px 16px│  │ │    │ │    │ │    │ gap  │   │
│ margin   │  │ 46px │ 46px │ 46px │14px │   │
│ 2px 12px │  │     │     │     │     │   │
│          │  └────┘ └────┘ └────┘      │   │
│          │                             │   │
│          │  [Stat Grid]                │   │
│          │  grid-template-columns:     │   │
│          │  repeat(auto-fit, minmax(210,1fr)) │
│          │  gap: 14px                  │   │
│          │                             │   │
│          │  max-width: 1280px          │   │
│          │  margin: 0 auto             │   │
│          │                             │   │
│          │  @media ≤768px:             │   │
│          │  padding: 18px 16px         │   │
│          └─────────────────────────────┘   │
└──────────┴─────────────────────────────────────┘
```

---

## 六、视觉对齐审核清单

### 6.1 间距审核

```bash
# 检查非 4 倍数间距（小程序端）
grep -rn "[0-9][0-9]*rpx" *.wxss pages/**/**/*.wxss | \
  grep -vE '(0rpx|4rpx|8rpx|12rpx|16rpx|20rpx|24rpx|28rpx|32rpx|36rpx|40rpx|44rpx|48rpx|52rpx|56rpx|60rpx|64rpx|68rpx|72rpx|76rpx|80rpx|84rpx|88rpx|92rpx|96rpx|100rpx|104rpx|108rpx|112rpx|116rpx|120rpx)'

# 检查非 4 倍数间距（Web 端）
grep -rn "[0-9][0-9]*px" style.css | \
  grep -vE '(0px|4px|8px|12px|16px|20px|24px|28px|32px|36px|40px|44px|48px|52px|56px|60px|64px|68px|72px|76px|80px|84px|88px|92px|96px)'
```

### 6.2 对齐审核

| 审核项          | 检查方法                          | 预期结果                    |
| --------------- | --------------------------------- | --------------------------- |
| 卡片左边缘对齐  | 查看各页面 .card margin-left      | 均为 0（继承 page padding） |
| 搜索框宽度      | 检查 .search-wrap width           | 100% 或 calc(100% + X)      |
| 按钮组高度      | 比较同组按钮 padding-top/bottom   | 相同                        |
| 表单 label 宽度 | 检查 .form-label width            | 同一页面内一致              |
| 图标文字对齐    | 检查 icon + text 组合 align-items | center                      |
| 结算栏位置      | 检查 .footer-bar left/right       | 与 page padding 一致        |
| TabBar 位置     | 检查 .tabbar left/right           | 与 page padding 一致        |

### 6.3 字号层级审核

| Token     | 值    | 当前使用率       | 缺口         |
| --------- | ----- | ---------------- | ------------ |
| `--fs-20` | 20rpx | ❌ 未定义        | 需新增       |
| `--fs-22` | 22rpx | ✅ `--font-xs`   | 无           |
| `--fs-24` | 24rpx | ⚠️ 部分硬编码    | 建议用 Token |
| `--fs-26` | 26rpx | ⚠️ 部分硬编码    | 建议用 Token |
| `--fs-28` | 28rpx | ✅ `--font-body` | 无           |
| `--fs-30` | 30rpx | ⚠️ 部分硬编码    | 建议用 Token |
| `--fs-32` | 32rpx | ✅ `--font-h3`   | 无           |
| `--fs-36` | 36rpx | ⚠️ 部分硬编码    | 建议用 Token |
| `--fs-40` | 40rpx | ⚠️ 部分硬编码    | 建议用 Token |
| `--fs-44` | 44rpx | ✅ `--font-h2`   | 无           |
| `--fs-52` | 52rpx | ⚠️ 硬编码        | 建议用 Token |
| `--fs-64` | 64rpx | ⚠️ 硬编码        | 建议用 Token |
| `--fs-72` | 72rpx | ✅ `--font-h1`   | 无           |
| `--fs-96` | 96rpx | ⚠️ 硬编码        | 建议用 Token |

---

## 七、对齐问题修复清单

### 7.1 P0：间距非 4 倍数（来自 UI-AUDIT-REPORT）

已识别 17 处，修复后可达 95%+ 达标率。

**已确认修复项：**

```
app.wxss L326:    margin-right: 12rpx → 16rpx ✅
app.wxss L447:    margin-bottom: 12rpx → 16rpx ✅
app.wxss L519:    margin-bottom: 12rpx → 16rpx ✅
billing L22:      margin-right: 12rpx → 16rpx ✅
billing L484:     margin-top: 12rpx → 16rpx ✅
customer/list L202: margin-left: 12rpx → 16rpx ✅
goods L131:       margin-right: 12rpx → 16rpx ✅
order-detail L46: margin-top: 12rpx → 16rpx ✅
order-detail L69: margin-top: 10rpx → 8rpx ✅
order-detail L75: margin-left: 12rpx → 16rpx ✅
order-detail L86: padding-top: 22rpx → 24rpx ✅
order-detail L116: margin: 12rpx 0 → 16rpx 0 ✅
order-detail L150: margin-top: 6rpx → 8rpx ✅
printer-pair L35: margin-bottom: 12rpx → 16rpx ✅
printer-pair L178: margin-bottom: 12rpx → 16rpx ✅
printer-pair L361: margin-bottom: 12rpx → 16rpx ✅
store L191:       padding: 12rpx 0 → 16rpx 0 ✅
```

### 7.2 P1：圆角嵌套不一致

| 位置                        | 当前值 | 建议值                     | 外层容器            |
| --------------------------- | ------ | -------------------------- | ------------------- |
| goods L85 `.goods-img`      | 20rpx  | `var(--radius-sm)` = 16rpx | `.goods-card` 36rpx |
| billing L46 `.goods-img`    | 20rpx  | `var(--radius-sm)` = 16rpx | `.goods-row` 36rpx  |
| goods-edit L27 `.img-thumb` | 20rpx  | `var(--radius-sm)` = 16rpx | 140×140 独立        |
| goods-edit L51 `.img-add`   | 20rpx  | `var(--radius-sm)` = 16rpx | 140×140 独立        |
| welcome L115 `.guide-icon`  | 20rpx  | `var(--radius-sm)` = 16rpx | `.wc-guide` 36rpx   |

**嵌套规则：**

```
外层圆角 ≥ 内层圆角
36rpx (card) → 16rpx (img) ✅ 比例 2.25:1
44rpx (hero) → 16rpx (img) ✅ 比例 2.75:1
```

### 7.3 P1：字号未走 Token

| 文件               | 当前值 | 建议 Token            |
| ------------------ | ------ | --------------------- |
| goods-edit L196    | 27rpx  | `--font-body` = 28rpx |
| index L162         | 25rpx  | `--font-xs` = 22rpx   |
| goods L54          | 23rpx  | `--font-xs` = 22rpx   |
| welcome L130       | 23rpx  | `--font-xs` = 22rpx   |
| custom-confirm L43 | 34rpx  | `--font-h3` = 32rpx   |
| order-detail L89   | 36rpx  | `--font-h3` = 32rpx   |
| billing L487       | 60rpx  | `--font-h1` = 72rpx   |
| category L22       | 38rpx  | `--font-h2` = 44rpx   |
| store L426         | 34rpx  | `--font-h3` = 32rpx   |

---

## 八、对齐工具链建议

### 8.1 自动化审计脚本

```javascript
// scripts/audit-alignment.js
const fs = require('fs');
const path = require('path');

const BASE_UNIT = 4; // rpx

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // 检查间距值
  const spacingRegex = /(?:margin|padding|gap|top|bottom|left|right):\s*([0-9]+)rpx/g;
  let match;
  while ((match = spacingRegex.exec(content)) !== null) {
    const val = parseInt(match[1]);
    if (val > 0 && val % BASE_UNIT !== 0) {
      issues.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        value: `${val}rpx`,
        suggestion: `${Math.round(val / BASE_UNIT) * BASE_UNIT}rpx`
      });
    }
  }

  // 检查字号值
  const fontRegex = /font-size:\s*([0-9]+)rpx/g;
  while ((match = fontRegex.exec(content)) !== null) {
    const val = parseInt(match[1]);
    const validSizes = [20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 80, 96];
    if (!validSizes.includes(val)) {
      issues.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        value: `${val}rpx`,
        suggestion: '使用 Token 或最近的标准值'
      });
    }
  }

  return issues;
}

// 运行审计
const wxssFiles = [
  'app.wxss',
  'styles/tokens.wxss',
  ...glob.sync('pages/**/*.wxss'),
  ...glob.sync('components/**/**/*.wxss')
];

let totalIssues = 0;
for (const file of wxssFiles) {
  if (fs.existsSync(file)) {
    const issues = auditFile(file);
    totalIssues += issues.length;
    issues.forEach((i) => console.log(`${i.file}:${i.line} ${i.value} → ${i.suggestion}`));
  }
}

console.log(`\n总计发现 ${totalIssues} 处对齐问题`);
process.exit(totalIssues > 0 ? 1 : 0);
```

### 8.2 ESLint 规则扩展

```javascript
// .eslintrc.js 新增自定义规则
module.exports = {
  rules: {
    // 检查 WXSS 中的非 4 倍数间距
    'no-hardcoded-spacing': [
      'error',
      {
        base: 4,
        properties: ['margin', 'padding', 'gap', 'top', 'bottom', 'left', 'right'],
        units: ['rpx', 'px']
      }
    ],
    // 检查字号是否使用 Token
    'use-token-font-size': [
      'error',
      {
        tokens: ['--font-xs', '--font-body', '--font-h3', '--font-h2', '--font-h1'],
        allowValues: [20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 80, 96]
      }
    ]
  }
};
```

### 8.3 Prettier 配置强化

```json
// .prettierrc
{
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "proseWrap": "always",
  "overrides": [
    {
      "files": "*.wxss",
      "options": {
        "singleQuote": false
      }
    }
  ]
}
```

---

## 九、对齐规范速查卡

### 9.1 间距速查

```
Micro (4-8rpx):   icon-gap, chip-padding, tight-inline
Tight (8-16rpx):  button-padding, input-padding, row-gap
Default (16-24rpx): card-padding, list-row, section-gap
Section (24-32rpx): form-group, card-margin, page-section
Page (32-48rpx):  outer-padding, container-gap
Outer (48-64rpx): hero-padding, special-spacing
```

### 9.2 圆角速查

```
sm (16rpx):    按钮、输入框内部件、小图标
md (24rpx):    输入框、标签、segmented control
card (36rpx):  功能卡、列表项、商品卡
hero (44rpx):  销售额卡、登录面板、弹窗
pill (999rpx): 按钮、标签、胶囊
```

### 9.3 字号速查

```
xs (22rpx):    标签、注释、辅助文字
body (28rpx):  正文、输入框
h3 (32rpx):    卡片标题、小标题
h2 (44rpx):    页面主标题
h1 (72rpx):    数据突出显示（销售额）
```

### 9.4 行高速查

```
tight (1.2):   大字号标题（h1/h2）
normal (1.5):  正文（body）
relaxed (1.7): 表单描述、辅助文字
```

---

## 十、参考对标汇总

| 项目                                         | Stars | 核心借鉴点                                                           |
| -------------------------------------------- | ----- | -------------------------------------------------------------------- |
| **IBM Carbon 2x Grid**                       | -     | 16 列响应式网格、hybrid grid、decision tree                          |
| **GitHub Primer**                            | 16k+  | 三层 Token 架构（primitive→semantic→component）、DESIGN_TOKENS_GUIDE |
| **TDesign**                                  | 1689  | CSS Variables 全量 token 化、--td-spacer-* 命名                      |
| **Apple HIG**                                | -     | 4pt 基准网格、optical centering、hit area 44×44pt                    |
| **USWDS**                                    | -     | 8px 倍数间距、12 列网格、spacing unit system                         |
| **peer-design-system**                       | -     | SPACING.md 速查卡、three alignment rules                             |
| **google-labs-code/design.md**               | -     | MACHINE-READABLE tokens + HUMAN-READABLE prose                       |
| **Jaywalker-not-a-whitewalker/DesignSystem** | -     | 8pt grid 强制校验、DESIGN AUDIT 报告格式                             |
| **soulcore-dev/soul-design-md**              | -     | Progressive tracking、fluid clamp scale                              |
| **microsoft/fluentui**                       | 20k+  | Token 优先原则（禁止硬编码）                                         |

---

## 附录：快速修复命令

```bash
# 一键修复 P0 间距问题（小程序端）
find pages -name "*.wxss" -exec sed -i '' 's/margin-right: 12rpx/margin-right: 16rpx/g; s/margin-bottom: 12rpx/margin-bottom: 16rpx/g; s/margin-left: 12rpx/margin-left: 16rpx/g; s/margin-top: 12rpx/margin-top: 16rpx/g; s/padding: 12rpx 0/padding: 16rpx 0/g; s/margin: 12rpx 0/margin: 16rpx 0/g; s/padding-top: 22rpx/padding-top: 24rpx/g; s/margin-top: 10rpx/margin-top: 8rpx/g; s/margin-top: 6rpx/margin-top: 8rpx/g' {} \;

# 一键修复 P0 圆角问题
find pages -name "*.wxss" -exec sed -i '' 's/border-radius: 20rpx/var(--radius-sm)/g' {} \;

# 一键修复 P0 字号问题
find pages -name "*.wxss" -exec sed -i '' 's/font-size: 27rpx/var(--font-body)/g; s/font-size: 25rpx/var(--font-xs)/g; s/font-size: 23rpx/var(--font-xs)/g' {} \;

# 验证修复结果
grep -rn "[0-9][0-9]*rpx" *.wxss pages/**/**/*.wxss | grep -vE '(0rpx|4rpx|8rpx|12rpx|16rpx|20rpx|24rpx|28rpx|32rpx|36rpx|40rpx|44rpx|48rpx|52rpx|56rpx|60rpx|64rpx|68rpx|72rpx|76rpx|80rpx|84rpx|88rpx|92rpx|96rpx|100rpx|104rpx|108rpx|112rpx|var\(|999rpx)'
```

---

_视觉对齐方案 v1.0 | 2026-10-27_  
_参考：IBM Carbon 2x Grid, GitHub Primer, TDesign, Apple HIG, USWDS, peer-design-system, google/design.md_
