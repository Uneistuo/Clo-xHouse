# 🚀 「裁间」小程序端优化方案

> 版本：v1.1 | 日期：2026-10-26  
> 基于：GitHub 优秀项目调研 + 微信官方性能指南 + 项目现状诊断

> **实施状态（2026-10-27）**：开单分页、图片懒加载 + 占位/失败兜底、图片上传前压缩（`utils/api.ts` 统一处理）、15 个页面 ARIA 标签、setData 合并（开单规格选择 3 次 → 1 次）与购物车数量增减路径更新已完成；删除/新增等结构性变更仍使用整数组写入。recycle-view 虚拟列表、分包加载、完整深色模式与 Skyline 迁移均**未开始 / 暂缓**，不计入本轮完成项；实现以当前小程序代码为准。

---

## 一、性能瓶颈诊断

### 1.1 当前已知问题（来自 README + 代码审计）

| 问题                                 | 严重度 | 影响页面                | 根因                          | 状态                                        |
| ------------------------------------ | ------ | ----------------------- | ----------------------------- | ------------------------------------------- |
| 开单页一次拉取 200 条商品            | 🔴 P0  | billing                 | 无分页，全量加载              | ✅ 已分页                                   |
| 商品图片无懒加载占位                 | 🟡 P1  | billing, goods          | 图片组件无 lazy-load          | ✅ 已补齐                                   |
| setData 全量更新购物车               | 🟡 P1  | billing                 | 每次增删改全量 re-render      | ⚠️ 数量增减已改路径更新，结构变更全量       |
| 长列表无虚拟滚动                     | 🟡 P2  | orders, goods, customer | 超过 50 条后滚动卡顿          | ❌ 未开始 / 暂缓                            |
| 背景光晕使用 fixed + radial-gradient | 🟢 P3  | 全局                    | iOS 上 backdrop-filter 重 GPU | 已改用无 blur 方案                          |
| 无分包加载                           | 🟢 P3  | 全局                    | 所有页面在主包，首屏慢        | ⏸ 暂缓（源码约 521KB，远低于 2MB 主包限制） |

### 1.2 性能指标基线（参考微信官方）

| 指标               | 目标值   | 当前状态                 |
| ------------------ | -------- | ------------------------ |
| 冷启动时间         | < 1.5s   | 待测试                   |
| 首屏渲染           | < 2s     | 待测试                   |
| setData 单次数据量 | < 1024KB | 待测试                   |
| WXML 节点总数      | < 1000   | 待测试（开单页可能超标） |
| 主包大小           | < 2MB    | 待测试                   |

---

## 二、P0 优化：长列表虚拟滚动

### 2.1 方案：引入 recycle-view（微信官方）

**适用页面：**

- `pages/billing/billing` — 商品列表（最多 200 条）
- `pages/orders/orders` — 订单列表
- `pages/goods/goods` — 商品管理列表
- `pages/customer/list` — 会员列表

**接入步骤：**

```json
// pages/billing/billing.json
{
  "usingComponents": {
    "recycle-view": "miniprogram-recycle-view/recycle-view",
    "recycle-item": "miniprogram-recycle-view/recycle-item"
  }
}
```

```xml
<!-- pages/billing/billing.wxml -->
<recycle-view
  batch="{{batchSetRecycleData}}"
  id="billing-recycle"
  height="{{windowHeight}}"
  scroll-y
  lower-threshold="100"
  bindscrolltolower="onReachBottom">

  <view slot="before">
    <!-- 搜索框等固定内容 -->
    <view class="search-wrap">...</view>
  </view>

  <recycle-item wx:for="{{recycleList}}" wx:key="id">
    <view class="goods-row" data-id="{{item.__index__}}">
      <!-- 商品卡片内容 -->
    </view>
  </recycle-item>

  <view slot="after">
    <!-- 加载中/没有更多提示 -->
  </view>
</recycle-view>
```

```javascript
// pages/billing/billing.js
const createRecycleContext = require('miniprogram-recycle-view');

Page({
  data: {
    recycleList: [],
    batchSetRecycleData: false
  },

  recycleCtx: null,

  onReady() {
    this.recycleCtx = createRecycleContext({
      id: 'billing-recycle',
      dataKey: 'recycleList',
      page: this,
      itemSize: { width: 698, height: 168 }, // 固定高度
      transformRpx: true
    });
  },

  onLoad() {
    this.loadGoods();
  },

  async loadGoods(reset = true) {
    if (reset) {
      this.data.page = 1;
      this.recycleCtx.clear();
    }
    const data = await api('/api/goods?page=' + this.data.page + '&pageSize=20');
    const newList = (data.list || []).map((g, i) => ({
      id: g.id,
      __index__: this.data.recycleList.length + i,
      ...g
    }));

    this.data.recycleList.push(...newList);
    this.recycleCtx.setData(this.data.recycleList, () => {
      this.setData({ batchSetRecycleData: !this.data.batchSetRecycleData });
    });
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.data.page++;
      this.loadGoods(false);
    }
  }
});
```

### 2.2 备选方案：增量 setData（无需额外依赖）

若不想引入 recycle-view，可使用分页 + 增量 setData：

```javascript
// 分页加载 + 增量追加
async loadGoods() {
  const data = await api(`/api/goods?page=${this.data.page}&pageSize=20`)
  const newItems = data.list.map(g => ({ ...g, _idx: this.data.goodsList.length }))

  // 增量更新：只传输新数据，不触发全量 diff
  this.setData({
    [`goodsList[${this.data.goodsList.length}]`]: newItems,
    hasMore: data.page < data.totalPages,
    loading: false
  })
  this.data.page++
}

// 触底加载更多
onReachBottom() {
  if (this.data.hasMore && !this.data.loading) {
    this.loadGoods()
  }
}
```

### 2.3 方案对比

| 维度       | recycle-view 虚拟列表 | 增量 setData                  |
| ---------- | --------------------- | ----------------------------- |
| 实现复杂度 | 高（需适配 itemSize） | 低                            |
| 性能       | 最优（只渲染可见区）  | 良好（节点数可控）            |
| 依赖       | 需 npm 构建           | 无                            |
| 适用场景   | 商品 > 100 条         | 商品 ≤ 50 条                  |
| 推荐       | billing 页（商品多）  | orders/goods 页（数据量适中） |

---

## 三、P1 优化：setData 性能优化

### 3.1 当前问题

**开单页购物车更新（全量覆盖）：**

```javascript
// ❌ 当前：每次增删改都全量更新整个 cart
this.setData({ cart: newCart });
```

**优化方案（精确路径更新）：**

```javascript
// ✅ 优化：只更新变化的字段
// 增加数量
this.setData({ [`cart[${index}].quantity`]: newQty });

// 删除商品
this.setData({ cart: newCart }); // 删除必须全量（数组结构变化）

// 新增商品
this.setData({ [`cart[${cart.length}]`]: newItem });
```

### 3.2 合并多次 setData

```javascript
// ❌ 当前：分开调用
this.setData({ cart: newCart });
this.setData({ totalAmount: amount });
this.setData({ hasCart: newCart.length > 0 });

// ✅ 优化：合并为一次
this.setData({
  cart: newCart,
  totalAmount: amount,
  hasCart: newCart.length > 0
});
```

### 3.3 后台页面延迟 setData

```javascript
// 页面隐藏时延迟 setData，避免抢占前台渲染资源
onHide() {
  this._isHidden = true
}

onShow() {
  this._isHidden = false
  // 待后台数据同步到前台时再 setData
}

// 使用方式
scheduleDeferredSetData(data) {
  if (this._isHidden) {
    this._pendingData = this._pendingData || []
    this._pendingData.push(data)
  } else {
    this.setData(data)
  }
}
```

---

## 四、P1 优化：图片加载优化

### 4.1 当前状态

已完成：

1. 商品图片 `lazy-load` + 占位图
2. 加载失败兜底（`binderror` 置空 `cover`，退回占位图）
3. 上传前压缩（`utils/api.ts`：长边 > 1200px 或文件 > 800KB 时 `wx.compressImage` 压至质量 80，失败回退原图；后端 base64 与云存储直传两条通道均生效）

### 4.2 优化方案

```xml
<!-- 商品图片：占位图 + 懒加载 + 错误兜底 -->
<image
  class="goods-img"
  src="{{item.image ? resolveImg(item.image) : ''}}"
  mode="aspectFill"
  lazy-load
  binderror="onImgError"
  data-index="{{index}}">
  <!-- 加载中占位 -->
  <view wx:if="{{!item.image}}" class="img-placeholder">
    <view class="icon icon-shirt"></view>
  </view>
</image>
```

```javascript
// 图片加载失败兜底
onImgError(e) {
  const index = e.currentTarget.dataset.index
  this.setData({ [`goodsList[${index}].imageError`]: true })
}

// 图片压缩（上传时）
compressImage(filePath) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        if (info.width > 800 || info.height > 800) {
          wx.compressImage({
            src: filePath,
            quality: 80,
            success: (res) => resolve(res.tempFilePath)
          })
        } else {
          resolve(filePath)
        }
      }
    })
  })
}
```

### 4.3 图片 CDN 策略

```javascript
// utils/api.ts
const BASE_URL = 'https://...';

// 图片 URL 添加尺寸参数（若后端支持）
export function resolveImg(url) {
  if (!url) return '';
  if (/^cloud:\/\//.test(url)) return url;
  // 添加宽度参数，让 CDN 按需缩放
  return `${url}?x-oss-process=image/resize,w_400`;
}
```

---

## 五、P2 优化：Skyline 渲染引擎迁移

### 5.1 背景

微信官方推出的 **Skyline** 渲染引擎替代 WebView，解决长列表白屏和渲染卡顿问题。

### 5.2 适配步骤

```json
// project.config.json
{
  "miniprogramRoot": "",
  "compileType": "miniprogram",
  "setting": {
    "skylineRenderEnable": true
  },
  "libVersion": "3.3.4"
}
```

### 5.3 关键变化

```xml
<!-- 旧：scroll-view -->
<scroll-view scroll-y bindscrolltolower="onReachBottom">
  <view wx:for="{{list}}" wx:key="id">{{item.name}}</view>
</scroll-view>

<!-- 新：Skyline list 模式（自动按需渲染） -->
<scroll-view type="list" scroll-y bindscrolltolower="onReachBottom">
  <virtual-comp>
    <view wx:for="{{list}}" wx:key="id">{{item.name}}</view>
  </virtual-comp>
</scroll-view>
```

### 5.4 收益预估

| 指标       | WebView        | Skyline             |
| ---------- | -------------- | ------------------- |
| 长列表帧率 | 30-45fps       | 55-60fps            |
| 内存占用   | 高（全量节点） | 低（按需创建/回收） |
| 白屏率     | 快滑时有       | 基本无              |
| 开发成本   | 低             | 中（需改造 WXML）   |

---

## 六、P2 优化：分包加载

### 6.1 当前问题

所有页面在主包，主包体积大，首屏加载慢。

### 6.2 分包方案

```json
// app.json
{
  "pages": [
    "pages/index/index", // 主包：首页
    "pages/login/login", // 主包：登录（必经）
    "pages/welcome/welcome" // 主包：欢迎页
  ],
  "subPackages": [
    {
      "root": "packageStore",
      "pages": ["pages/store/store", "pages/register/register"]
    },
    {
      "root": "packageGoods",
      "pages": ["pages/goods/goods", "pages/goods-edit/goods-edit", "pages/category/category"]
    },
    {
      "root": "packageBilling",
      "pages": ["pages/billing/billing"]
    },
    {
      "root": "packageOrders",
      "pages": ["pages/orders/orders", "pages/order-detail/order-detail"]
    },
    {
      "root": "packageOther",
      "pages": [
        "pages/customer/list",
        "pages/customer/detail",
        "pages/printer-pair/printer-pair",
        "pages/platform/platform"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["packageGoods"]
    }
  }
}
```

### 6.3 预加载策略

```
首页加载时 → 预下载 packageGoods（商品管理）
开单页加载时 → 预下载 packageOrders（订单）
商品页加载时 → 预下载 packageBilling（开单）
```

---

## 七、P2 优化：主题切换

### 7.1 方案：CSS 变量 + data-theme

```css
/* styles/tokens.wxss - 浅色主题（默认） */
page,
:host {
  --bg-app: #eff3fa;
  --bg-gradient: linear-gradient(180deg, #f5f7fc 0%, #e6ecf7 100%);
  --bg-card: rgba(255, 255, 255, 0.68);
  --text-1: #1d222b;
  /* ... 其他变量 */
}

/* 深色主题 */
page[data-theme='dark'],
:host([theme='dark']) {
  --bg-app: #0f1419;
  --bg-gradient: linear-gradient(180deg, #1a1f2e 0%, #0f1419 100%);
  --bg-card: rgba(30, 35, 50, 0.85);
  --bg-card-strong: rgba(30, 35, 50, 0.95);
  --bg-subtle: rgba(30, 35, 50, 0.6);
  --bg-overlay: rgba(30, 35, 50, 0.92);
  --text-1: #e8eaf0;
  --text-2: #9ca3af;
  --text-3: #6b7280;
  --glass-border: rgba(255, 255, 255, 0.08);
  --hairline: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.1);
}
```

```javascript
// utils/theme.js
const THEME_KEY = 'cutian_theme';

function getTheme() {
  return wx.getStorageSync(THEME_KEY) || 'light';
}

function setTheme(theme) {
  wx.setStorageSync(THEME_KEY, theme);
  // 通知所有页面更新
  const pages = getCurrentPages();
  pages.forEach((page) => {
    if (page.setData) {
      page.setData({ theme });
    }
  });
  // 更新全局 data-theme
  wx.setSystemTheme ? wx.setSystemTheme({ theme }) : null;
}

module.exports = { getTheme, setTheme };
```

### 7.2 参考对标

| 项目                | 方案               | 本项目采纳        |
| ------------------- | ------------------ | ----------------- |
| TDesign             | CSS Variables 覆盖 | ✅ 直接复用       |
| PoemUI              | 5 个布尔开关       | ⚠️ 可借鉴开关思路 |
| glassmorphism-theme | Token 驱动         | ✅ 已实现         |

---

## 八、P3 优化：无障碍增强

### 8.1 当前状态

已有三色降级（低透明/减动效/高对比），并已补齐 VoiceOver 基础标签：

1. 自定义 TabBar、商品/订单/会员卡片：`aria-role` + 动态 `aria-label`
2. 图片：`aria-label`（商品名/序号），纯装饰图标：`aria-hidden`
3. 表单：搜索框、手机号、备注、商品编辑字段：`aria-label`
4. 待办：动态类型（iOS 大字模式）与完整焦点管理仍可继续增强

### 8.2 动态类型适配

```css
/* styles/tokens.wxss */
@media (prefers-reduced-motion: reduce) {
  /* 已有 */
}

/* 新增：大字体适配 */
@media (-webkit-min-device-pixel-ratio: 0) {
  /* iOS 动态类型 */
  page {
    --font-xs: calc(22rpx * var(--dynamic-type-scale, 1));
    --font-body: calc(28rpx * var(--dynamic-type-scale, 1));
    --font-h1: calc(72rpx * var(--dynamic-type-scale, 1));
  }
}
```

### 8.3 VoiceOver 标签

```xml
<!-- 按钮添加 accessibility-label -->
<button
  class="btn btn-primary"
  aria-label="确认开单，金额 {{totalAmount}} 元"
  bindtap="handleSubmit">
  确认开单
</button>

<!-- 图片添加 alt -->
<image
  src="{{item.image}}"
  aria-label="{{item.name}}"
  class="goods-img" />
```

---

## 九、优化执行计划

### 第一阶段：P0 必做（1 次迭代）

| 任务                                  | 涉及文件                 | 工作量 | 状态                      |
| ------------------------------------- | ------------------------ | ------ | ------------------------- |
| 开单页分页加载（已实现，需验证）      | billing.js/wxml/wxss     | 0.5d   | ✅ 代码完成（真机待复验） |
| 图片懒加载 + 占位图                   | billing.wxml, goods.wxml | 0.5d   | ✅                        |
| P0 间距/圆角/字号修复（UI-AUDIT）     | 14 个 wxss 文件          | 1d     | ✅                        |
| setData 精确路径更新（数量增减/小计） | billing.js, goods.js     | 0.5d   | ⚠️ 部分（结构变更仍全量） |

### 第二阶段：P1 重要（2-3 次迭代）

| 任务                       | 涉及文件                     | 工作量 | 状态                   |
| -------------------------- | ---------------------------- | ------ | ---------------------- |
| 图片压缩上传               | utils/api.ts（两条上传通道） | 1d     | ✅                     |
| 合并重复 setData 调用      | billing.js（规格选择）等     | 1d     | ✅                     |
| 引入 recycle-view 虚拟列表 | billing, orders, goods       | 2d     | ❌ 未开始 / 暂缓       |
| 分包加载配置               | app.json                     | 1d     | ⏸ 暂缓（源码约 521KB） |

### 第三阶段：P2 增强（3-4 次迭代）

| 任务                         | 涉及文件                        | 工作量 | 状态                                |
| ---------------------------- | ------------------------------- | ------ | ----------------------------------- |
| 骨架屏组件化                 | components/skeleton-card        | 1d     | ✅                                  |
| 无障碍增强（VoiceOver 标签） | 各页面 wxml                     | 1d     | ✅ 15/15 页面已标注（真机走查待做） |
| 主题切换（深色模式）         | tokens.wxss, app.js, 设置页     | 2d     | ❌ 未开始 / 暂缓                    |
| Skyline 渲染引擎适配         | project.config.json, 长列表页面 | 2d     | 暂缓                                |

### 第四阶段：P3 完善（持续）

| 任务         | 说明                      | 状态 |
| ------------ | ------------------------- | ---- |
| 性能监控接入 | 接入微信性能 API 上报     | 规划 |
| 内存泄漏检测 | 定期检查定时器/监听器清理 | 规划 |
| 真机性能测试 | 低端机型专项优化          | 规划 |

---

## 十、性能检测清单

### 10.1 启动性能

- [x] 主包源码体积约 521KB / 0.50MB（2026-10-27 静态统计，最终以开发者工具代码依赖分析为准）
- [ ] 总包大小 < 20MB
- [ ] 冷启动时间 < 1.5s
- [ ] 首屏渲染时间 < 2s
- [ ] 已配置分包加载
- [ ] 已配置预加载规则

### 10.2 渲染性能

- [x] 开单页商品列表使用虚拟滚动或分页
- [ ] setData 单次数据量 < 1024KB
- [x] 数量增减使用精确路径更新（新增/删除等结构变更除外）
- [ ] WXML 节点数 < 1000
- [ ] 组件嵌套层级 < 10 层
- [x] 图片已启用 lazy-load
- [ ] 背景光晕不使用 fixed（iOS 兼容）

### 10.3 内存性能

- [ ] onUnload 中清理所有定时器
- [ ] onUnload 中移除所有事件监听
- [ ] 不在 data 中存储大对象
- [ ] 长列表使用虚拟滚动回收节点

### 10.4 网络性能

- [ ] 接口请求已合并（减少请求次数）
- [x] 图片已压缩（上传前 `wx.compressImage`）
- [ ] 已配置 CDN
- [x] 失败请求有重试机制（502/503/504 + 网络失败）

### 10.5 无障碍

- [x] TabBar / 卡片等可点击元素有 `aria-role` + `aria-label`
- [x] 商品图片有 `aria-label`，装饰图标 `aria-hidden`
- [x] 搜索、手机号、备注等输入有 `aria-label`
- [ ] 动态类型（iOS 大字模式）全量适配
- [ ] VoiceOver 真机走查

---

_小程序端优化方案 v1.1 | 2026-10-26_  
_参考：wechat-miniprogram/recycle-view, zhanghaoxu/wechat-long-list-chunk, awesome-skyline, miniprogram-performance-optimizer_
