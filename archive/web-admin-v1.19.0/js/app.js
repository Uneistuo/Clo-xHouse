/**
 * 裁间 · 管理后台（Web 版）入口
 * 纯静态单页应用，直接调用云托管后端 API（后端已开启 CORS）
 * 页面：登录/注册 → 店铺初始化（未绑定店铺时）→ 仪表盘 / 商品 / 开单 / 订单 / 会员 / 店铺 / 平台
 */
/* eslint-env browser */

import { render } from './shell.js';
import { initTheme } from './theme.js';
import { initShortcuts } from './shortcuts.js';
import { bus } from './bus.js';
import { toast } from './ui.js';

/* ================= 错误边界：避免异常导致整页白屏 ================= */
let lastErrorAt = 0;

function reportError(err) {
  console.error('[裁间]', err);
  const now = Date.now();
  if (now - lastErrorAt < 1500) return; // 同一批异常只提示一次
  lastErrorAt = now;
  toast('页面出现异常，请刷新重试', true);
}

function renderSafe() {
  try {
    render();
  } catch (err) {
    reportError(err);
    const app = document.getElementById('app');
    if (app && !app.children.length) {
      app.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card error-boundary">
            <h1>页面加载失败</h1>
            <div class="sub">可能是网络波动或版本更新，请刷新后重试。</div>
            <button class="btn" type="button" onclick="location.reload()">重新加载</button>
          </div>
        </div>`;
    }
  }
}

window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));

/* ================= 主题 / 快捷键 / 重渲染 ================= */
bus.addEventListener('rerender', renderSafe);
initTheme();
initShortcuts();

/* ================= PWA ================= */
// 仅在 HTTPS / 本地调试环境注册，避免在内网 HTTP 下报错
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* 离线能力为增强项，注册失败不影响主流程 */
    });
  });
}

renderSafe();
