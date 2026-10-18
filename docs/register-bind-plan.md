# 注册 + 绑定流程改造方案（含欢迎页）

> 状态：**已实施（v1.15.0，2026-10-18）** ｜ 日期：2026-10-18 ｜ 范围：仅小程序端（`pages/`、`app.json`、`utils/api.ts`）
> 后端与 Web 后台**零改动**：复用现有 `/api/auth/register`、`/api/store/create`、`/api/store/bind` 接口。

---

## 1. 背景与目标

### 1.1 现状问题

- 登录与注册在**同一页面**用「登录 / 注册」分段切换承载，职责混杂；
- 注册账号与「创建 / 加入店铺」（绑定）被拆成两个页面，流程割裂、没有进程感；
- 新用户注册完成后直接进功能页，缺少完成反馈与欢迎仪式感。

### 1.2 改造目标（对应需求 1–5）

| #   | 需求                                                             | 落地方式                                                                                |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | 登录界面与注册+绑定界面分离                                      | 新增独立页面 `pages/register/register`                                                  |
| 2   | 登录界面不变，底部提示词跳转注册页                               | 登录页仅移除「注册」切换与表单，其余视觉/交互不动；底部「还没有账号？立即注册」跳转新页 |
| 3   | 注册+绑定页顶部显示步骤数（1、2、3）+ 进度条，下方按步骤切换内容 | 步骤条（圆形节点 + 连接进度线）+ 三步内容区                                             |
| 4   | 设计欢迎界面                                                     | 新增 `pages/welcome/welcome`                                                            |
| 5   | 首次注册完成后 → 欢迎页 → 功能页                                 | 第 3 步「进入裁间」→ `reLaunch` 欢迎页 →「开始使用」→ `reLaunch` 首页                   |

---

## 2. 现状梳理

### 2.1 相关页面与职责

| 页面        | 路径                | 现状职责                                                        |
| ----------- | ------------------- | --------------------------------------------------------------- |
| 登录 / 注册 | `pages/login/login` | 分段切换两种模式；注册成功按 `storeId` 决定去向                 |
| 开始使用    | `pages/setup/setup` | 创建店铺 / 凭店铺码加入（即「绑定」），登录后未绑定用户由此进入 |

### 2.2 现有跳转链路

```
登录页(注册模式) ──注册成功──▶ token(storeId=0)
    ├─ 已有 storeId ─▶ reLaunch 首页
    └─ 无 storeId    ─▶ reLaunch setup ──创建/加入成功(新token)──▶ reLaunch 首页

登录成功：
    ├─ 已绑定  ─▶ reLaunch 首页
    └─ 未绑定  ─▶ reLaunch setup

未绑定兜底（共 4 处）：
    pages/index/index.js   onShow 检测 storeId=0 ─▶ reLaunch setup
    pages/store/store.js   onShow 检测 storeId=0 ─▶ redirectTo setup
    utils/api.ts           接口返回 code=1001     ─▶ reLaunch store 页（再由上条转 setup）
    （登录成功未绑定，见上）
```

### 2.3 复用接口（后端零改动）

| 接口                      | 入参                     | 成功返回（data）                                          |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| `POST /api/auth/register` | `{ username, password }` | `{ token, admin: { storeId: 0, role: 'staff', ... } }`    |
| `POST /api/store/create`  | `{ storeName }`          | `{ token, admin: { storeId, role: 'owner', storeName } }` |
| `POST /api/store/bind`    | `{ code }`               | `{ token, admin: { storeId, role: 'staff', storeName } }` |

> 频控提醒：register 接口与登录共用 15 分钟 / 10 次 / IP 限制，超限返回 429，页面沿用现有统一提示。

### 2.4 复用基础设施

- `utils/api.ts`：`request()` 统一 400/业务错误 toast；401 跳登录；`code=1001`（未绑定）兜底跳转（本次需改目标页）；
- `utils/dialog.ts`：`toast()` / `confirm()`；
- 设计变量（`styles/tokens.wxss`）：`--primary`、`--primary-dark`、`--bg-app`、`--bg-card`、`--bg-subtle`、`--text-1/2/3`、`--border`、`--danger`、`--radius-pill`、`--shadow-1/2` 等；
- 图标（`styles/icons.wxss`）：`icon-check-circle`、`icon-store`、`icon-package`、`icon-receipt`、`icon-shirt`、`icon-lock` 等（欢迎页引导项直接复用）；
- 登录页 `.field`（输入框）、`.login-btn`（按钮 loading）样式片段将被复制到新页面，保证观感一致。

---

## 3. 目标流程总览

```
                      ┌───────────────────────────────┐
 登录页 ─「立即注册」▶ │  注册+绑定页 pages/register    │
                      │                               │
 登录成功未绑定 ─────▶ │ 第1步 注册账号（mode=register）│── /api/auth/register ──▶ token(storeId=0)
 （reLaunch?mode=bind）│ 第2步 绑定店铺（创建 / 加入）  │── /api/store/create|bind ─▶ 新 token(storeId=N)
                      │ 第3步 完成确认                 │
                      └───────────────┬───────────────┘
                                      │
              mode=register（新注册） │ mode=bind（老用户补绑定）
                                      ▼
                      ┌──────────────────────┐        ┌───────────────┐
                      │ 欢迎页 pages/welcome │──────▶ │ 首页（功能页） │
                      │   「开始使用」        │        └───────────────┘
                      └──────────────────────┘
                                      ▲
                              直接 reLaunch 首页（不经过欢迎页）
```

规则汇总：

- **欢迎页仅注册流程（mode=register）完成后展示**；老用户补绑定（mode=bind）完成后直接进首页；
- 三步完成前不进入任何功能页；任意一步失败停留当前步。

---

## 4. 页面设计

### 4.1 登录页 `pages/login`（改造：只保留登录）

**视觉不变**：品牌区、背景光晕、卡片、账号/密码输入、按钮、底部提示，全部保持现状。

**移除**：

- 顶部「登录 / 注册」分段切换（`.seg`）与注册模式相关表单（确认密码、注册说明）；
- `login.js` 中的 `mode` / `confirmPassword` / `switchMode` / 注册校验分支；
- `login.wxss` 中 `.seg`、`.register-hint` 样式（可选清理，不影响登录视觉）。

**保留 / 修改**：

| 项                  | 现状                                 | 改后                                                                     |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| 底部提示            | 「还没有账号？立即注册」切换本页模式 | `wx.navigateTo({ url: '/pages/register/register' })`                     |
| 登录成功去向        | 已绑定→首页；未绑定→setup            | 已绑定→首页；**未绑定→`reLaunch('/pages/register/register?mode=bind')`** |
| 登录校验 / 记住账号 | 现有逻辑                             | 不变                                                                     |

### 4.2 注册+绑定页 `pages/register`（新增）

#### 4.2.1 入口与参数

| 入口                     | 跳转方式                                         | 起始步骤                                             |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| 登录页底部「立即注册」   | `navigateTo('/pages/register/register')`         | 第 1 步（若检测到未完成的注册则直接第 2 步，见 5.1） |
| 登录成功但未绑定         | `reLaunch('/pages/register/register?mode=bind')` | 第 2 步（第 1 步显示为已完成）                       |
| 未绑定兜底跳转（见 4.4） | `reLaunch('...?mode=bind')`                      | 第 2 步                                              |

> `mode` 语义：`register`（默认，走完整注册流程）；`bind`（账号已注册，仅补绑定）。

#### 4.2.2 页面结构（自上而下）

1. **顶部标题区**：小号品牌「裁 间」+ 当前步骤标题 + 一句话副标题；
2. **步骤条**：`1 → 2 → 3` 节点 + 进度连接线；
3. **内容卡片**：按 `step` 渲染对应步骤的表单 / 确认信息；
4. **底部操作区**：mode=register →「已有账号？返回登录」；mode=bind →「退出登录」。

#### 4.2.3 步骤条设计（对应需求 3）

- 3 个圆形节点显示数字 1/2/3，**完成节点显示 ✓**；节点间两段连接线作为进度条；
- 状态样式：
  - 已完成：主色渐变填充（`--primary → --primary-dark`）+ 白字；
  - 当前：主色描边 + 浅色底 + 轻微放大（scale 1.06）与光晕；
  - 未开始：浅灰底 + 灰字；
- 连接线填充规则：`step=2` 填充第 1 段；`step=3` 两段全填充；
- 节点下方小字：`注册账号` / `绑定店铺` / `完成`。

结构示意（wxml）：

```xml
<view class="steps">
  <view class="step-node {{step > 1 ? 'done' : ''}} {{step === 1 ? 'active' : ''}}">
    <text wx:if="{{step > 1}}" class="icon icon-check-circle"></text>
    <text wx:else>1</text>
  </view>
  <view class="step-line {{step > 1 ? 'fill' : ''}}"></view>
  <view class="step-node {{step > 2 ? 'done' : ''}} {{step === 2 ? 'active' : ''}}">2</view>
  <view class="step-line {{step > 2 ? 'fill' : ''}}"></view>
  <view class="step-node {{step === 3 ? 'active' : ''}}">3</view>
</view>
<view class="steps-labels">
  <text>注册账号</text><text>绑定店铺</text><text>完成</text>
</view>
```

#### 4.2.4 三步内容

**第 1 步 · 注册账号**（仅 mode=register）

- 字段：账号（3–20 位字母/数字/下划线）、密码（6–32 位）、确认密码；
- 校验规则与错误文案**照搬现状注册模式**（错误定位到字段下方 `.field-tip`）；
- 按钮「注 册」→ `POST /api/auth/register`；
- 成功：保存 `token` / `adminInfo`（此时 storeId=0）→ 切到第 2 步，轻提示「注册成功，继续绑定店铺」；
- 「该账号已被注册」：字段红框 + tip + 提供「去登录」链接（`reLaunch` 登录页）；
- 429 / 网络错误：沿用现有统一 toast，停留本步。

**第 2 步 · 绑定店铺**（所有入口）

- 分段切换「创建新店铺 / 加入已有店铺」（复用 setup 页 `.segmented` 样式）；
- 创建分支：店铺名称（≤30 字）+ 说明「创建后您即店主，将获得专属店铺码供员工绑定」→ `POST /api/store/create`；
- 加入分支：8 位店铺码（自动大写，≤8 位）+ 说明「绑定后商品、订单数据自动同步到您的账号」→ `POST /api/store/bind`；
- 成功：更新 `token` / `adminInfo`（此时带 storeId）→ 切到第 3 步；
- 失败（名称重复 / 店铺码不存在等）：toast 后端 message，停留本步；措辞与后端返回保持一致；
- 「上一步」仅当本次流程完成过第 1 步时显示（mode=bind 不显示）。

**第 3 步 · 完成确认**

- 顶部 ✓ 成功标记（图标 `icon-check-circle` + 主色，入场动画）；
- 信息卡：账号 / 店铺名称 / 角色（店主 ｜ 员工）；
- 角色提示行：
  - 店主：「你是店铺的创建者，可在“我的”页查看店铺码邀请员工」；
  - 员工：「已加入店铺，商品与订单数据已同步」；
- 主按钮：
  - mode=register →「进入裁间」→ `reLaunch('/pages/welcome/welcome')`；
  - mode=bind →「进入应用」→ `reLaunch('/pages/index/index')`。

#### 4.2.5 数据与核心方法（实现参考）

```js
data: {
  mode: 'register',        // register / bind
  step: 1,                 // 1 / 2 / 3
  resumeHint: '',          // 「继续为账号 xxx 完成绑定」等提示
  bindMethod: 'create',    // create / join
  username: '', password: '', confirmPassword: '',
  storeName: '', code: '',
  usernameError: '', passwordError: '', confirmError: '',
  loading: false,
  adminInfo: {}            // 成功后用于第 3 步信息卡
}
```

方法：`onLoad(options)`（判定 mode / 起始步 / 恢复逻辑）、`goStep(n)`、`handleRegister()`、`handleCreate()`、`handleJoin()`、`handleDone()`、`handleLogout()`（mode=bind）、`resetRegister()`（“注册新账号”）、`goLogin()`、各输入与校验方法。

#### 4.2.6 交互细节

- **防重复提交**：`loading` 锁 + 按钮 loading 态（复用 `.btn-loading`）；
- **数据保留**：步骤切换不重置已填内容；仅「注册新账号 / 返回登录 / 退出登录」时重置；
- **系统返回键**：由于入口用 `navigateTo`，系统返回 = 退出注册流程回登录页；已完成的步骤（如账号已注册）保留在本地，重新进入可续（见 5.1）；mode=bind 入口为 `reLaunch`，无返回箭头，提供「退出登录」；
- **导航标题**：`裁间`（与登录页一致）。

### 4.3 欢迎页 `pages/welcome`（新增，对应需求 4/5）

- **入口**：仅注册流程第 3 步 `reLaunch` 进入；不做本地持久化标记（用户杀进程后重开直接进首页，无需再展示）；
- **页面守卫**（onLoad）：无 `token` → `reLaunch` 登录页；`storeId=0` → `reLaunch` 注册页（mode=bind）；
- **设计**（延续登录页语言：暖色底 + 光晕 + 品牌字）：
  - 上部：品牌「裁 间」+ 成功动效（圆环描边动画 + ✓ 图标）；
  - 主标题「欢迎来到裁间」；副标题「{店铺名} 已就绪」；一行「{username}，你好」；
  - 中部功能引导（图标 + 短句，各一行）：
    - `icon-package` 商品管理：拍照上传，库存随时掌握；
    - `icon-receipt` 开单收银：扫码开单，账目清晰；
    - `icon-clipboard` 订单与经营：订单、销售额一目了然；
  - 主按钮「开始使用」→ `reLaunch('/pages/index/index')`；
  - 底部小字：「店铺信息可在“我的”页随时管理」；
- **动效**：元素淡入上移依次出现（间隔约 120ms），纯 WXSS 动画，不引入第三方库。

### 4.4 未绑定兜底入口统一（4 处改动）

| 位置                                  | 现状                                | 改后                                              |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `pages/index/index.js` onShow         | `reLaunch` → `/pages/setup/setup`   | `reLaunch` → `/pages/register/register?mode=bind` |
| `pages/store/store.js` onShow         | `redirectTo` → `/pages/setup/setup` | `reLaunch` → `.../register?mode=bind`             |
| `utils/api.ts`（`code===1001`）       | `reLaunch` → `/pages/store/store`   | `reLaunch` → `.../register?mode=bind`             |
| `pages/login/login.js` 登录成功未绑定 | `reLaunch` → `/pages/setup/setup`   | `reLaunch` → `.../register?mode=bind`             |

### 4.5 退役 `pages/setup`

- 从 `app.json` 的 `pages` 中移除 `pages/setup/setup`，并删除 4 个页面文件；
- 全仓检索确认无残留引用（含注释、文档）；
- 说明：Web 后台（`web/app.js`）有独立的 `code=1001` 处理，属于另一端，本次不动。

---

## 5. 边界与异常情况

**5.1 注册中途退出（已完成第 1 步，token 存在且 storeId=0）**

- 重新从登录页点「立即注册」进入注册页时：**直接进入第 2 步**，顶部提示「检测到未完成的注册：{username}」，底部提供「注册新账号」（清空 token 与表单，回到第 1 步）；
- 或以该账号正常登录：登录成功 → mode=bind 直达第 2 步。

**5.2 已注册未绑定老用户**（被移出店铺 / 主动退出店铺 / 上次未完成绑定）

- 任意触发兜底（4.4）→ 注册页第 2 步；完成后进首页（**不经过欢迎页**）。

**5.3 常见错误路径**（全部沿用后端 message + 统一 toast，停留当前步）

- 账号已注册（step1）；店铺名重复、店铺码不存在（step2）；429 频控；网络失败（`request` 自带重试与提示）。

**5.4 状态以服务端为准**：极端情况下（本地写入异常等），重新登录即可恢复；欢迎页被分享 / 直达时由守卫自动重定向。

**5.5 重复点击**：所有提交按钮 `loading` 锁。

---

## 6. 验收清单

- [ ] 登录页不再出现「注册」切换与注册表单；登录功能、样式与改造前一致
- [ ] 登录页底部「还没有账号？立即注册」进入注册+绑定页第 1 步
- [ ] 注册+绑定页顶部步骤条正确显示 1/2/3 与进度（切换步骤时进度线同步填充）
- [ ] 第 1 步：校验、注册成功、重复账号提示（含「去登录」）、429 提示均正常
- [ ] 第 2 步：创建店铺 / 加入店铺两条分支的成功与失败路径均正常
- [ ] 第 3 步：账号、店铺名称、角色展示正确
- [ ] 首次注册完成 → 欢迎页 →「开始使用」→ 首页（返回键无法回到注册流程）
- [ ] 已注册未绑定用户登录 → 注册页第 2 步；完成后**直接进首页**
- [ ] 中途退出后重新进入可续注册（第 2 步 + 恢复提示 + 「注册新账号」）
- [ ] `pages/setup` 移除后全流程无死角（首页 / 我的页 / 接口 1001 兜底均指向新页面）
- [ ] 微信开发者工具真机预览回归：登录 → 注册 → 绑定 → 欢迎 → 首页 → 退出登录

---

## 7. 实施顺序（建议）

1. 新建 `pages/register` 骨架 + 步骤条（静态样式）；
2. 第 1 步接入 `/api/auth/register`（含错误处理与校验）；
3. 第 2 步迁移 `pages/setup` 的创建 / 加入逻辑（样式复制 `.segmented`）；
4. 第 3 步完成确认页；
5. 新建欢迎页 `pages/welcome`；
6. 登录页精简 + 4 处兜底跳转统一 + 退役 `pages/setup`；
7. 全流程回归（6. 验收清单）+ `npm run lint` / `npm run typecheck`（新增页面为 JS，遵循现有页面规范）。

---

## 8. 文件变更清单

| 操作 | 文件                                                 | 说明                                                       |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------- |
| 新增 | `pages/register/register.js` `.wxml` `.wxss` `.json` | 注册+绑定页（三步 + 步骤条）                               |
| 新增 | `pages/welcome/welcome.js` `.wxml` `.wxss` `.json`   | 欢迎页                                                     |
| 修改 | `app.json`                                           | 注册 `pages/register`、`pages/welcome`；移除 `pages/setup` |
| 修改 | `pages/login/login.js`                               | 移除注册逻辑；底部跳转；未绑定去向改注册页                 |
| 修改 | `pages/login/login.wxml`                             | 移除分段切换与注册表单；底部改跳转链接                     |
| 修改 | `pages/login/login.wxss`                             | 清理 `.seg` / `.register-hint`（可选）                     |
| 修改 | `pages/index/index.js`                               | 兜底跳转改为注册页（mode=bind）                            |
| 修改 | `pages/store/store.js`                               | 兜底跳转改为注册页（mode=bind）                            |
| 修改 | `utils/api.ts`                                       | `code=1001` 跳转目标改为注册页（mode=bind）                |
| 删除 | `pages/setup/setup.js` `.wxml` `.wxss` `.json`       | 功能并入注册页                                             |
| 可选 | `README.md`                                          | 实现完成后补版本历史（版本号自定）                         |

**不改动**：`backend/`（接口复用）、`web/`（Web 后台独立处理）。

---

## 9. 暂不包含 / 后续可选

- 微信一键登录 / 手机号绑定（与本次注册体验无关，独立需求）；
- 欢迎页的“仅首次展示”持久化标记（当前由流程保证，必要时再加 `welcome_shown` 标记）；
- 首单引导浮层（newbie tips 分步高亮）；
- 公共样式 / 组件抽取：本次为控制影响面，样式片段复制到新页面，不重构登录页样式文件。

---

## 10. 待确认事项

出现以下情况请直接回复调整，确认后即可进入实施：

1. 步骤命名与文案（注册账号 / 绑定店铺 / 完成）是否需要调整；
2. 第 2 步「创建 / 加入」两个分支是否保留现有说明文案；
3. 欢迎页引导条目（商品管理 / 开单收银 / 订单与经营）是否合适。
