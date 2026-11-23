# Web 管理后台归档（v1.19.0）

本目录是 **2026-11-22** 将原 `web/` 静态管理后台整体迁移至此的完整备份，用于在需要时恢复或参考。

## 归档内容

- `index.html`：原管理后台入口
- `js/`：16 个原生 ES Module（shell / store / ui / pages ...）
- `styles/`：base / theme / layout / components / pages / responsive / print 七层样式
- `icons.css`：由 `scripts/build-icons.js` 生成的共享图标
- `manifest.json`、`sw.js`：PWA 清单与 Service Worker（`cj-admin-v5`）
- `assets/`：PWA 图标与 favicon

## 如何恢复

```bash
# 1. 备份当前展示页（可选）
mv web web-showcase

# 2. 把归档内容移回 web/
mv archive/web-admin-v1.19.0 web

# 3. 提交并推送，GitHub Actions 会自动重新发布
git add web
git commit -m "chore: restore web admin from archive"
git push
```

> 注意：GitHub Pages 工作流只发布 `web/` 目录，本归档目录不会被部署到线上。
>
> 恢复后请确认 `web/icons.css` 与 `styles/icons.source.json` 同步；如有改动可执行 `npm run icons:build` 重新生成。
