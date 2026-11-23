/**
 * 应用外壳：登录 / 店铺初始化 / 侧边栏与内容区
 */
/* eslint-env browser */

import { $, $$, esc } from './utils.js';
import { NAV_ITEMS } from './config.js';
import { token, admin, ensurePlatformFlag, clearAuth, saveAuth, api } from './store.js';
import { toast, setBtnLoading } from './ui.js';
import { applySidebarCollapsed, readSidebarCollapsed, syncThemeButtons } from './theme.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderGoods } from './pages/goods.js';
import { renderBilling } from './pages/billing.js';
import { renderOrders } from './pages/orders.js';
import { renderCustomers } from './pages/customers.js';
import { renderStore } from './pages/shop.js';
import { renderPlatform } from './pages/platform.js';

function render() {
  const root = $('#app');
  root.classList.add('page-fade');
  const authMode = !token || !admin || !admin.storeId;
  document.body.classList.toggle('auth-mode', authMode);
  if (!token || !admin) {
    renderAuth(root);
    root.classList.remove('page-fade');
    return;
  }
  if (!admin.storeId) {
    renderSetup(root);
    root.classList.remove('page-fade');
    return;
  }
  // 先探测平台管理员身份（缓存），再渲染主导航
  ensurePlatformFlag().then(() => {
    renderMain(root);
    root.classList.remove('page-fade');
  });
}

window.addEventListener('hashchange', () => {
  if (token && admin && admin.storeId) render();
});

const PAGE_LABELS = {
  '#/dashboard': '首页',
  '#/goods': '商品管理',
  '#/billing': '开单',
  '#/orders': '订单管理',
  '#/customers': '会员管理',
  '#/store': '店铺管理',
  '#/platform': '平台管理'
};

function breadcrumbHtml(cur) {
  const label = PAGE_LABELS[cur] || '首页';
  if (cur === '#/dashboard') return `<span aria-current="page">${esc(label)}</span>`;
  return `<a href="#/dashboard">首页</a><span class="crumb-sep" aria-hidden="true">/</span><span aria-current="page">${esc(label)}</span>`;
}

/* ================= 登录 / 注册 ================= */
function renderAuth(root) {
  let mode = 'login';
  const draw = () => {
    const isLogin = mode === 'login';
    root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>裁间</h1>
          <div class="sub">${isLogin ? '管理后台 · 网页版' : '注册商家账号'}</div>
          <form id="auth-form">
            <label class="field"><span class="lbl">账号</span><input name="username" placeholder="3-20 位字母 / 数字 / 下划线" autocomplete="username" required></label>
            <label class="field"><span class="lbl">密码</span><input name="password" type="password" placeholder="6-32 位" autocomplete="current-password" required></label>
            <button class="btn" type="submit">${isLogin ? '登 录' : '注 册'}</button>
          </form>
          <div class="auth-switch">
            ${isLogin ? '还没有账号？<a id="mode-link">立即注册</a>' : '已有账号？<a id="mode-link">返回登录</a>'}
          </div>
        </div>
      </div>`;
    $('#mode-link').addEventListener('click', () => {
      mode = isLogin ? 'register' : 'login';
      draw();
    });
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = $('button[type=submit]', e.target);
      setBtnLoading(btn, true);
      try {
        const data = await api('/api/auth/' + (isLogin ? 'login' : 'register'), {
          method: 'POST',
          data: { username: fd.get('username').trim(), password: fd.get('password') }
        });
        saveAuth(data.token, data.admin);
        toast(isLogin ? '登录成功' : '注册成功');
        location.hash = data.admin.storeId ? '#/dashboard' : '#/setup';
        render();
      } catch (e) {
        /* toast 已在 api 中统一弹出 */
      }
      setBtnLoading(btn, false);
    });
  };
  draw();
}

/* ================= 店铺初始化（创建 / 绑定） ================= */
function renderSetup(root) {
  const draw = () => {
    root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>加入店铺</h1>
          <div class="sub">注册成功，创建店铺或使用店铺码加入</div>
          <form id="create-form">
            <label class="field"><span class="lbl">创建新店铺</span><input name="storeName" placeholder="店铺名称（最多 30 字）" maxlength="30" required></label>
            <button class="btn" type="submit">创建店铺</button>
          </form>
          <hr style="border:none;border-top:1px dashed var(--divider);margin:22px 0">
          <form id="bind-form">
            <label class="field"><span class="lbl">使用店铺码加入</span><input name="code" placeholder="8 位店铺码" maxlength="8" required></label>
            <button class="btn ghost" type="submit">加入店铺</button>
          </form>
          <div class="auth-switch"><a id="logout-link">退出登录</a></div>
        </div>
      </div>`;
    $('#logout-link').addEventListener('click', () => {
      clearAuth();
      render();
    });
    $('#create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('storeName').trim();
      try {
        const data = await api('/api/store/create', { method: 'POST', data: { storeName: name } });
        saveAuth(data.token, data.admin);
        toast('店铺创建成功');
        location.hash = '#/dashboard';
        render();
      } catch (e2) {}
    });
    $('#bind-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = new FormData(e.target).get('code').trim();
      try {
        const data = await api('/api/store/bind', { method: 'POST', data: { code } });
        saveAuth(data.token, data.admin);
        toast('已加入店铺');
        location.hash = '#/dashboard';
        render();
      } catch (e2) {}
    });
  };
  draw();
}

/* ================= 主框架（侧边栏 + 内容区） ================= */
function renderMain(root) {
  const items = NAV_ITEMS.filter((n) => !n.platformOnly || admin.isPlatform);
  const cur = items.some((n) => n.hash === location.hash) ? location.hash : '#/dashboard';
  if (location.hash !== cur) location.hash = cur;
  const groups = [];
  items.forEach((n) => {
    let g = groups.find((x) => x.name === n.group);
    if (!g) {
      g = { name: n.group, items: [] };
      groups.push(g);
    }
    g.items.push(n);
  });
  root.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand" aria-label="裁间 · 管理后台">
          <span class="brand-logo" aria-hidden="true">裁</span>
          <span class="brand-text">裁间 · 管理后台</span>
        </div>
        <nav aria-label="主导航">
          ${groups
            .map(
              (g) => `
            <div class="nav-group">
              <div class="nav-group-title">${esc(g.name)}</div>
              ${g.items
                .map(
                  (n) =>
                    `<a href="${n.hash}" class="${n.hash === cur ? 'active' : ''}" title="${esc(n.label)}"${
                      n.hash === cur ? ' aria-current="page"' : ''
                    }><span class="icon ${n.icon}" aria-hidden="true"></span><span class="nav-label">${esc(n.label)}</span></a>`
                )
                .join('')}
            </div>`
            )
            .join('')}
        </nav>
        <div class="side-user">
          <div class="side-user-info">
            <div class="store-name">${esc(admin.storeName || '我的店铺')}</div>
            <div>${esc(admin.username)} · ${admin.role === 'owner' ? '店主' : '员工'}</div>
          </div>
          <div class="side-actions">
            <button class="icon-btn" data-theme-toggle type="button" aria-label="切换主题">
              <span class="icon icon-moon" aria-hidden="true"></span>
            </button>
            <button class="icon-btn" id="btn-sidebar-toggle" type="button" aria-expanded="true" aria-label="收起侧边栏">
              <span class="icon icon-panel-left" aria-hidden="true"></span>
            </button>
            <button class="btn small light" id="btn-logout" type="button" title="退出登录">
              <span class="icon icon-log-out" aria-hidden="true"></span><span class="btn-text">退出登录</span>
            </button>
          </div>
        </div>
      </aside>
      <main class="main">
        <nav class="breadcrumb" aria-label="面包屑导航">${breadcrumbHtml(cur)}</nav>
        <div id="view"></div>
      </main>
    </div>`;
  applySidebarCollapsed(readSidebarCollapsed());
  syncThemeButtons();
  $('#btn-logout').addEventListener('click', () => {
    clearAuth();
    location.hash = '';
    render();
  });
  const view = $('#view');
  if (cur === '#/dashboard') renderDashboard(view);
  else if (cur === '#/goods') renderGoods(view);
  else if (cur === '#/billing') renderBilling(view);
  else if (cur === '#/orders') renderOrders(view);
  else if (cur === '#/customers') renderCustomers(view);
  else if (cur === '#/store') renderStore(view);
  else if (cur === '#/platform') renderPlatform(view);
}

export { render, renderAuth, renderSetup, renderMain };
