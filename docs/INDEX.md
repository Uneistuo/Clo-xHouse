# 📋 「裁间」项目 — 设计 + 优化方案总览

> 更新日期：2026-10-27 | 设计方向：清透质感 × B端效率

---

## 文档索引

| 文档           | 路径                                | 内容                     |
| -------------- | ----------------------------------- | ------------------------ |
| 设计方案 v2.0  | `docs/DESIGN-SPEC-V2.md`            | 小程序端完整设计规范     |
| Web 设计方案   | `docs/DESIGN-SPEC-WEB.md`           | Web 管理后台设计规范     |
| 小程序优化方案 | `docs/OPTIMIZATION-PLAN-MINIAPP.md` | 性能 + 体验优化 14 项    |
| Web 优化方案   | `docs/OPTIMIZATION-PLAN-WEB.md`     | 架构 + 体验优化 12 项    |
| UI 审核报告    | `UI-AUDIT-REPORT.md`                | 40 处样式问题修复清单    |
| 首轮审查报告   | `docs/REVIEW-REPORT-2026-10-26.md`  | 历史基线（问题清单来源） |
| 二次审查报告   | `docs/REVIEW-REPORT-2026-10-27.md`  | 整改复核结论与残余风险   |

---

## 设计方案核心结论

### 小程序端

| 维度       | 评分       | 说明                                                       |
| ---------- | ---------- | ---------------------------------------------------------- |
| 设计语言   | ⭐⭐⭐⭐⭐ | Glassmorphism × Soft UI，五档玻璃层级成熟                  |
| Token 体系 | ⭐⭐⭐⭐   | 四维度完整，字号档位已补齐（`--font-xs-sm` / `--font-h4`） |
| 无障碍     | ⭐⭐⭐⭐   | 三色降级完整，可增强动态类型支持                           |
| 品牌识别   | ⭐⭐⭐⭐   | 「裁间」命名统一，欢迎页脉冲动画有记忆点                   |
| 交互细节   | ⭐⭐⭐⭐⭐ | Dock 栏拼接、规格记忆、错峰动画均优秀                      |

**已修复：40 处样式问题（间距/圆角/字号，见 `UI-AUDIT-REPORT.md`）**

### Web 端

| 维度     | 评分       | 说明                                                |
| -------- | ---------- | --------------------------------------------------- |
| 设计语言 | ⭐⭐⭐⭐⭐ | 与小程序完全对齐，Token 值一致                      |
| 布局系统 | ⭐⭐⭐⭐   | 侧边栏 + 主内容区成熟，支持 64px 折叠态与状态持久化 |
| 组件体系 | ⭐⭐⭐⭐   | 按钮/卡片/表单/弹窗完整                             |
| 响应式   | ⭐⭐⭐⭐   | ≤768px 适配良好                                     |
| 无障碍   | ⭐⭐⭐⭐⭐ | 三色 + @supports 双保险，比小程序更完备             |

**已优化：样式拆分、图标共享、暗色模式、侧边栏折叠、PWA、JS 模块化、快捷键、面包屑、小票打印、开单分页、图片懒加载**  
**暂缓：表格虚拟化、Vite/TypeScript 迁移、E2E 测试**

---

## 优化方案核心结论

### 小程序端优化（4 阶段）

```
P0（1次迭代）：
  ✅ 开单页分页加载（已实现，需验证）
  ✅ 图片懒加载占位
  ✅ P0 样式修复（40处）
  ✅ setData 精确路径更新（数量增减；新增/删除仍整数组写入）

P1（2-3次迭代）：
  ✅ 图片压缩上传（utils/api.ts：>1200px 或 >800KB 压至质量 80）
  ✅ 无障碍标签（TabBar + 15/15 页面 ARIA，真机走查待做）
  ❌ recycle-view 虚拟列表（未开始 / 暂缓）
  ⏸ 分包加载配置（暂缓，源码约 521KB / 0.50MB，远低于 2MB 主包限制）

P2（3-4次迭代）：
  → Skyline 渲染引擎迁移（高风险，暂缓）
  ❌ 深色模式（未开始 / 暂缓）
  ✅ 骨架屏组件化

P3（持续）：
  → 性能监控接入
  → 内存泄漏检测
  → 真机性能测试
```

### Web 端优化（4 阶段）

```
P0（1次迭代）：
  ✅ 提取图标为独立 icons.css
  ✅ 品牌名统一（「裁间」）
  ✅ 开单页分页（pageSize=30 + 加载更多）

P1（2-3次迭代）：
  ✅ CSS 拆分（base / theme / layout / components / pages / responsive / print）
  ✅ 侧边栏折叠（桌面态 64px，状态持久化）
  ✅ 暗色模式（手动 + 系统跟随）
  ✅ JS 模块化（原生 ES Modules，16 个模块，无构建）

P2（3-4次迭代）：
  ✅ PWA 支持（manifest + Service Worker v5 + 离线外壳）
  ✅ 键盘快捷键（Ctrl/Cmd+K、S、N、Alt+1~7、?、Esc）
  ✅ 面包屑导航 + 错误边界
  ✅ 订单小票打印（print.css）
  ✅ 图片懒加载（商品/开单图片 loading="lazy"）
  → 表格虚拟化（数据量 < 200 行，暂缓）

P3（持续）：
  ✅ ESLint + Prettier（lint / lint:web / format:check 均通过）
  → Vite 构建工具（与零构建部署目标冲突，暂缓）
  → TypeScript 迁移（暂缓）
  → E2E 测试
```

---

## GitHub 学习成果汇总

### 调研的优秀项目（20+ 个）

**设计系统类：**

- `themesberg/glass-ui` (407★) — 五档玻璃命名规范
- `JUNGHERZ/GlassKit` — iOS Liquid Glass 灵感
- `getaskclaw/aqua-weapp-ui` — 微信小程序 Liquid Glass 组件库
- `Tencent/tdesign-miniprogram` (1689★) — CSS Variables 主题定制
- `fanxeon/poemui-miniprogram` — 5 个布尔开关控制视觉风格
- `he2799388344-ctrl/schoolv2` — tokengov 多端 Token 对齐机制

**性能优化类：**

- `wechat-miniprogram/recycle-view` — 微信官方虚拟列表
- `zhanghaoxu/wechat-long-list-chunk` — 不定高虚拟列表
- `sarahxu0205/myskills` — 小程序性能优化 Skill
- `wechat-miniprogram/awesome-skyline` — Skyline 渲染引擎最佳实践

**B端/收银类：**

- `renkunx/pos-app-demo` — 状态驱动屏幕切换
- `uvindu94/pos` — Bento Grid 仪表盘 + glassmorphism
- `Charith-Dhananjaya/saas-pos-system` — Glass Dashboard
- `PAkash7/asc-manage` — Glassmorphism POS

**组件库类：**

- `wechat-miniprogram/weui-miniprogram` (2407★) — 官方组件库
- `wot-ui/wot-ui` (217★) — AI 友好的 uni-app 组件库
- `diandian123/meet-ui` (96★) — 页面载入生命周期规范

---

## 下一步行动建议

### 已完成（P0/P1/P2 主体）

1. ✅ UI-AUDIT-REPORT 中 40 处样式问题
2. ✅ Web 端图标独立为 `web/icons.css`（与小程序共享源文件）
3. ✅ 品牌名统一为「裁间」
4. ✅ Web 端 CSS / JS 拆分、暗色模式、侧边栏折叠、PWA
5. ✅ Web 端键盘快捷键、面包屑、订单小票打印、错误边界
6. ✅ Web 端开单分页、图片懒加载
7. ✅ 小程序图片压缩上传、15 个页面无障碍标签

### 未开始 / 暂缓（不纳入本轮完成项）

1. ❌ 小程序 recycle-view 虚拟列表（无依赖、无组件代码）
2. ⏸ 小程序分包加载（源码约 521KB / 0.50MB，暂不实施）
3. ❌ 小程序完整深色模式（无主题切换代码）
4. ⏸ Web 表格虚拟化（仅在单页超过 200 行时考虑）

### 待真机 / 真实账号复验

1. 小程序开单分页、图片懒加载与 15 页 ARIA 标签的真机表现
2. Web 登录后的商品、开单、订单、会员、店铺、平台流程

### 暂缓（高成本 / 高收益不确定）

1. Skyline 渲染引擎迁移（需整套页面回归）
2. Web Vite + TypeScript 迁移（与 GitHub Pages 零构建目标冲突）
3. E2E 测试体系（当前以静态 smoke test 为主）

---

_方案汇总 | 2026-10-27_
