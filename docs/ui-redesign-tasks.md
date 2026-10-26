# UI 改版任务清单（实施版）

> 对应方案：`docs/ui-redesign-plan.md`
> 总工期：建议 3–4 个工作日 ｜ 全部为纯样式改动，零 JS/WXML 逻辑变更

---

## P0 基础层（0.5–1 天）

### 任务 1：Design Token 全量替换

**文件**：`styles/tokens.wxss`

**步骤：**

1. 清空原文件内容，写入第 3.2 节完整 Token 块（含 `--blur-*`、`--shadow-*`、`--inner-light`、`--radius-*`、`--space-*`、`--duration-*`、`--scale-press-*`）
2. 确认保留旧变量名（如 `.card` 相关 class 引用的变量名不变），确保存量页面即时生效
3. 用 grep 搜索旧变量引用，确认无遗漏

### 任务 2：全局玻璃类新增（五档）

**文件**：`app.wxss`

**步骤：**

1. 在文件顶部或合适位置新增五档 glass 类：
   ```css
   .glass-wash   /* 输入框底 / TabBar */
   .glass-card   /* 标准功能卡 */
   .glass-dense  /* 长列表行 */
   .glass-hero   /* 首页销售额 / 登录面板 */
   .glass-overlay/* 弹窗面板 */
   ```
2. 将现有全局类 `.card` / `.list-card` / `.btn-*` / `.tag-*` / `.modal` / `.skeleton` / `.empty*` / `.mask` 的样式改为玻璃规范
3. 确认 `.glass-*` 类不破坏任何存量 class 的既有布局（只改背景/阴影/圆角）

### 任务 3：背景光晕实现

**文件**：`app.wxss`

**步骤：**

1. 写入 `page` 规则：`background: var(--bg-gradient)` + `background-attachment: fixed`
2. 写入 `page::before` / `page::after` 规则：`position: fixed; z-index: 0; pointer-events: none; border-radius: 50%`，按第 3.4 节配方写入两处径向渐变
3. 在开发者工具预览任意页面，确认光晕可见且不遮挡内容

### 任务 4：app.json 配色更新

**文件**：`app.json`

**步骤：**

1. 全局 `navigationBarBackgroundColor` → `#F3F5FA`
2. 全局 `backgroundColor` → `#F3F5FA`
3. TabBar 配置中的 `selectedIconPath` / `iconPath` 不变；`backgroundColor` 同步改为 `#F3F5FA`

### 任务 5：悬浮玻璃 TabBar

**文件**：`custom-tab-bar/index.wxss`

**步骤：**

1. 容器改为 Wash 层样式：高 108rpx、圆角 36rpx、`backdrop-filter: blur(14px) saturate(140%)`、`--glass-border` 描边、`--shadow-float` 阴影
2. 容器定位：`position: fixed; bottom: 16rpx; left: 24rpx; right: 24rpx; z-index: 100`
3. 选中项：图标与文字改主色（`--primary`）；背景加 `--primary-tint` 圆角胶囊
4. 中间「开单」圆钮：108rpx 圆形、主色渐变底 + `--shadow-primary`、白色图标；`active` 态 `scale(var(--scale-press-dock))`
5. **布局影响检查**：逐页确认 `page-bottom-space` 或底部 padding 是否足够，防止内容与 TabBar 重叠

### 任务 6：页面根容器背景清理

**文件**：7 个页面的 `.wxss`

**步骤：**

1. 逐一将以下页面的根容器 `background` 改为 `transparent`：
   - `pages/index/index.wxss`（`.home`）
   - `pages/login/login.wxss`（`.login-page`）
   - `pages/register/register.wxss`（`.register-page` 等）
   - `pages/welcome/welcome.wxss`
   - `pages/store/store.wxss`（`.store-page`）
   - `pages/platform/stores.wxss`
   - `pages/printer-pair/printer-pair.wxss`
2. 验证清除后光晕可见，且页面内容不受影响

### 任务 7：试点页面验证（登录 + 首页）

**文件**：`pages/login/`、`pages/index/`

**步骤：**

1. `pages/login/login.wxss`：登录面板换 `.glass-hero`；输入框换 `.glass-wash`；底部链接文字改主色
2. `pages/index/index.wxss`：销售额卡换 `.glass-hero`；双卡/三栏换 `.glass-card`；趋势柱改用渐变色
3. 微信开发者工具预览，截图保存
4. iOS 真机预览，确认模糊效果正常、光晕可见

---

## P1 核心页（1–1.5 天）

### 任务 8：注册页改造

**文件**：`pages/register/register.wxss`

**步骤：**

1. 步骤条节点：改为主色渐变圆点 + Wash 层轨道
2. 表单区域：整卡换 `.glass-card`，内边距 32rpx
3. 各输入框：换 `.glass-wash` 样式
4. 完成页成功标记：添加柔光效果（`box-shadow: var(--shadow-primary)`）
5. 开发者工具 + 真机走查三步流程

### 任务 9：欢迎页改造

**文件**：`pages/welcome/welcome.wxss`

**步骤：**

1. 功能引导卡：整体换 `.glass-card`
2. 引导按钮：主色渐变底 + 白字 + `--shadow-primary`
3. 入场动效保留，确认不影响光晕显示
4. 真机预览确认

### 任务 10：商品页改造

**文件**：`pages/goods/goods.wxss`

**步骤：**

1. 搜索框：换 `.glass-wash`
2. 分类筛选条：Wash 层轨道 + 胶囊滑块
3. 商品列表行：换 `.glass-dense`（不加模糊）
4. 图片占位块：背景改为 `linear-gradient(135deg, #EEF0F9, #F7F4F0)`
5. 空状态容器：加 `.glass-dense` 外框，图标透明度 40%
6. 真机滚动测试，确认无卡顿

### 任务 11：开单页深度改造（重点回归）⭐

**文件**：`pages/billing/billing.wxss`（约 459 行，最大文件）

**步骤：**

1. **搜索框**：换 `.glass-wash`
2. **商品列表行**：全部换 `.glass-dense`（强制不模糊，性能关键）
3. **购物车面板**：换 `.glass-card`（Standard 层）
4. **结算悬浮条**：换 `.glass-overlay`（Overlay 层 + `--shadow-float`）
5. **分类筛选 Tab**：Wash 层分段控件
6. **回归检查清单**：
   - [ ] 滚动流畅，无掉帧（低端机重点）
   - [ ] 商品行高度不变，布局未错位
   - [ ] 结算金额数字清晰可读
   - [ ] 按钮可正常点击，按下有回弹
7. 截图保存前后对比

---

## P2 其余页（1 天）

### 任务 12：订单相关页面

**文件**：`pages/orders/`、`pages/order-detail/`

**步骤：**

1. `pages/orders/orders.wxss`：
   - 状态 Tab 换 Wash 层分段控件
   - 订单卡按状态分级：已完成/待付款 → `.glass-card`；进行中 → `.glass-dense`
   - 状态标签：语义色 12% 透明底 + 对应深色文字
2. `pages/order-detail/order-detail.wxss`：
   - 明细分区卡换 `.glass-card`
   - 金额数字颜色改 `--primary`，字重加粗
3. 真机走查订单列表滚动

### 任务 13：客户相关页面

**文件**：`pages/customer/list.wxss`、`pages/customer/detail.wxss`

**步骤：**

1. `pages/customer/list/`：搜索框 `.glass-wash`；客户列表行 `.glass-dense`；空状态容器 `.glass-dense`
2. `pages/customer/detail/`：资料卡、消费记录卡换 `.glass-card`
3. 确认数据加载正常，无样式遮挡

### 任务 14：店铺 / 平台 / 打印机页面

**文件**：`pages/store/`、`pages/platform/stores.wxss`、`pages/printer-pair/`

**步骤：**

1. `pages/store/store.wxss`：
   - 店铺头部 → `.glass-hero`
   - 功能卡 → `.glass-card`
   - 切换店铺弹窗 → `.glass-overlay`
   - 店铺码卡片 → `.glass-dense`
2. `pages/platform/stores.wxss`：
   - 列表卡 → `.glass-card`
   - 改名弹窗 → `.glass-overlay`
   - 危险操作按钮 → 柔化红渐变
3. `pages/printer-pair/`：
   - 状态卡、步骤卡 → `.glass-card`
   - 扫描按钮 → 主色渐变

### 任务 15：商品编辑 / 分类页面

**文件**：`pages/goods-edit/`、`pages/category/`

**步骤：**

1. `pages/goods-edit/goods-edit.wxss`：
   - 表单卡片 → `.glass-card`
   - 图片上传区 → `background: var(--bg-subtle)`
2. `pages/category/category.wxss`：
   - 分类列表行 → `.glass-dense`
   - 新增/编辑弹窗 → `.glass-overlay`

### 任务 16：全站硬编码色清理 ⭐

**步骤：**

1. 用 grep 搜索以下关键词，共约 63 处：
   - `#f0b4ae`（禁用按钮色）→ 替换为 Token
   - `#f0cfcb`（图表底）→ 替换为 Token
   - `#F3EFE7`（原暖米色）→ 替换为 `--bg-app`（`#F3F5FA`）
   - `background: #fff` 在卡片容器上 → 替换为对应 glass 类
2. 逐文件确认替换后布局未受影响
3. 最终 grep 确认无上述硬编码色残留

---

## P3 Web 后台（0.5–1 天）

### 任务 17：style.css Token 重写

**文件**：`web/style.css`

**步骤：**

1. `:root` 块替换为第 3 节同源 Token（单位改为 px，rpx→px 直接除以 2）
2. 新增 `body` 规则：底色渐变 + `::before/::after` 光晕（与小程序同参数）
3. 新增 `@supports not (backdrop-filter: blur(1px))` 兜底块：所有 `.glass-*` 类退化为纯色底

### 任务 18：Web 组件玻璃化

**文件**：`web/style.css`

**步骤：**

1. 侧边栏：深红实色 → Wash 层玻璃面板（白 40% + `blur(14px)` + 右侧 `--hairline` 描边）
2. 导航项：选中态改为主色 12% 胶囊 + 主色文字
3. 统计卡 / 功能卡：全部换 `.glass-card`；间距 20px
4. 主按钮：渐变底 + `--shadow-primary`；ghost 按钮用 `.glass-card` 样式
5. 输入框/下拉：Wash 层底 + 主色光环聚焦
6. 表格：外层 `.glass-card`；行 hover `rgba(255,255,255,.5)`；分割线 `--hairline`
7. 状态徽标：半透明语义色底
8. 弹窗：`.glass-overlay` + 模糊遮罩；toast 改深色半透明胶囊
9. 按钮按压缩放 `scale(0.98)`，时长 150ms

### 任务 19：Web 登录页改造

**文件**：`web/index.html`、`web/style.css`

**步骤：**

1. 登录区容器：居中 `.glass-hero` 卡 + 光晕背景
2. 补充 `<meta name="theme-color" content="#F3F5FA">`
3. 本地打开 `index.html`，Chrome/Safari 走查

### 任务 20：Web 响应式验证

**步骤：**

1. Chrome DevTools 断点切换：1440px / 1024px / 768px / 375px
2. 确认各断点下布局不变，仅视觉更新
3. Firefox 打开，确认兜底可读

---

## P4 回归与打磨（0.5 天）

### 任务 21：真机双端走查

**步骤：**

1. **iOS 真机**：打开所有页面，确认 `backdrop-filter` 效果完整，光晕可见
2. **Android 真机（含低端）**：确认不退化白块/黑块，文字可读，滚动流畅
3. **开单页专项**：快速上下滑动，确认无掉帧；点击按钮确认有按压反馈
4. 截图归档：每个主要页面保存一张对比截图（改版前/后）

### 任务 22：无障碍验证

**步骤：**

1. iOS 设置 → 显示与亮度 → 降低透明度：开启后确认玻璃类退化为不透明底色
2. Android 设置 → 辅助功能 → 去除动画：开启后确认所有动效静止
3. 使用微信开发者工具无障碍检查面板，确认对比度达标

### 任务 23：功能回归确认

**步骤：**
按以下顺序全流程走查，确认功能正常：

- [ ] 登录 / 注册 / 绑定三步 / 欢迎页
- [ ] 开单（创建订单 → 结算 → 完成）
- [ ] 订单列表 / 订单详情
- [ ] 商品管理（列表 / 编辑）
- [ ] 客户管理（列表 / 详情）
- [ ] 店铺管理（切换 / 改名）
- [ ] 平台管理（门店列表）
- [ ] 打印机配对
- [ ] 所有弹窗（确认 / 提示 / 编辑）
- [ ] 加载态、空状态、错误提示

### 任务 24：验收清单逐项打勾

参考 `docs/ui-redesign-plan.md` 第 9 节验收清单，逐项确认并打勾。

---

## 执行顺序与依赖关系

```
P0 任务1（Token） ──┐
P0 任务2（glass类）─┤──→ P0 任务3（光晕） ──→ P0 任务4（app.json）
P0 任务5（TabBar）─┘                       │
                                            ▼
                                     P0 任务6（背景清理）
                                            │
                                            ▼
                                     P0 任务7（试点验证）
                                            │
                            ┌───────────────┼───────────────┐
                            ▼               ▼               ▼
                         P1任务8          P1任务9         P1任务10
                      （注册页）         （欢迎页）       （商品页）
                            │               │               │
                            └───────────────┴───────┬───────┘
                                                    ▼
                                              P1任务11（开单页⭐）
                                                    │
                                    ┌─────────────────┼─────────────────┐
                                    ▼                 ▼                 ▼
                              P2任务12          P2任务13          P2任务14/15
                           （订单页面）        （客户页面）      （店铺/平台/打印机/编辑）
                                    │                 │                 │
                                    └─────────────────┴────────┬──────┘
                                                             ▼
                                                      P2任务16（硬编码清理⭐）
                                                             │
                                                             ▼
                                                          P3 全部任务
                                                             │
                                                             ▼
                                                          P4 回归打磨
```

---

## 注意事项

1. **所有 WXML 和 JS 文件不动**，只修改 `.wxss` / `.css`
2. **旧 class 名保留**：`.card`、`.btn-primary`、`.tag-*` 等类名不变，只改其 CSS 定义
3. **新开单页是最大风险点**：样式最多（459行），务必逐行确认布局未错位
4. **每阶段提交前**：跑 `npm run lint` + 开发者工具预览，确认无报错
5. **Web 端**：本地打开 `web/index.html` 即可预览，无需构建
