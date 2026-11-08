# 首页布局优化方案（修订版）

> 日期：2026-10-27  
> 修订：基于设计反馈，修正便签卡片风格，采用更现代的底部滑入模式

---

## 一、调研结果总结

### 1.1 GitHub 参考项目

| 项目                                                                            | Stars | 核心借鉴                 |
| ------------------------------------------------------------------------------- | ----- | ------------------------ |
| [PaperTodo](https://github.com/snownico0722/PaperTodo)                          | 2613  | 清单式待办结构           |
| [day-idea/sticky-notes](https://github.com/day-idea/sticky-notes)               | 2     | Microsoft To Do 风格参考 |
| [pluto-hyp/Stickyfloat](https://github.com/pluto-hyp/Stickyfloat)               | 4     | 浮动气泡交互             |
| [vincentcheny/watermelon-plan](https://github.com/vincentcheny/watermelon-plan) | 9     | 微信小程序 Todo 结构     |

### 1.2 UX 理论支撑

- **NNGroup Bottom Sheet 指南**：底部滑入更适合移动端，保留上下文可见性
- **Material Design 3 Bottom Sheets**：锚定底部，从下向上展开，支持拖拽关闭
- **Apple HIG Sheets**：圆角顶部 + 拖拽指示条 + 明确关闭按钮

### 1.3 设计趋势（Dribbble/Mobbin/CollectUI）

主流 Todo App 的共同特征：

- 白色/浅灰卡片背景，**非彩色便签底色**
- 左侧彩色竖条区分类型，**非全色填充**
- iconfont 描边图标，**非 emoji**
- 从底部滑入的 modal/bottom sheet，**非居中弹窗**
- 空状态有图标提示，**非空白**

---

## 二、设计方向修正

### 2.1 原方案问题

| 问题                     | 原因                           |
| ------------------------ | ------------------------------ |
| 彩色便签背景（黄/橙/粉） | 与项目蓝紫主色调冲突，过于休闲 |
| 卷角+倾斜效果            | 商业场景不适合，信息密度低     |
| emoji 图标               | 与项目 iconfont 系统不一致     |
| 居中弹窗                 | 不符合移动端交互习惯           |

### 2.2 新设计方案

**核心原则：干净、专业、与现有玻璃质感系统一致**

```
头部（经营看板同行）：
┌─────────────────────────────────────────────────────┐
│ 10月27日星期三          经营看板        [📋待办·16]  │
└─────────────────────────────────────────────────────┘
                            ↑ 始终可见（有事项时）

点击后从底部滑入：
┌─────────────────────────────────────────┐
│ ────（拖拽指示条）                      │
│  今日待办                        [✕]    │
├─────────────────────────────────────────┤
│ │  📋 待收款订单         12 单  ›       │  ← 蓝色左条
│ │     点击查看全部订单                   │
├─────────────────────────────────────────┤
│ │  📦 低库存商品          3 件  ›       │  ← 橙色左条
│ │     点击查看补货建议                   │
├─────────────────────────────────────────┤
│ │  🎂 会员生日提醒        1 人  ›       │  ← 粉色左条
│ │     点击查看会员详情                   │
└─────────────────────────────────────────┘
```

---

## 三、具体实现方案

### 3.1 WXML 变更

```xml
<!-- 头部右侧图标 -->
<view wx:if="{{totalTodoCount > 0}}"
      class="head-action" bindtap="openTodoModal"
      aria-role="button" aria-label="查看今日待办，共 {{totalTodoCount}} 项">
  <view class="icon icon-clipboard" aria-hidden="true"></view>
  <text class="head-action-label">待办</text>
  <view class="todo-badge">{{totalTodoCount}}</view>
</view>

<!-- 底部滑入模态框 -->
<view wx:if="{{showTodoModal}}" class="mask" bindtap="closeTodoModal">
  <view class="todo-bottom-sheet" catchtap="noop">
    <view class="sheet-handle"></view>
    <view class="sheet-header">
      <view class="sheet-title">今日待办</view>
      <view class="sheet-close" bindtap="closeTodoModal">
        <view class="icon icon-x-circle" aria-hidden="true"></view>
      </view>
    </view>
    <scroll-view scroll-y class="sheet-body">
      <view wx:for="{{modalItems}}" wx:key="key"
            class="todo-item {{item.colorClass}}"
            data-key="{{item.key}}" bindtap="goToCategory">
        <view class="todo-bar"></view>
        <view class="todo-content">
          <view class="todo-main">
            <view class="icon {{item.iconClass}}" aria-hidden="true"></view>
            <view class="todo-text">{{item.text}}</view>
            <view class="todo-count">{{item.count}}</view>
          </view>
          <view class="todo-sub">{{item.desc}}</view>
        </view>
        <view class="todo-arrow icon icon-chevron-right" aria-hidden="true"></view>
      </view>
      <view wx:if="{{modalItems.length === 0}}" class="todo-empty">
        <view class="icon icon-check-circle" aria-hidden="true"></view>
        <view class="todo-empty-text">今日暂无待办事项</view>
      </view>
    </scroll-view>
  </view>
</view>
```

### 3.2 WXSS 关键样式

```css
/* 头部图标 */
.head-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 12rpx 16rpx;
  background: var(--primary-tint);
  border-radius: var(--radius-sm);
  border: 1rpx solid var(--glass-border);
}
.todo-badge {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: var(--danger);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  border-radius: 16rpx;
}

/* 底部滑入动画 */
.todo-bottom-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--bg-overlay);
  border: 1rpx solid var(--glass-border);
  border-radius: var(--radius-hero) var(--radius-hero) 0 0;
  box-shadow: var(--shadow-float);
  animation: sheet-in var(--duration-slow) var(--ease-spring) both;
}
@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 待办条目 */
.todo-item {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--hairline);
}
.todo-bar {
  width: 6rpx;
  height: 48rpx;
  border-radius: 3rpx;
  margin-right: 24rpx;
}
.todo-item.pending .todo-bar {
  background: var(--primary);
}
.todo-item.warning .todo-bar {
  background: var(--warning);
}
.todo-item.danger .todo-bar {
  background: var(--danger);
}
.todo-count {
  font-size: 26rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--primary-tint);
  color: var(--primary-dark);
}
```

### 3.3 JS 变更

```javascript
// data 新增
showTodoModal: false,
totalTodoCount: 0,
modalItems: []  // [{key, iconClass, text, count, desc, colorClass}]

// loadDashboard() 中构建 modalItems
const modalItems = [];
if ((data.pendingOrders || 0) > 0) {
  modalItems.push({ key: 'pending', iconClass: 'icon-receipt',
    text: '待收款订单', count: data.pendingOrders,
    desc: '点击查看全部订单', colorClass: 'pending' });
}
if ((data.lowStock || []).length > 0) {
  modalItems.push({ key: 'lowStock', iconClass: 'icon-package',
    text: '低库存商品', count: data.lowStock.length,
    desc: '点击查看补货建议', colorClass: 'warning' });
}
if ((data.birthdays || []).length > 0) {
  modalItems.push({ key: 'birthday', iconClass: 'icon-cake',
    text: '会员生日提醒', count: data.birthdays.length,
    desc: '点击查看会员详情', colorClass: 'danger' });
}
this.setData({ modalItems, totalTodoCount: sum });

// 新增方法
openTodoModal() { this.setData({ showTodoModal: true }); }
closeTodoModal() { this.setData({ showTodoModal: false }); }
goToCategory(e) {
  const key = e.currentTarget.dataset.key;
  this.closeTodoModal();
  if (key === 'pending') { wx.switchTab({ url: '/pages/orders/orders' }); }
  else if (key === 'lowStock') { wx.switchTab({ url: '/pages/goods/goods' }); }
  else if (key === 'birthday') { wx.navigateTo({ url: '/pages/customer/list' }); }
}
```

---

## 四、Web 端商品图片修复

### 问题

`cloud://` fileID 无法在浏览器直接使用，`fixImg` 拼接出无效 URL。

### 修复

```javascript
// web/js/utils.js
export const fixImg = (u) => {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) return u;
  if (/^cloud:\/\//.test(u)) {
    console.warn('[fixImg] cloud:// 不支持:', u);
    return ''; // 触发占位图
  }
  return BASE_URL + u;
};
```

---

## 五、验收标准

| 项目                    | 验收方式                                             |
| ----------------------- | ---------------------------------------------------- |
| 首页无待办/低库存大卡片 | 目视确认已移除                                       |
| 首行右侧有待办图标      | 带数字角标，文字「待办」                             |
| 点击从底部滑入模态框    | 带动画，占据 70vh                                    |
| 列表干净专业            | 白色卡片 + 左侧色条，非彩色便签                      |
| 点击跳转正确            | 各分类跳转对应页面                                   |
| 无事项时图标隐藏        | totalTodoCount=0 时不显示                            |
| 空状态友好              | 显示「今日暂无待办事项」+ 图标                       |
| Web 图片不裂图          | cloud:// 显示占位图                                  |
| 检查命令全通过          | format:check, typecheck, lint, lint:web, icons:check |

---

## 六、图标使用确认

| 用途       | icon 类名            | 来源                            |
| ---------- | -------------------- | ------------------------------- |
| 头部图标   | `icon-clipboard`     | styles/icons.source.json (base) |
| 关闭按钮   | `icon-x-circle`      | styles/icons.source.json (base) |
| 空状态图标 | `icon-check-circle`  | styles/icons.source.json (base) |
| 待收款     | `icon-receipt`       | styles/icons.source.json (base) |
| 低库存     | `icon-package`       | styles/icons.source.json (base) |
| 生日       | `icon-cake`          | styles/icons-extra.wxss (extra) |
| 跳转箭头   | `icon-chevron-right` | styles/icons.source.json (base) |

所有图标均已有，无需新增。
