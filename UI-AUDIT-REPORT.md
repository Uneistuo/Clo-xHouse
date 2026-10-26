# 🎨 项目UI交付规范审核报告（验收版 v2）

> 生成时间：2026-10-24 | 审核范围：19个页面 + 2个组件 | 共21个 .wxss 文件

> **实施状态（2026-10-26）：本报告 40 处 P0/P1 修改已全部完成。** 其中 38 处于 v1.17.1 落地；剩余 `orders/orders.wxss` 的 `.filter-entry`（`12rpx 4rpx → 12rpx 8rpx`）与 `.status-tab`（`12rpx 24rpx → 8rpx 24rpx`）于本次完成。同时按 `docs/DESIGN-SPEC-V2.md` 3.2 节补充 Token：`--font-xs-sm`、`--font-h4`、`--shadow-glow-success`、`--shadow-glow-warning`、`--anim-duration-page`。下方清单保留为验收记录，不再作为待办。

---

## Token 体系验收 ✅

`styles/tokens.wxss` 已包含完整设计令牌，覆盖全部 4 个维度：

| 类别     | Token 变量                                  | 覆盖值                    |
| -------- | ------------------------------------------- | ------------------------- |
| **圆角** | `--radius-sm/md/card/hero/input/sheet/pill` | 16/24/36/44/24/44/999 rpx |
| **间距** | `--space-1~11`                              | 8~112 rpx（4倍数阶梯）    |
| **字号** | `--font-xs/body/h3/h2/h1`                   | 22/28/32/44/72 rpx        |
| **颜色** | 文字/品牌/语义/阴影等                       | 完整语义色板              |

---

## 1️⃣ 间距规范性

### 已修复 ✅

- 主要页面的 `padding` / `margin` 已统一为 4 的倍数
- 圆角变量已全面替换为 `var(--radius-*)`

### 历史基线（修复前约 25 处，已全部处理）

> 以下为修复前的间距基线记录，仅用于追溯；当前代码已按建议值或 Token 完成调整，不再作为待办。

#### 🔴 非 4 倍数值（必须修正）

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

#### ⚠️ 非标准值（建议修正）

| 文件                             | 行号 | 选择器                | 当前值                 | 建议修正        |
| -------------------------------- | ---- | --------------------- | ---------------------- | --------------- |
| `category/category.wxss`         | L30  | `.cat-manage-btn`     | `padding: 12rpx 32rpx` | → `8rpx 32rpx`  |
| `goods-edit/goods-edit.wxss`     | L121 | `.tag-edit`           | `padding: 12rpx 20rpx` | → `8rpx 16rpx`  |
| `goods-edit/goods-edit.wxss`     | L158 | `.size-opt`           | `padding: 12rpx 32rpx` | → `8rpx 32rpx`  |
| `goods-edit/goods-edit.wxss`     | L207 | `.sku-input`          | `padding: 12rpx 16rpx` | → `16rpx 16rpx` |
| `goods/goods.wxss`               | L189 | `.manage-entry`       | `padding: 12rpx 24rpx` | → `8rpx 24rpx`  |
| `orders/orders.wxss`             | L35  | `.filter-entry`       | `padding: 12rpx 4rpx`  | → `12rpx 8rpx`  |
| `orders/orders.wxss`             | L52  | `.status-tab`         | `padding: 12rpx 24rpx` | → `8rpx 24rpx`  |
| `printer-pair/printer-pair.wxss` | L186 | `.setting-chip`       | `padding: 12rpx 28rpx` | → `8rpx 24rpx`  |
| `printer-pair/printer-pair.wxss` | L230 | `.logs-clear`         | `padding: 6rpx 12rpx`  | → `4rpx 16rpx`  |
| `store/store.wxss`               | L333 | `.drag-handle-bottom` | `padding: 12rpx 16rpx` | → `8rpx 16rpx`  |

---

## 2️⃣ 圆角嵌套合理性

### 已修复 ✅

| 位置                               | 原值                   | 当前值                        |
| ---------------------------------- | ---------------------- | ----------------------------- |
| `billing/billing.wxss` `.cart-img` | `border-radius: 20rpx` | `var(--radius-sm)` = 16rpx ✅ |
| `index/index.wxss` `.quick-icon`   | `border-radius: 20rpx` | `var(--radius-sm)` = 16rpx ✅ |
| `login/login.wxss` `.field`        | `border-radius: 24rpx` | `var(--radius-input)` ✅      |
| `register/register.wxss` `.field`  | `border-radius: 24rpx` | `var(--radius-input)` ✅      |

### 历史基线（修复前 5 处硬编码 20rpx，已全部改为 Token）

> 以下为修复前的圆角基线记录，当前项目中已无 `border-radius: 20rpx`。

| 文件                         | 行号 | 选择器        | 当前值                 | 建议修正                     | 外层容器              |
| ---------------------------- | ---- | ------------- | ---------------------- | ---------------------------- | --------------------- |
| `goods/goods.wxss`           | L85  | `.goods-img`  | `border-radius: 20rpx` | → `var(--radius-sm)` (16rpx) | `.goods-card` (36rpx) |
| `billing/billing.wxss`       | L46  | `.goods-img`  | `border-radius: 20rpx` | → `var(--radius-sm)` (16rpx) | `.goods-row` (36rpx)  |
| `goods-edit/goods-edit.wxss` | L27  | `.img-thumb`  | `border-radius: 20rpx` | → `var(--radius-sm)` (16rpx) | 140×140 独立元素      |
| `goods-edit/goods-edit.wxss` | L51  | `.img-add`    | `border-radius: 20rpx` | → `var(--radius-sm)` (16rpx) | 140×140 独立元素      |
| `welcome/welcome.wxss`       | L115 | `.guide-icon` | `border-radius: 20rpx` | → `var(--radius-sm)` (16rpx) | `.wc-guide` (36rpx)   |

**验证：** 上述 5 处均为硬编码 `border-radius: 20rpx`，未使用 `var(--radius-sm)`，与 token 体系不一致。

---

## 3️⃣ 颜色饱和度

### ✅ 全部通过

| 检查项               | 实际值    | 饱和度估算 | 结论            |
| -------------------- | --------- | ---------- | --------------- |
| 主品牌色 `--primary` | `#7b8cf7` | ~55%       | ✅ 合格（≤70%） |
| Hero渐变起点         | `#8a9bf9` | ~58%       | ✅ 合格         |
| Hero渐变终点         | `#b3a1fb` | ~55%       | ✅ 合格         |
| 暖橙点缀 `--warm`    | `#f2a57c` | ~65%       | ✅ 合格         |
| 成功色 `--success`   | `#3bae76` | ~55%       | ✅ 合格         |
| 警告色 `--warning`   | `#d69a3c` | ~55%       | ✅ 合格         |
| 危险色 `--danger`    | `#e05d57` | ~55%       | ✅ 合格         |
| 主文字色 `--text-1`  | `#1d222b` | 中性深灰蓝 | ✅ 非纯黑       |
| 次要文字 `--text-2`  | `#5a6270` | 中性灰     | ✅              |
| 弱化文字 `--text-3`  | `#97a0ae` | 浅灰       | ✅              |

**结论：颜色系统优秀，无高饱和违规项。**

---

## 4️⃣ 字号层级

### 已使用 Token 的元素 ✅

| 类名            | Token 引用                 | 文件            |
| --------------- | -------------------------- | --------------- |
| `.profile-name` | `var(--font-h3)`           | customer/detail |
| `.goods-name`   | `var(--font-h3)`           | goods           |
| `.btn-primary`  | `30rpx`（接近 h3，可接受） | app.wxss        |

### 剩余需收敛的字号（共约 15 处）

#### 🔴 非标准字号（必须修正）

| 文件                         | 行号 | 选择器          | 当前值  | 建议值    | 原因     |
| ---------------------------- | ---- | --------------- | ------- | --------- | -------- |
| `goods-edit/goods-edit.wxss` | L196 | `.sku-name`     | `27rpx` | → `28rpx` | 非常规值 |
| `index/index.wxss`           | L162 | `.bookmark-tab` | `25rpx` | → `22rpx` | 非常规值 |
| `goods/goods.wxss`           | L54  | `.goods-no`     | `23rpx` | → `22rpx` | 非常规值 |
| `welcome/welcome.wxss`       | L130 | `.guide-sub`    | `23rpx` | → `22rpx` | 非常规值 |

#### ⚠️ 建议统一到 Token 的字号

| 文件                                 | 行号 | 选择器                  | 当前值  | 建议 Token    | 建议值             |
| ------------------------------------ | ---- | ----------------------- | ------- | ------------- | ------------------ |
| `custom-confirm/custom-confirm.wxss` | L43  | `.c-confirm-title`      | `34rpx` | `--font-h3`   | `32rpx`            |
| `custom-confirm/custom-confirm.wxss` | L50  | `.c-confirm-content`    | `28rpx` | `--font-body` | `28rpx` ✅ 已合格  |
| `order-detail/order-detail.wxss`     | L38  | `.status-amount .price` | `46rpx` | 特殊场景      | 可保留或 → `72rpx` |
| `order-detail/order-detail.wxss`     | L89  | `.total-row .price`     | `36rpx` | `--font-h3`   | `32rpx`            |
| `billing/billing.wxss`               | L487 | `.success-amount`       | `60rpx` | `--font-h1`   | `72rpx`            |
| `category/category.wxss`             | L22  | `.cat-page-title`       | `38rpx` | `--font-h2`   | `44rpx`            |
| `store/store.wxss`                   | L426 | `.settings-arrow`       | `34rpx` | `--font-h3`   | `32rpx`            |

### 特殊场景可保留的字号

以下字号属于特殊场景（图标、超大数字），可保留：

- `80rpx` / `96rpx` — 空状态图标（.empty-icon、.success-icon）
- `48rpx` — TabBar 中间图标、头像
- `56rpx` — 商品图占位图标、FAB 图标
- `52rpx` — 首页双卡数字
- `64rpx` / `68rpx` — 完成动画图标、欢迎页图标

---

## 5️⃣ 修改清单汇总

### 🔴 P0：必须修复（共 27 处）

#### A. 间距修正（17处）

```
app.wxss L326:    margin-right: 12rpx → 16rpx
app.wxss L447:    margin-bottom: 12rpx → 16rpx
app.wxss L519:    margin-bottom: 12rpx → 16rpx
billing L22:      margin-right: 12rpx → 16rpx
billing L484:     margin-top: 12rpx → 16rpx
customer/list L202: margin-left: 12rpx → 16rpx
goods L131:       margin-right: 12rpx → 16rpx
order-detail L46: margin-top: 12rpx → 16rpx
order-detail L69: margin-top: 10rpx → 8rpx
order-detail L75: margin-left: 12rpx → 16rpx
order-detail L86: padding-top: 22rpx → 24rpx
order-detail L116: margin: 12rpx 0 → 16rpx 0
order-detail L150: margin-top: 6rpx → 8rpx
printer-pair L35: margin-bottom: 12rpx → 16rpx
printer-pair L178: margin-bottom: 12rpx → 16rpx
printer-pair L361: margin-bottom: 12rpx → 16rpx
store L191:       padding: 12rpx 0 → 16rpx 0
```

#### B. 圆角修正（5处）

```
goods L85:        border-radius: 20rpx → var(--radius-sm)
billing L46:      border-radius: 20rpx → var(--radius-sm)
goods-edit L27:   border-radius: 20rpx → var(--radius-sm)
goods-edit L51:   border-radius: 20rpx → var(--radius-sm)
welcome L115:     border-radius: 20rpx → var(--radius-sm)
```

#### C. 字号修正（4处）

```
goods-edit L196:  font-size: 27rpx → 28rpx
index L162:       font-size: 25rpx → 22rpx
goods L54:        font-size: 23rpx → 22rpx
welcome L130:     font-size: 23rpx → 22rpx
```

### ⚠️ P1：建议优化（共约 12 处）

#### D. padding 标准化（10处）

```
category L30:       padding: 12rpx 32rpx → 8rpx 32rpx
goods-edit L121:    padding: 12rpx 20rpx → 8rpx 16rpx
goods-edit L158:    padding: 12rpx 32rpx → 8rpx 32rpx
goods-edit L207:    padding: 12rpx 16rpx → 16rpx 16rpx
goods L189:         padding: 12rpx 24rpx → 8rpx 24rpx
orders L35:         padding: 12rpx 4rpx → 12rpx 8rpx
orders L52:         padding: 12rpx 24rpx → 8rpx 24rpx
printer-pair L186:  padding: 12rpx 28rpx → 8rpx 24rpx
printer-pair L230:  padding: 6rpx 12rpx → 4rpx 16rpx
store L333:         padding: 12rpx 16rpx → 8rpx 16rpx
```

#### E. 字号 Token 引用（约 5 处）

```
custom-confirm L43:  font-size: 34rpx → var(--font-h3) [32rpx]
order-detail L89:    font-size: 36rpx → var(--font-h3) [32rpx]
billing L487:        font-size: 60rpx → var(--font-h1) [72rpx]
category L22:        font-size: 38rpx → var(--font-h2) [44rpx]
store L426:          font-size: 34rpx → var(--font-h3) [32rpx]
```

---

## 6️⃣ 总体评估

| 维度           | 评分       | 说明                         |
| -------------- | ---------- | ---------------------------- |
| **Token 体系** | ⭐⭐⭐⭐⭐ | 完整，覆盖全部 4 维度        |
| **间距规范**   | ⭐⭐⭐☆☆   | 约 85% 达标，P0 修复后达 95% |
| **圆角嵌套**   | ⭐⭐⭐⭐☆  | 主要问题已修复，5 处残余     |
| **颜色系统**   | ⭐⭐⭐⭐⭐ | 饱和度控制优秀               |
| **字号层级**   | ⭐⭐⭐⭐☆  | Token 已建立，需全面替换     |
| **整体**       | ⭐⭐⭐⭐☆  | **良好，P0 修复后可交付**    |

---

## 7️⃣ 修改执行顺序建议

```
第 1 步：修复 P0 间距（17处）—— 批量 grep + replace
第 2 步：修复 P0 圆角（5处）—— 20rpx → var(--radius-sm)
第 3 步：修复 P0 字号（4处）—— 27/25/23rpx → 标准值
第 4 步：修复 P1 padding（10处）
第 5 步：修复 P1 字号（5处）
第 6 步：全量验证，确认无遗漏
```

**预计工作量：约 40 处修改，可在 1 次迭代内完成。**

---

_验收日期：2026-10-24 | 基于最新代码状态生成_
