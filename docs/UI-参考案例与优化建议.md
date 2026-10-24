# 裁间项目 UI 参考案例与优化建议

> 日期：2026-10-24  
> 范围：微信小程序 + Web 后台  
> 目标：对比开源参考案例，完善整体 UI/UX 设计

---

## 一、参考案例调研总结

### 1.1 同类服装店/裁缝店管理系统

| 项目                | 链接                                                              | 借鉴点                                                       |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| **TailorCraft Pro** | `github.com/MusheAbdulHakim/TailorShop-Management-System`（28星） | 三色任务看板（待接单→制作中→已完成）、尺码记录面板、取件提醒 |
| **ORDERRY**         | `orderry.com`（SaaS 产品）                                        | 订单状态时间线、多员工派单、取件通知                         |
| **fashion-mall**    | `github.com/weimingwill/fashion-mall`                             | 商品图片上传预览、规格选择器交互                             |

### 1.2 微信小程序电商/收银开源项目

| 项目                            | Stars | 借鉴点                                         |
| ------------------------------- | ----- | ---------------------------------------------- |
| **wechat-app-mall** (eastworld) | 18.7K | 完整的商品规格选择器、购物车持久化、订单时间线 |
| **NideShop**                    | 7.7K  | 商品分类拖拽排序、图片裁剪上传组件             |
| **fuint 门店会员营销系统**      | -     | 会员卡券体系、多员工角色权限、收银代客下单     |
| **BXERP 博昕收银**              | -     | 多店铺管理、蓝牙打印对接、钱箱控制             |
| **ICEPOS 收银系统**             | -     | 多设备扫码、支付接口聚合、离线模式             |

### 1.3 Glassmorphism / 清透质感设计资源

| 资源                          | 链接                                                   | 借鉴点                                          |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **glass-ui** (mkbabb)         | `github.com/mkbabb/glass-ui`                           | 七档玻璃层级、六层光学复合结构、tap-squish 规范 |
| **vanilla-css-glassmorphism** | `github.com/RanaAhmar/vanilla-css-glassmorphism`       | 纯变量驱动配方、零依赖移植                      |
| **GlassHome UI**              | `github.com/glasshome/ui`                              | 单公式驱动全局样式                              |
| **Vue Soft UI Dashboard**     | `github.com/creativetimofficial/vue-soft-ui-dashboard` | Soft UI 双层阴影 + 内高光写法                   |

### 1.4 拖拽展开 / 抽屉交互参考

| 参考                                        | 借鉴点                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| **Material Design BottomSheet Drag Handle** | 把手置于内容区顶部中央，点击三态切换（折叠↔半展↔全展），弹簧回弹动画     |
| **shadcn-ui / Base UI Drawer**              | `showSwipeHandle` 属性自动渲染拖拽条，拖拽时实时更新高度，松手 snap 吸附 |
| **微信 draggable-sheet 组件**               | 官方半屏可拖拽组件，支持 snap-sizes 吸附点（本项目不适用，仅限 Skyline） |
| **react-drag-mobile-drawer**                | 移动端拖拽 + 桌面端 fallback modal，支持 onDrag 回调实时同步高度         |

---

## 二、当前项目优势

| 维度               | 现状                                                          | 评价       |
| ------------------ | ------------------------------------------------------------- | ---------- |
| **设计语言统一性** | Token 体系完善，五档玻璃层级，全站配色一致                    | ⭐⭐⭐⭐⭐ |
| **无障碍降级**     | `prefers-reduced-transparency/motion/contrast` 三档全覆盖     | ⭐⭐⭐⭐⭐ |
| **性能意识**       | 长列表强制 Dense 层不加模糊，光晕用 radial-gradient 不用 blur | ⭐⭐⭐⭐⭐ |
| **交互细节**       | 拖拽展开、弹性回弹、手势冲突处理、页面滚动锁定                | ⭐⭐⭐⭐   |
| **文档完整性**     | 4 份方案文档 + 1 份任务清单 + 1 份优化方案 + README 版本历史  | ⭐⭐⭐⭐⭐ |

---

## 三、可借鉴的改进方向

### 3.1 首页看板优化（参考 fashion-mall / NideShop）

**现状：** 销售额 + 双卡（待收款/本期订单）+ 三栏（商品统计）+ 趋势图 + 低库存提醒

**建议补充：**

```
① 快捷操作入口（参考 fashion-mall 首页 grid）
   ├── ⚡ 快速开单（跳转 billing 页，空购物车时预置常用商品）
   └── 📷 拍照上传（跳转 goods-edit，直接进入图片上传步骤）

② 待办事项列表（参考 ORDERRY 的派单看板）
   ├── 待改衣订单 ×3（高优先级，点击跳转对应订单）
   └── 今日取件 ×5（按取件时间排序）

③ 销售趋势图增强
   └── 增加"同比/环比"小标签（如 "+12% 较上周"）
```

**代码位置：** `pages/index/index.wxml` L9-L86

---

### 3.2 订单状态时间线（参考 ORDERRY / wechat-app-mall）

**现状：** 订单详情页仅展示平铺信息，无时间线

**建议新增：**

```xml
<!-- order-detail.wxml 新增订单时间线 -->
<view class="timeline-card">
  <view class="section-title">订单动态</view>
  <view class="timeline">
    <view class="timeline-item" wx:for="{{timeline}}" wx:key="status">
      <view class="timeline-dot {{item.done ? 'done' : 'pending'}}"></view>
      <view class="timeline-content">
        <view class="timeline-label">{{item.label}}</view>
        <view class="timeline-time">{{item.time}}</view>
      </view>
    </view>
  </view>
</view>
```

```css
/* order-detail.wxss 新增 */
.timeline {
  padding: 8rpx 0;
}
.timeline-item {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
}
.timeline-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--text-3);
  margin-right: 20rpx;
  margin-top: 6rpx;
  flex-shrink: 0;
}
.timeline-dot.done {
  background: var(--success);
}
.timeline-content {
  flex: 1;
}
.timeline-label {
  font-size: 26rpx;
  color: var(--text-1);
}
.timeline-time {
  font-size: 22rpx;
  color: var(--text-3);
  margin-top: 4rpx;
}
```

**JS 数据：** `order.js` 中根据订单状态组装 timeline 数组（创建时间 → 收款时间 → 完成时间 → 售后时间）

---

### 3.3 商品图片上传增强（参考 NideShop）

**现状：** 最多上传 3 张，无预览/排序/封面标记

**建议借鉴 wx-cropper 组件：**

| 功能     | 参考项目                               | 实现方式                  |
| -------- | -------------------------------------- | ------------------------- |
| 图片裁剪 | `light-wind/wx-cropper`                | 引入 npm 包或复制组件代码 |
| 拖拽排序 | `shrekuu/wechat-miniprogram-drag-sort` | 长按拖动排序              |
| 封面标记 | 自定义实现                             | 右上角显示"封面"标签      |

**改动范围：** `pages/goods-edit/goods-edit.wxml` + `goods-edit.wxss`

---

### 3.4 开单页规格选择器增强（参考 wechat-app-mall）

**现状：** 颜色/尺码选项为胶囊按钮，数量步进器为简单 +/-

**建议优化：**

```
① 常用规格记忆
   └── 首次选择某规格组合后，下次开单时置顶显示（本地 Storage）

② 数量快捷输入
   └── 长按 + 按钮快速增加（如长按 +3 次，每次 +5）

③ 库存不足视觉提示
   └── 库存 < 5 时，该规格选项加虚线边框 + 橙色文字提示
```

**代码位置：** `pages/billing/billing.wxml` L110-L150（规格弹层）

---

### 3.5 Web 后台侧边栏优化（参考 fuint / CRMEB）

**现状：** 侧边栏为深色实色，导航项无分组

**建议借鉴 fuint 的侧边栏设计：**

| 维度     | 当前       | 建议                                           |
| -------- | ---------- | ---------------------------------------------- |
| 背景     | 深红实色   | Wash 层浅色玻璃（白 40% + blur）               |
| 导航分组 | 无         | 按模块分组（店铺 / 商品 / 订单 / 营销 / 设置） |
| 选中态   | 主色左边框 | 主色 12% 胶囊背景                              |
| 图标     | emoji      | 矢量图标（与小程序统一）                       |

**改动文件：** `web/style.css` L1-L100（侧边栏相关样式）

---

### 3.6 会员 CRM 增强（参考 fuint 会员体系）

**现状：** 会员列表仅显示消费次数/金额/最近到店，无标签/等级体系

**建议补充：**

| 功能     | 说明                                                                  |
| -------- | --------------------------------------------------------------------- |
| 会员等级 | 根据累计金额自动划分（普通/银卡/金卡/钻石），不同等级显示不同颜色徽章 |
| 消费标签 | 手动添加标签（如"改裤脚常客""高端面料"），用于精准营销                |
| 生日提醒 | 会员生日前 3 天推送提醒（可选）                                       |
| 快捷备注 | 在会员卡片上显示最近一次备注（如"左裤脚改窄 2cm"）                    |

**改动文件：** `pages/customer/list.wxml` + `customer/detail.wxml`

---

### 3.7 打印设置页增强（参考 BXERP / ICEPOS）

**现状：** 仅显示连接状态 + 测试打印按钮

**建议补充：**

| 功能         | 说明                                  |
| ------------ | ------------------------------------- |
| 打印模板选择 | 可选不同小票模板（标准/简洁/带 Logo） |
| 纸张设置     | 纸张宽度（58mm/80mm）自动适配         |
| 打印记录     | 最近 10 次打印成功/失败记录           |
| 离线模式提示 | 断网时显示"打印将在重连后补打"        |

**改动文件：** `pages/printer-pair/printer-pair.wxml` + `printer-pair.wxss`

---

## 四、图标系统补充建议

### 4.1 当前图标缺口

检查 `styles/icons.wxss`（当前 19 个图标），以下场景缺少图标：

| 场景           | 缺少图标                         | 建议来源                        |
| -------------- | -------------------------------- | ------------------------------- |
| 首页快捷开单   | `cash-register` / `receipt-text` | IconPark / Tabler               |
| 订单时间线节点 | `clock` / `check-circle`         | 现有 `icon-check-circle` 可复用 |
| 会员等级徽章   | `star` / `crown` / `gem`         | IconPark                        |
| 生日提醒       | `cake` / `gift`                  | IconPark                        |
| 打印模板       | `layout` / `document`            | IconPark                        |

### 4.2 补充方式

在 `styles/icons.wxss` 末尾追加：

```css
/* 新增图标（IconPark 导出，勿手改） */
.icon-crown {
  -webkit-mask-image: url('...');
  mask-image: url('...');
}
.icon-star {
  -webkit-mask-image: url('...');
  mask-image: url('...');
}
.icon-cake {
  -webkit-mask-image: url('...');
  mask-image: url('...');
}
```

---

## 五、动效增强建议（克制原则）

参考 glass-ui 的 spring physics 规范，以下位置可增强动效：

| 位置         | 当前 | 建议                                                 |
| ------------ | ---- | ---------------------------------------------------- |
| 首页卡片进场 | 无   | 错峰淡入（`animation-delay: calc(var(--i) * 80ms)`） |
| 拖拽展开把手 | 无   | 拖拽时把手轻微缩放（`scale(0.95 → 1.0)`）            |
| 开单成功卡片 | 无   | 图标弹入（`popIn` 动画，已实现）+ 金额数字滚动       |
| 订单状态变化 | 无   | 状态标签轻微脉冲（`@keyframes pulse`，200ms）        |

**注意：** 所有新增动效需尊重 `prefers-reduced-motion`，自动降级。

---

## 六、性能优化建议

### 6.1 当前已做好的

- ✅ 长列表强制 Dense 层不加模糊
- ✅ 光晕用 radial-gradient 不用 filter
- ✅ 拖拽时禁用 transition（`.store-card.is-dragging { transition: none }`）

### 6.2 可进一步优化

| 问题                                    | 建议                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| `page::before/::after` 全局光晕每页渲染 | 改为仅在首页和登录页显示，其余页面隐藏（通过 `.page` class 控制） |
| 开单页商品列表一次性拉 200 条           | 改为后端分页（每页 20 条），参考 wechat-app-mall 的分页实现       |
| 首页趋势图 JS 计算 barH 百分比          | 改为 CSS `flex: 1` + `max-height` 自动等高，减少 JS 计算          |

---

## 七、竞品/参考项目直接可复用的组件

### 7.1 图片裁剪组件（推荐直接引入）

**项目：** `light-wind/wx-cropper`  
**GitHub：** `github.com/light-wind/wx-cropper`  
**用法：**

```bash
npm install wx-cropper
```

```xml
<!-- goods-edit.wxml -->
<crop-view
  src="{{tempImagePath}}"
  outputWidth="{{cropWidth}}"
  outputHeight="{{cropHeight}}"
  bind:cropdone="onCropDone"
/>
```

### 7.2 拖拽排序组件（参考实现）

**项目：** `shrekuu/wechat-miniprogram-drag-sort`  
**GitHub：** `github.com/shrekuu/wechat-miniprogram-drag-sort`  
**适用场景：** 分类管理页的拖拽排序（当前已实现，可参考其 touch 事件处理逻辑）

### 7.3 骨架屏组件（推荐封装）

**当前状态：** 各页面自行实现 skeleton，样式不统一  
**建议：** 封装为通用组件 `components/skeleton-card/`，支持自定义行数/高度

---

## 八、总结：优先改进项（按 ROI 排序）

| 优先级 | 改进项                   | 工作量 | 预期收益                           |
| ------ | ------------------------ | ------ | ---------------------------------- |
| P0     | 订单状态时间线           | 0.5d   | 订单详情信息密度提升，符合行业惯例 |
| P0     | 商品图片裁剪组件引入     | 0.5d   | 上传体验显著提升，减少返工         |
| P1     | 首页快捷操作入口         | 0.5d   | 高频操作路径缩短                   |
| P1     | Web 侧边栏玻璃化         | 1d     | 前后端视觉统一                     |
| P1     | 开单规格选择器增强       | 1d     | 开单效率提升                       |
| P2     | 会员等级/标签体系        | 2d     | CRM 能力增强，适合营销场景         |
| P2     | 打印设置页增强           | 1d     | 减少打印配置错误                   |
| P3     | 动效增强（进场/脉冲）    | 1d     | 视觉精致度提升                     |
| P3     | 性能优化（光晕按需渲染） | 0.5d   | 低端机流畅度提升                   |

---

_文档结束_
