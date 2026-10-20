# 裁间小程序 UI 优化方案文档

> 版本：v1.0  
> 日期：2026-10-20  
> 范围：全量功能页 + 组件  
> 设计基调：Glassmorphism × Soft UI（蓝紫主色 #7b8cf7 + 暖橙点缀 #f2a57c）

---

## 一、整体评估

### ✅ 已做得好的部分
- Design Token 体系完善（`tokens.wxss`），颜色/圆角/间距/阴影/动效统一
- 玻璃拟态五档分层清晰：Wash / Standard / Dense / Hero / Overlay
- 无障碍降级覆盖完整（`prefers-reduced-transparency` / `motion` / `contrast`）
- 骨架屏、空状态、加载态等全链路覆盖
- 自定义 TabBar 悬浮胶囊设计有辨识度

### ⚠️ 主要问题归类
| 类别 | 数量 | 说明 |
|------|------|------|
| 功能性 Bug（遮挡/错位） | 4 处 | 影响正常使用，需立即修复 |
| 一致性问题 | 8 处 | 跨页面风格不统一，降低专业感 |
| 交互体验缺陷 | 6 处 | 缺少反馈、操作歧义 |
| 无障碍/性能隐患 | 3 处 | 低端设备兼容性 |
| 代码维护成本 | 2 处 | 重复样式未提取 |

---

## 二、优先级 P0 — 功能性 Bug（需立即修复）

### Bug-01：分类页新增栏被 TabBar 遮挡

**位置：** `pages/category/category.wxss` L64

**问题：** `.add-card-fixed` 设置 `bottom: 0`，而 TabBar 悬浮于 `bottom: calc(16rpx + env(...))`，z-index=100，导致新增栏被遮挡。

**影响：** 用户无法输入分类名称。

**修复方案：**
```css
/* pages/category/category.wxss */
.add-card-fixed {
  /* 旧 */
  bottom: 0;
  z-index: 50;
  /* 新 */
  bottom: calc(124rpx + env(safe-area-inset-bottom)); /* 108rpx栏高 + 16rpx间距 */
  z-index: 101; /* 高于 TabBar */
}
```

---

### Bug-02：开单页结算栏与 TabBar 存在 16rpx 缝隙

**位置：** `pages/billing/billing.wxss` L388

**问题：** `footer-bar` 设置 `bottom: calc(140rpx + ...)`，但 TabBar 实际占用高度为 108rpx（栏高）+ 16rpx（间距）= 124rpx，结算栏高出 16rpx，视觉上产生断裂。

**修复方案：**
```css
/* pages/billing/billing.wxss */
.footer-bar {
  /* 旧 */
  bottom: calc(140rpx + env(safe-area-inset-bottom));
  /* 新 */
  bottom: calc(124rpx + env(safe-area-inset-bottom));
}
```

---

### Bug-03：商品页 FAB 与 TabBar "开单"按钮功能重叠

**位置：** `pages/goods/goods.wxml` L89

**问题：** TabBar 已有凸起"开单"大圆钮，商品页仍存在独立的 `fab`（悬浮加号），用户不清楚应点哪个入口，语义混乱。

**修复方案（二选一）：**

**方案 A（推荐）：** 删除商品页 FAB，统一从 TabBar "开单"入口下单，商品管理在卡片内通过"编辑"+"上架/下架"操作。

**方案 B：** 保留 FAB，但改为"新增商品"，使用不同图标和标签区分语义：
```xml
<!-- pages/goods/goods.wxml -->
<view class="fab fab-goods" bindtap="goAdd">
  <view class="icon icon-plus"></view>
  <view class="fab-label">新商品</view>
</view>
```
```css
/* pages/goods/goods.wxss */
.fab-goods {
  bottom: calc(160rpx + env(safe-area-inset-bottom)); /* 高于 TabBar */
}
.fab-label {
  position: absolute;
  bottom: -24rpx;
  font-size: 20rpx;
  color: var(--primary-dark);
  white-space: nowrap;
}
```

---

### Bug-04：打印机页扫描中无动态反馈

**位置：** `pages/printer-pair/printer-pair.wxss` L108

**问题：** 扫描状态下按钮变为 `.btn-warn` 样式，但无任何动画，用户无法确认是否正在搜索。

**修复方案：** 添加脉冲动画
```css
/* pages/printer-pair/printer-pair.wxss */
@keyframes scan-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(214, 154, 60, 0.4); }
  50% { box-shadow: 0 0 0 12rpx rgba(214, 154, 60, 0); }
}
.actions .btn-warn.scanning {
  animation: scan-pulse 1.2s ease infinite;
}
```
```xml
<!-- pages/printer-pair/printer-pair.wxml -->
<button wx:if="{{scanning}}" class="btn btn-warn scanning" bindtap="onStopScan">
  停止扫描
</button>
```

---

## 三、优先级 P1 — 一致性问题

### Cons-01：搜索框缺少清除按钮（跨页面统一修复）

**影响页面：** `goods`、`orders`、`billing`、`category`

**现状：** 仅 `customer/list` 有清除按钮（`search-clear`），其余页面用户需手动全选删除。

**修复方案：** 在 `app.wxss` 统一添加清除按钮样式，各页按需启用。

```css
/* app.wxss */
.search-clear {
  flex-shrink: 0;
  color: var(--text-3);
  font-size: 32rpx;
  line-height: 1;
  padding: 0 12rpx;
  transition: color var(--duration-fast) var(--ease-out);
}
.search-clear:active {
  color: var(--text-2);
}
```

各页 WXML 补充清除按钮（以商品页为例）：
```xml
<view class="search-input-wrap">
  <view class="icon icon-search search-icon"></view>
  <input class="search-input" placeholder="搜索商品名称" value="{{keyword}}"
         bindinput="onKeywordInput" bindconfirm="handleSearch" confirm-type="search" />
  <view class="search-clear" wx:if="{{keyword}}" bindtap="clearKeyword">×</view>
</view>
```

---

### Cons-02：复制操作缺少 Toast 反馈

**影响位置：** `pages/store/store.wxml` L22（店铺码复制）

**现状：** 点击复制后无视觉/触觉反馈，用户不确定是否成功。

**修复方案：** 在 JS 的 `handleCopyCode` 中添加 Toast：
```javascript
handleCopyCode() {
  wx.setClipboardData({
    data: this.data.store.bind_code,
    success: () => {
      wx.showToast({ title: '店铺码已复制', icon: 'success', duration: 1500 });
    }
  });
}
```

---

### Cons-03：底部安全区计算散乱

**影响页面：** 所有含固定底部元素的页面（`goods`、`orders`、`billing`、`category`、`customer/list`）

**现状：** 各页面自行硬编码 `calc(xxx rpx + env(safe-area-inset-bottom))`，数值不统一。

**修复方案：** 在 `tokens.wxss` 新增统一 token：
```css
/* styles/tokens.wxss */
:host, page {
  /* 新增 */
  --space-tabbar-bottom: 124rpx; /* 108rpx栏高 + 16rpx间距 */
  --space-fab-bottom: 160rpx;    /* FAB 距底部安全区的额外间距 */
  --space-fixed-bottom: 140rpx;  /* 批量操作栏等固定栏距底部安全区的间距 */
}
```

各页统一引用：
```css
/* pages/goods/goods.wxss */
.fab {
  bottom: calc(var(--space-fab-bottom, 160rpx) + env(safe-area-inset-bottom));
}
.batch-bar {
  bottom: calc(var(--space-fixed-bottom, 140rpx) + env(safe-area-inset-bottom));
}

/* pages/index/index.wxss */
.page-bottom-space {
  height: calc(var(--space-tabbar-bottom, 124rpx) + env(safe-area-inset-bottom) + 40rpx);
}
```

---

### Cons-04：性别选择器样式重复

**出现位置：**
- `pages/billing/billing.wxss` L322（开单添加会员弹窗）
- `pages/customer/list.wxss` L130（列表添加会员弹窗）
- `pages/customer/detail.wxss` L149（详情编辑弹窗）

**修复方案：** 提取为公共样式块，统一放到 `app.wxss`：
```css
/* app.wxss — 新增通用性别选择器样式 */
.gender-options {
  display: flex;
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
}
.gender-options.inline {
  flex: 0 0 230rpx;
  margin-left: 20rpx;
}
.gender-option {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: var(--text-2);
  background: transparent;
  transition: all var(--duration-fast) var(--ease-out);
}
.gender-option + .gender-option {
  border-left: 1rpx solid var(--hairline);
}
.gender-option.active {
  color: var(--primary-dark);
  background: var(--primary-tint);
  font-weight: bold;
}
/* 无障碍降级 */
@media (prefers-reduced-transparency: reduce) {
  .gender-options { background: #f4f6fa; }
}
```
各页面 wxss 删除重复定义。

---

### Cons-05：状态标签样式依赖数据层注入

**影响页面：** `order-detail`、`customer/detail`

**问题：** 两处均通过数据层动态绑定 class（如 `statusClass`、`status-pending`），但样式未在各自 wxss 中显式声明，若数据异常或 class 名拼写错误则样式静默丢失。

**修复方案：** 在两个页面的 wxss 中显式声明状态样式：

```css
/* pages/order-detail/order-detail.wxss */
.status-pending  { background: var(--warning-tint);  color: var(--warning); }
.status-paid     { background: var(--success-tint);  color: var(--success); }
.status-done     { background: var(--info-tint);     color: var(--info); }
.status-cancelled{ background: var(--bg-subtle);     color: var(--text-3); }
.status-refunded { background: var(--danger-tint);   color: var(--danger); }
```

```css
/* pages/customer/detail.wxss */
.status-pending  { color: var(--warning); }
.status-paid     { color: var(--success); }
.status-done     { color: var(--info); }
.status-cancelled{ color: var(--text-3); }
.status-refunded { color: var(--danger); }
```

---

### Cons-06：首页"经营看板"标题字号过大

**位置：** `pages/index/index.wxss` L16

**现状：** `.head-title { font-size: 52rpx }` 与下方销售额数字（84rpx）竞争视觉焦点。

**修复方案：**
```css
.head-title {
  font-size: 36rpx; /* 原 52rpx 降至 36rpx */
  letter-spacing: 1rpx; /* 原 2rpx */
}
```

---

### Cons-07：订单金额视觉层级不够突出

**位置：** `pages/orders/orders.wxss` L87

**现状：** 订单金额 `.order-amount { font-size: 34rpx }`，与商品页价格（30rpx）差异不大。

**修复方案：** 提升订单金额字号，强化关键数据：
```css
.order-amount {
  font-size: 40rpx; /* 原 34rpx */
  font-weight: 800;
}
```

---

### Cons-08：商品图片占位符无品牌色渐变

**位置：** `pages/goods/goods.wxss` L95、`pages/billing/billing.wxss` L46

**现状：** `.img-placeholder` 和 `.goods-img-empty` 仅显示灰色图标，弱网/无图时视觉空洞。

**修复方案：** 为占位图添加与正常图片相同的渐变背景：
```css
.img-placeholder,
.goods-img-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef0f9 0%, #f7f4f0 100%);
  border: 1rpx solid var(--glass-border);
}
.img-placeholder .icon,
.goods-img-empty .icon {
  font-size: 56rpx;
  color: var(--text-3);
  opacity: 0.6;
}
```

---

## 四、优先级 P2 — 交互体验缺陷

### UX-01：密码输入框缺少可见性切换

**位置：** `pages/login/login.wxml`、`pages/register/register.wxml`

**问题：** 密码为 `password` 类型，用户无法核对输入内容，尤其在公共场合。

**修复方案：**
```xml
<!-- login.wxml — 密码字段 -->
<view class="field {{focusField === 'password' ? 'is-focus' : ''}} {{passwordError ? 'is-error' : ''}}">
  <view class="field-label">密码</view>
  <input class="field-input" placeholder="请输入密码"
         password="{{showPassword === false}}"
         value="{{password}}"
         bindinput="onPasswordInput" bindfocus="onFocus" bindblur="onBlur" data-name="password"
         placeholder-class="ph" />
  <view class="pwd-toggle" bindtap="togglePassword">
    <view class="icon {{showPassword ? 'icon-eye' : 'icon-eye-off'}}"></view>
  </view>
</view>
```
```css
/* login.wxss */
.pwd-toggle {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  font-size: 36rpx;
  padding: 8rpx;
}
```
> 注：需先在 `icons.wxss` 中添加 `icon-eye` 和 `icon-eye-off` SVG 路径。

---

### UX-02：开单页购物车缺少触觉/视觉重点

**位置：** `pages/billing/billing.wxml` L50-L68

**问题：** 购物车行使用 Standard 玻璃卡（`bg-card` 68%白底），在裁缝店强光环境下可读性不足。

**修复方案：** 购物车改用 Dense 密集层（纯白底），提升对比度：
```css
/* pages/billing/billing.wxss */
.cart-item {
  /* 旧 */
  background: var(--bg-card);
  /* 新 */
  background: #ffffff;
  border-color: var(--border);
}
.step-num {
  font-size: 32rpx; /* 原 28rpx，提升可读性 */
  font-weight: 700;
}
```

---

### UX-03：批量操作栏 z-index 过低

**位置：** `pages/goods/goods.wxss` L227

**问题：** `.batch-bar { z-index: 60 }` 低于 TabBar（z-index: 100），部分安卓机型上可能出现层级穿透。

**修复方案：**
```css
.batch-bar {
  z-index: 101; /* 原 60 */
}
```

---

### UX-04：打印机设备信号强度无颜色区分

**位置：** `pages/printer-pair/printer-pair.wxss` L164

**问题：** 所有设备的信号强度文字统一灰色，用户无法快速判断连接质量。

**修复方案：**
```css
.device-rssi.strong  { color: var(--success); }
.device-rssi.normal  { color: var(--warning); }
.device-rssi.weak    { color: var(--danger); }
```
JS 层根据 RSSI 值动态绑定 class：
```javascript
getRssiClass(rssi) {
  if (rssi >= -60) return 'strong';
  if (rssi >= -80) return 'normal';
  return 'weak';
}
```

---

### UX-05：低库存提醒缺少风险分级

**位置：** `pages/index/index.wxml` L75-L86、`pages/goods/goods.wxml` L64-L66

**问题：** 低库存统一使用红色，未区分"断货"（stock=0）和"预警"（stock<5）两级风险。

**修复方案：**
```css
/* app.wxss — 新增 */
.stock-zero  { color: var(--danger);   font-weight: 800; } /* 断货 */
.stock-low   { color: var(--warning);  font-weight: 700; } /* 预警 */
```
```xml
<!-- goods.wxml -->
<text class="{{item.stock === 0 ? 'stock-zero' : (item.stock < 5 ? 'stock-low' : '')}}">
  库存 {{item.stock}}
</text>
```

---

### UX-06：顾客手机号输入缺少格式校验反馈

**位置：** `pages/billing/billing.wxml` L73-L76

**问题：** 输入 11 位手机号后才显示"添加会员"按钮，但期间无任何提示，用户可能不知道需要输入多少位。

**修复方案：** 增加实时位数提示：
```xml
<input class="field-input phone-input" type="number" placeholder="11 位手机号"
       value="{{customerPhone}}" bindinput="onPhoneInput" placeholder-class="ph" maxlength="11" />
<view class="phone-count">{{customerPhone.length}} / 11</view>
```
```css
.phone-count {
  font-size: 22rpx;
  color: var(--text-3);
  text-align: right;
  margin-top: 6rpx;
  transition: color var(--duration-fast);
}
.phone-count.done { color: var(--success); }
```

---

## 五、优先级 P3 — 设计一致性 & 代码质量

### QM-01：打印机页未使用 Glass 效果

**位置：** `pages/printer-pair/printer-pair.wxss`

**问题：** 状态卡和说明卡使用纯白底（`var(--bg-card)`），与其他页面的半透明玻璃质感不统一。

**修复方案：** 为 `.status-card` 和 `.help` 添加 backdrop-filter：
```css
.status-card,
.help {
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  backdrop-filter: blur(20px) saturate(150%);
}
```
无障碍降级中补充 `backdrop-filter: none` 回退。

---

### QM-02：自定义确认弹窗确认按钮颜色不可配置

**位置：** `components/custom-confirm/custom-confirm.wxss` L78-L83

**问题：** 确认按钮固定使用红色渐变，但普通确认场景（如"确定删除"以外的操作）不需要红色警示。

**修复方案：** 增加 `type` 属性支持，区分 primary / danger 两种样式：
```xml
<!-- 调用方传入 type="primary" 或 type="danger"（默认 danger） -->
<custom-confirm title="提示" content="确定要退出店铺吗？" type="danger" ... />
<custom-confirm title="提示" content="操作已完成" type="primary" ... />
```
```css
/* custom-confirm.wxss */
.c-confirm-btn-confirm {
  background: linear-gradient(135deg, #e87872 0%, #d95750 100%); /* danger 默认 */
}
.c-confirm-btn-confirm.type-primary {
  background: linear-gradient(135deg, #8a9bf9 0%, #b3a1fb 100%);
}
```

---

### QM-03：首页趋势图柱宽固定，小屏过密

**位置：** `pages/index/index.wxss` L207

**问题：** `.trend-bar { width: 30rpx }` 固定宽度，7 列在小屏（如 iPhone SE）上排列过密。

**修复方案：**
```css
.trend-col {
  flex: 1;
  min-width: 0; /* 允许收缩 */
}
.trend-bar {
  width: 100%; /* 填满列宽 */
  max-width: 48rpx; /* 限制最大宽度 */
  min-width: 24rpx; /* 限制最小宽度 */
}
```

---

### QM-04：商品页分类入口图标语义不明确

**位置：** `pages/goods/goods.wxml` L6

**问题：** 使用 `icon-menu`（三条横杠）作为分类入口，语义偏向"菜单"而非"分类"。

**修复方案：** 替换为更明确的图标：
```xml
<!-- 旧 -->
<view class="icon icon-menu"></view>
<!-- 新 -->
<view class="icon icon-folder"></view>
```

---

### QM-05：店铺页折叠按钮箭头使用 unicode 字符

**位置：** `pages/store/store.wxml` L54

**问题：** 使用 `▾` unicode 字符，字号 20rpx 偏小，在不同字体渲染下可能显示不一致。

**修复方案：** 替换为 icon 组件：
```xml
<!-- 旧 -->
<text class="fold-toggle-arrow">▾</text>
<!-- 新 -->
<view class="icon icon-chevron-down fold-toggle-arrow"></view>
```
若图标集中无此图标，需在 `icons.wxss` 中补充 `icon-chevron-down`。

---

### QM-06：未绑定店铺时缺少引导入口

**位置：** `pages/store/store.wxml`

**问题：** 当 `storeId` 为空时，店铺页主要内容区域为空，用户可能不知道下一步该做什么。

**修复方案：** 增加引导卡片：
```xml
<view wx:else class="guide-card">
  <view class="guide-icon icon icon-store"></view>
  <view class="guide-title">还没有绑定店铺？</view>
  <view class="guide-sub">注册账号后即可创建或加入店铺</view>
  <button class="btn-primary" bindtap="goRegister">去注册</button>
</view>
```

---

## 六、统一 Token 补充建议

在 `styles/tokens.wxss` 中新增以下 token，供全项目统一引用：

```css
/* tokens.wxss 新增内容 */
:host, page {
  /* 安全区间距（统一计算基准） */
  --space-tabbar-height: 108rpx;
  --space-tabbar-gap: 16rpx;
  --space-tabbar-bottom: 124rpx; /* = 108 + 16 */
  --space-fab-bottom: 160rpx;
  --space-fixed-bar-bottom: 140rpx;

  /* 风险分级颜色（低库存等场景） */
  --stock-critical: #e05d57;  /* 断货 */
  --stock-warning: #d69a3c;   /* 预警 */

  /* 信号强度颜色 */
  --rssi-strong: #3bae76;
  --rssi-normal: #d69a3c;
  --rssi-weak: #e05d57;
}
```

---

## 七、修改工作量评估

| 优先级 | 事项数 | 预估工时 | 建议排期 |
|--------|--------|---------|---------|
| P0 功能性 Bug | 4 处 | 1h | 本周热修复 |
| P1 一致性 | 8 处 | 3h | 下周迭代 |
| P2 交互体验 | 6 处 | 4h | 下下周迭代 |
| P3 代码质量 | 6 处 | 2h | 按需排入 |
| **合计** | **24 处** | **~10h** | **约 2 周** |

---

## 八、验收标准

1. **P0 项**：在 iPhone SE（375px 宽）及 Android 低端机（4GB RAM）上逐页测试，无遮挡、无错位
2. **P1 项**：所有页面的搜索框均有清除按钮；所有复制操作均有 Toast；底部固定元素定位统一
3. **P2 项**：密码可见性切换正常；购物车在强光环境下可读；批量操作栏始终浮于最上层
4. **P3 项**：代码审查确认无重复样式；图标语义统一；无障碍降级生效

---

*文档结束*
