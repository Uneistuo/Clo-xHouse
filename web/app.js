/**
 * 服装店管理系统 Web 版
 * 纯静态单页应用，直接调用云托管后端 API（后端已开启 CORS）
 * 页面：登录/注册 → 店铺初始化（未绑定店铺时）→ 仪表盘 / 商品 / 开单 / 订单 / 店铺
 */
'use strict';

/* ================= 基础配置与工具 ================= */
// 云托管后端公网地址（与小程序 utils/api.js 中一致）
const BASE_URL = 'https://express-3how-324239-10-1501349049.sh.run.tcloudbase.com';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fixImg = (u) => (!u ? '' : (/^https?:\/\//.test(u) ? u : BASE_URL + u));
const firstImg = (s) => (s || '').split(',')[0];

// 订单状态字典（与后端一致）
const STATUS = { pending: '待收款', paid: '已收款', done: '待售后', cancelled: '已取消', refunded: '已售后' };
const STATUS_CLASS = { pending: 'pending', paid: 'paid', done: 'done', cancelled: 'cancelled', refunded: 'refunded' };

/* ================= 登录态 ================= */
let token = localStorage.getItem('token') || '';
let admin = null;
try { admin = JSON.parse(localStorage.getItem('admin') || 'null'); } catch (e) { admin = null; }

function saveAuth(t, a) {
  token = t; admin = a;
  localStorage.setItem('token', t);
  localStorage.setItem('admin', JSON.stringify(a || null));
}
function clearAuth() {
  token = ''; admin = null;
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  localStorage.removeItem('platFlagToken');
}

/**
 * 平台权限探测：登录接口若未返回 isPlatform（旧版后端），用 /api/platform/stores 探测一次
 * 结果缓存到 localStorage（按 token 失效，换号/重登自动重新探测）
 */
async function ensurePlatformFlag() {
  if (!admin) return false;
  if (localStorage.getItem('platFlagToken') === token) return !!admin.isPlatform;
  let isPlat = false;
  try {
    const res = await fetch(BASE_URL + '/api/platform/stores', { headers: { Authorization: 'Bearer ' + token } });
    isPlat = res.status === 200; // 200=平台管理员；401/403=普通账号
  } catch (e) { isPlat = false; }
  admin = Object.assign({}, admin, { isPlatform: isPlat });
  localStorage.setItem('admin', JSON.stringify(admin));
  localStorage.setItem('platFlagToken', token);
  return isPlat;
}

/* ================= API 封装（含 502/503/504 自动重试，应对云托管冷启动） ================= */
async function api(path, { method = 'GET', data, form } = {}) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (form) opts.body = form;
  else if (data !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(BASE_URL + path, opts);
    } catch (e) {
      if (attempt < 2) { await sleep(1500); continue; }
      toast('网络错误，请稍后重试', true);
      throw e;
    }
    if ([502, 503, 504].includes(res.status) && attempt < 2) { await sleep(1500); continue; }
    if (res.status === 401) { clearAuth(); render(); toast('登录已过期，请重新登录', true); throw new Error('登录已过期'); }
    let body = null;
    try { body = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
    if (body && body.code === 1001) {
      location.hash = '#/setup';
      render();
      throw new Error(body.message || '请先绑定店铺');
    }
    if (body && body.code === 0) return body.data;
    const msg = (body && body.message) || '请求失败';
    toast(msg, true);
    const err = new Error(msg);
    err.code = body ? body.code : 0;
    throw err;
  }
}

/* ================= Toast / Modal ================= */
let toastTimer = null;
function toast(msg, isErr = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2400);
}
function openModal(html) {
  $('#modal-root').innerHTML = `<div class="modal-mask"><div class="modal">${html}</div></div>`;
  const mask = $('.modal-mask', $('#modal-root'));
  mask.addEventListener('click', (e) => { if (e.target === mask) closeModal(); });
  document.addEventListener('keydown', escClose);
  function escClose(e) { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escClose); } }
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/* ================= 渲染入口 ================= */
const NAV_ITEMS = [
  { hash: '#/dashboard', icon: 'icon-home', label: '首页' },
  { hash: '#/goods', icon: 'icon-shirt', label: '商品' },
  { hash: '#/billing', icon: 'icon-receipt', label: '开单' },
  { hash: '#/orders', icon: 'icon-package', label: '订单' },
  { hash: '#/store', icon: 'icon-store', label: '店铺' },
  { hash: '#/platform', icon: 'icon-shield', label: '平台', platformOnly: true }
];

function render() {
  const root = $('#app');
  if (!token || !admin) { renderAuth(root); return; }
  if (!admin.storeId) { renderSetup(root); return; }
  // 先探测平台管理员身份（缓存），再渲染主导航
  ensurePlatformFlag().then(() => renderMain(root));
}

window.addEventListener('hashchange', () => { if (token && admin && admin.storeId) render(); });

/* ================= 登录 / 注册 ================= */
function renderAuth(root) {
  let mode = 'login';
  const draw = () => {
    const isLogin = mode === 'login';
    root.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>服装店管理</h1>
          <div class="sub">${isLogin ? '商家端 · 网页版' : '注册商家账号'}</div>
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
    $('#mode-link').addEventListener('click', () => { mode = isLogin ? 'register' : 'login'; draw(); });
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = $('button[type=submit]', e.target);
      btn.disabled = true;
      try {
        const data = await api('/api/auth/' + (isLogin ? 'login' : 'register'), {
          method: 'POST',
          data: { username: fd.get('username').trim(), password: fd.get('password') }
        });
        saveAuth(data.token, data.admin);
        toast(isLogin ? '登录成功' : '注册成功');
        location.hash = data.admin.storeId ? '#/dashboard' : '#/setup';
        render();
      } catch (e) { /* toast 已在 api 中统一弹出 */ }
      btn.disabled = false;
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
          <hr style="border:none;border-top:1px dashed #e5ddd0;margin:22px 0">
          <form id="bind-form">
            <label class="field"><span class="lbl">使用店铺码加入</span><input name="code" placeholder="8 位店铺码" maxlength="8" required></label>
            <button class="btn ghost" type="submit">加入店铺</button>
          </form>
          <div class="auth-switch"><a id="logout-link">退出登录</a></div>
        </div>
      </div>`;
    $('#logout-link').addEventListener('click', () => { clearAuth(); render(); });
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
  root.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">服装店管理</div>
        <nav>
          ${items.map((n) => `<a href="${n.hash}" class="${n.hash === cur ? 'active' : ''}"><span class="icon ${n.icon}"></span>${n.label}</a>`).join('')}
        </nav>
        <div class="side-user">
          <div class="store-name">${esc(admin.storeName || '我的店铺')}</div>
          <div>${esc(admin.username)} · ${admin.role === 'owner' ? '店主' : '员工'}</div>
          <button class="btn small light" id="btn-logout">退出登录</button>
        </div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
  $('#btn-logout').addEventListener('click', () => { clearAuth(); location.hash = ''; render(); });
  const view = $('#view');
  if (cur === '#/dashboard') renderDashboard(view);
  else if (cur === '#/goods') renderGoods(view);
  else if (cur === '#/billing') renderBilling(view);
  else if (cur === '#/orders') renderOrders(view);
  else if (cur === '#/store') renderStore(view);
  else if (cur === '#/platform') renderPlatform(view);
}

/* ================= 首页仪表盘 ================= */
async function renderDashboard(view) {
  view.innerHTML = `<div class="page-title">首页</div><div class="empty">加载中…</div>`;
  let d = null;
  try { d = await api('/api/stats/dashboard'); } catch (e) { return; }
  view.innerHTML = `
    <div class="page-title">今日概览</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">今日销售额</div><div class="num">¥${d.todaySales || 0}</div></div>
      <div class="stat-card"><div class="label">今日订单数</div><div class="num">${d.todayOrders || 0}</div></div>
      <div class="stat-card"><div class="label">待收款订单</div><div class="num">${d.pendingOrders || 0}</div></div>
      <div class="stat-card"><div class="label">在售商品</div><div class="num">${d.goodsOnSale || 0}<small>/ 共 ${d.goodsTotal || 0} 件</small></div></div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b>今日订单</b>
        <a href="#/orders" style="color:#e1483c;font-size:13px">查看全部 →</a>
      </div>
      <div id="dash-orders"><div class="empty">加载中…</div></div>
    </div>`;
  try {
    const od = await api('/api/orders?range=today&page=1&pageSize=5');
    const box = $('#dash-orders');
    if (!od.list || od.list.length === 0) { box.innerHTML = '<div class="empty">今天还没有订单，去「开单」开始第一笔生意吧</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>订单号</th><th>商品数</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
      <tbody>${od.list.map((o) => `<tr style="cursor:pointer" onclick="showOrder(${o.id})">
        <td>${esc(o.order_no)}</td><td>${o.quantity_count || 0} 件</td><td>¥${o.total_amount}</td>
        <td><span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span></td>
        <td class="muted">${esc(o.created_at)}</td></tr>`).join('')}</tbody></table>`;
  } catch (e) {}
}

/* ================= 商品管理 ================= */
async function renderGoods(view) {
  const state = { keyword: '', status: '', categoryId: '', page: 1, pageSize: 15 };
  view.innerHTML = `<div class="page-title">商品管理</div><div class="empty">加载中…</div>`;

  const load = async () => {
    const q = `/api/goods?page=${state.page}&pageSize=${state.pageSize}` +
      (state.keyword ? `&keyword=${encodeURIComponent(state.keyword)}` : '') +
      (state.status ? `&status=${state.status}` : '') +
      (state.categoryId ? `&categoryId=${state.categoryId}` : '');
    let data, cats;
    try {
      [data, cats] = await Promise.all([api(q), api('/api/category')]);
    } catch (e) { return; }

    view.innerHTML = `
      <div class="page-title">商品管理</div>
      <div class="goods-toolbar">
        <input class="grow" id="g-keyword" placeholder="搜索商品名称" value="${esc(state.keyword)}">
        <select id="g-status">
          <option value="">全部状态</option>
          <option value="on" ${state.status === 'on' ? 'selected' : ''}>在售</option>
          <option value="off" ${state.status === 'off' ? 'selected' : ''}>下架</option>
        </select>
        <select id="g-cat"><option value="">全部分类</option>
          ${cats.map((c) => `<option value="${c.id}" ${String(state.categoryId) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn ghost" id="btn-cat">分类管理</button>
        <button class="btn" id="btn-add">+ 新增商品</button>
      </div>
      <div class="card">
        ${!data.list || data.list.length === 0
          ? '<div class="empty">暂无商品，点击「新增商品」添加</div>'
          : `<table>
              <thead><tr><th></th><th>商品</th><th>货号</th><th>分类</th><th>售价</th><th>总库存</th><th>状态</th><th class="t-right">操作</th></tr></thead>
              <tbody>${data.list.map((g) => `
                <tr>
                  <td>${firstImg(g.image) ? `<img class="goods-img" src="${esc(fixImg(firstImg(g.image)))}">` : '<div class="goods-img-placeholder"><span class="icon icon-shirt"></span></div>'}</td>
                  <td><b>${esc(g.name)}</b>${g.skus && g.skus.length ? `<div class="muted" style="font-size:12px">${g.skus.map((s) => `${esc(s.color || '默认')}/${esc(s.size || '默认')}×${s.stock}`).join('，')}</div>` : ''}</td>
                  <td class="muted">${esc(g.goods_no || '-')}</td>
                  <td class="muted">${esc(g.category_name || '-')}</td>
                  <td style="color:#e1483c;font-weight:700">¥${g.price}</td>
                  <td class="${g.stock <= 5 ? 'stock-warn' : ''}">${g.stock}</td>
                  <td><span class="badge ${g.on_sale ? 'on' : 'off'}">${g.on_sale ? '在售' : '下架'}</span></td>
                  <td class="t-right">
                    <button class="btn small ghost" data-edit="${g.id}">编辑</button>
                    <button class="btn small light" data-toggle="${g.id}" data-on="${g.on_sale}">${g.on_sale ? '下架' : '上架'}</button>
                    <button class="btn small danger" data-del="${g.id}">删除</button>
                  </td>
                </tr>`).join('')}</tbody></table>
              <div class="pager">
                <button class="btn small ghost" id="pg-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
                <span>第 ${data.page} 页 / 共 ${Math.max(1, Math.ceil(data.total / state.pageSize))} 页（${data.total} 件）</span>
                <button class="btn small ghost" id="pg-next" ${state.page >= Math.ceil(data.total / state.pageSize) ? 'disabled' : ''}>下一页</button>
              </div>`}
      </div>`;

    // 事件绑定
    $('#g-keyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.keyword = e.target.value.trim(); state.page = 1; load(); } });
    $('#g-status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
    $('#g-cat').addEventListener('change', (e) => { state.categoryId = e.target.value; state.page = 1; load(); });
    $('#btn-add').addEventListener('click', () => openGoodsEditor(null, load));
    $('#btn-cat').addEventListener('click', () => openCategoryManager(load));
    if ($('#pg-prev')) $('#pg-prev').addEventListener('click', () => { state.page--; load(); });
    if ($('#pg-next')) $('#pg-next').addEventListener('click', () => { state.page++; load(); });
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openGoodsEditor(Number(b.dataset.edit), load)));
    $$('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/goods/${b.dataset.toggle}/status`, { method: 'PUT', data: { onSale: b.dataset.on === '1' ? 0 : 1 } }); toast('操作成功'); load(); } catch (e) {}
    }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('确定删除该商品吗？（删除后不可恢复）')) return;
      try { await api(`/api/goods/${b.dataset.del}`, { method: 'DELETE' }); toast('已删除'); load(); } catch (e) {}
    }));
  };
  load();
}

/** 新增 / 编辑商品弹窗（编辑时传 id） */
async function openGoodsEditor(id, onDone) {
  let cats = [];
  let g = { name: '', goods_no: '', image: '', price: '', original_price: '', colors: '', sizes: '', stock: 0, category_id: '', description: '', on_sale: 1 };
  try {
    cats = await api('/api/category');
    if (id) g = await api('/api/goods/' + id);
  } catch (e) { return; }

  const images = (g.image || '').split(',').filter(Boolean);
  openModal(`
    <h3>${id ? '编辑商品' : '新增商品'}</h3>
    <form id="goods-form">
      <label class="field"><span class="lbl">商品名称 *</span><input name="name" value="${esc(g.name)}" required></label>
      <div class="row">
        <label class="field"><span class="lbl">售价（元）*</span><input name="price" type="number" step="0.01" min="0" value="${g.price}" required></label>
        <label class="field"><span class="lbl">原价（元）</span><input name="originalPrice" type="number" step="0.01" min="0" value="${g.original_price || ''}"></label>
        <label class="field"><span class="lbl">货号</span><input name="goodsNo" value="${esc(g.goods_no || '')}"></label>
      </div>
      <div class="row">
        <label class="field"><span class="lbl">库存（整数）*</span><input name="stock" type="number" min="0" step="1" value="${g.stock}" required></label>
        <label class="field"><span class="lbl">分类</span>
          <select name="categoryId"><option value="">未分类</option>
            ${cats.map((c) => `<option value="${c.id}" ${String(g.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select></label>
        <label class="field"><span class="lbl">上架销售</span>
          <select name="onSale"><option value="1" ${g.on_sale ? 'selected' : ''}>在售</option><option value="0" ${!g.on_sale ? 'selected' : ''}>下架</option></select></label>
      </div>
      <div class="row">
        <label class="field"><span class="lbl">颜色（逗号分隔，选填）</span><input name="colors" value="${esc(g.colors || '')}" placeholder="如：黑色,白色"></label>
        <label class="field"><span class="lbl">尺码（逗号分隔，选填）</span><input name="sizes" value="${esc(g.sizes || '')}" placeholder="如：S,M,L"></label>
      </div>
      <label class="field"><span class="lbl">商品图片（最多 3 张，单张 ≤ 5MB）</span>
        <input name="file" type="file" accept="image/*" multiple>
        <div id="img-list" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          ${images.map((u) => `<img src="${esc(fixImg(u))}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`).join('')}
        </div></label>
      <label class="field"><span class="lbl">商品描述</span><textarea name="description" rows="3">${esc(g.description || '')}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="modal-cancel">取消</button>
        <button type="submit" class="btn">保 存</button>
      </div>
    </form>`);

  // 新选图片上传
  $('input[name=file]').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length + images.length > 3) { toast('最多 3 张图片', true); e.target.value = ''; return; }
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', f);
      try {
        const data = await api('/api/upload', { method: 'POST', form: fd });
        images.push(data.url);
      } catch (e2) { return; }
    }
    $('#img-list').innerHTML = images.map((u) => `<img src="${esc(fixImg(u))}" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`).join('');
    e.target.value = '';
  });

  $('#modal-cancel').addEventListener('click', closeModal);
  $('#goods-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (images.length > 3) { toast('最多 3 张图片', true); return; }
    const body = {
      name: fd.get('name').trim(),
      price: Number(fd.get('price')),
      originalPrice: Number(fd.get('originalPrice')) || 0,
      goodsNo: fd.get('goodsNo').trim(),
      stock: parseInt(fd.get('stock'), 10),
      colors: fd.get('colors').trim(),
      sizes: fd.get('sizes').trim(),
      image: images.join(','),
      categoryId: fd.get('categoryId') || null,
      description: fd.get('description').trim(),
      onSale: fd.get('onSale') === '1'
    };
    try {
      if (id) await api('/api/goods/' + id, { method: 'PUT', data: body });
      else await api('/api/goods', { method: 'POST', data: body });
      toast('保存成功');
      closeModal();
      onDone && onDone();
    } catch (e2) {}
  });
}

/** 分类管理弹窗 */
async function openCategoryManager(onDone) {
  let cats = [];
  try { cats = await api('/api/category'); } catch (e) { return; }
  const drawList = () => `
    <table><tbody>
      ${cats.map((c) => `<tr>
        <td>${esc(c.name)}</td><td class="muted">${c.goods_count} 件商品</td>
        <td class="t-right">
          <button class="btn small ghost" data-cedit="${c.id}">改名</button>
          <button class="btn small danger" data-cdel="${c.id}">删除</button>
        </td></tr>`).join('') || '<tr><td colspan="3" class="empty">暂无分类</td></tr>'}
    </tbody></table>`;
  openModal(`
    <h3>分类管理</h3>
    <div id="cat-list">${drawList()}</div>
    <form id="cat-add" style="display:flex;gap:8px;margin-top:14px">
      <input name="name" placeholder="新分类名称" required style="flex:1">
      <button class="btn" type="submit">添加</button>
    </form>
    <div class="modal-actions"><button class="btn ghost" id="modal-cancel">关闭</button></div>`);

  const refresh = async () => {
    try { cats = await api('/api/category'); } catch (e) { return; }
    $('#cat-list').innerHTML = drawList();
    bindRow();
  };
  const bindRow = () => {
    $$('[data-cedit]').forEach((b) => b.addEventListener('click', async () => {
      const c = cats.find((x) => String(x.id) === b.dataset.cedit);
      const name = prompt('新的分类名称：', c.name);
      if (!name || !name.trim()) return;
      try { await api('/api/category/' + c.id, { method: 'PUT', data: { name: name.trim(), sort: c.sort } }); toast('已保存'); refresh(); } catch (e) {}
    }));
    $$('[data-cdel]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('确定删除该分类吗？')) return;
      try { await api('/api/category/' + b.dataset.cdel, { method: 'DELETE' }); toast('已删除'); refresh(); onDone && onDone(); } catch (e) {}
    }));
  };
  bindRow();
  $('#cat-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    try { await api('/api/category', { method: 'POST', data: { name, sort: (cats.length + 1) * 100 } }); toast('已添加'); e.target.reset(); refresh(); onDone && onDone(); } catch (e2) {}
  });
  $('#modal-cancel').addEventListener('click', closeModal);
}

/* ================= 开单 ================= */
async function renderBilling(view) {
  view.innerHTML = `<div class="page-title">开单</div><div class="empty">加载中…</div>`;
  let data;
  try { data = await api('/api/goods?status=on&page=1&pageSize=200'); } catch (e) { return; }
  const goodsList = data.list || [];
  const cart = []; // {goodsId, name, price, color, size, quantity, maxStock}

  const draw = () => {
    view.innerHTML = `
      <div class="page-title">开单</div>
      <div class="billing-wrap">
        <div class="billing-goods">
          ${goodsList.length === 0
            ? '<div class="empty">暂无在售商品，请先到「商品」页添加</div>'
            : `<div class="billing-goods-grid">${goodsList.map((g) => `
                <div class="g-item" data-add="${g.id}">
                  ${firstImg(g.image) ? `<img src="${esc(fixImg(firstImg(g.image)))}">` : '<div class="ph"><span class="icon icon-shirt"></span></div>'}
                  <div class="g-name">${esc(g.name)}</div>
                  <div class="g-price">¥${g.price}</div>
                  <div class="g-stock">库存 ${g.stock}</div>
                </div>`).join('')}</div>`}
        </div>
        <div class="cart-panel card">
          <b style="font-size:15px">当前订单</b>
          <div id="cart-lines">
            ${cart.length === 0 ? '<div class="empty">点击左侧商品加入订单</div>' : cart.map((it, i) => `
              <div class="cart-line">
                <div class="cl-info">
                  <div class="cl-name">${esc(it.name)}</div>
                  <div class="cl-sku">${it.color || it.size ? `${esc(it.color || '默认')} / ${esc(it.size || '默认')}` : '默认规格'} · ¥${it.price}</div>
                </div>
                <div class="qty">
                  <button data-dec="${i}">−</button><span>${it.quantity}</span><button data-inc="${i}">＋</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="cart-total"><span>合计</span><span class="sum">¥${cart.reduce((s, it) => s + it.price * it.quantity, 0).toFixed(2)}</span></div>
          <label class="field" style="margin-top:10px"><span class="lbl">顾客手机（选填）</span><input id="bl-phone" placeholder="用于售后联系"></label>
          <label class="field"><span class="lbl">备注（选填）</span><input id="bl-remark" placeholder="如：打折、包邮"></label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:#555;margin-bottom:6px">
            <input type="checkbox" id="bl-paid" style="width:auto">顾客已现场付款（直接记为已收款）
          </label>
          <button class="btn" id="btn-submit" style="width:100%;padding:12px;font-size:15px" ${cart.length === 0 ? 'disabled' : ''}>确认开单</button>
        </div>
      </div>`;

    // 点击商品加入订单（有规格时弹选择框）
    $$('[data-add]').forEach((el) => el.addEventListener('click', () => {
      const g = goodsList.find((x) => String(x.id) === el.dataset.add);
      if (g.stock <= 0) { toast('该商品库存不足', true); return; }
      if (g.skus && g.skus.length) openSkuPicker(g);
      else addToCart({ goodsId: g.id, name: g.name, price: g.price, color: '', size: '', maxStock: g.stock, quantity: 1 });
    }));
    const bindQty = () => {
      $$('[data-inc]').forEach((b) => b.addEventListener('click', () => {
        const it = cart[Number(b.dataset.inc)];
        if (it.quantity >= it.maxStock) { toast('已达该规格库存上限', true); return; }
        it.quantity++; draw();
      }));
      $$('[data-dec]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.dec);
        cart[i].quantity--;
        if (cart[i].quantity <= 0) cart.splice(i, 1);
        draw();
      }));
    };
    bindQty();

    const addToCart = (item) => {
      const found = cart.find((x) => x.goodsId === item.goodsId && x.color === item.color && x.size === item.size);
      if (found) {
        if (found.quantity >= found.maxStock) { toast('已达该规格库存上限', true); return; }
        found.quantity++;
      } else cart.push(item);
      draw();
    };

    $('#btn-submit').addEventListener('click', async () => {
      if (!cart.length) return;
      const btn = $('#btn-submit');
      btn.disabled = true;
      btn.textContent = '提交中…';
      try {
        const res = await api('/api/orders', {
          method: 'POST',
          data: {
            items: cart.map((it) => ({ goodsId: it.goodsId, color: it.color, size: it.size, quantity: it.quantity })),
            customerPhone: $('#bl-phone').value.trim(),
            remark: $('#bl-remark').value.trim(),
            paidNow: $('#bl-paid').checked
          }
        });
        toast(`开单成功：${res.orderNo}（¥${res.totalAmount}）`);
        cart.length = 0;
        // 重新拉取商品以刷新库存
        try { const d2 = await api('/api/goods?status=on&page=1&pageSize=200'); goodsList.length = 0; goodsList.push(...(d2.list || [])); } catch (e) {}
        draw();
      } catch (e) { btn.disabled = false; btn.textContent = '确认开单'; }
    });

    function openSkuPicker(g) {
      openModal(`
        <h3>选择规格 · ${esc(g.name)}</h3>
        <table>
          <thead><tr><th>颜色</th><th>尺码</th><th>库存</th><th class="t-right">数量</th></tr></thead>
          <tbody>${g.skus.map((s) => `
            <tr>
              <td>${esc(s.color || '默认')}</td><td>${esc(s.size || '默认')}</td>
              <td>${s.stock}</td>
              <td class="t-right">${s.stock > 0
                ? `<button class="btn small" data-sku-pick data-gid="${g.id}" data-gname="${esc(g.name)}" data-price="${g.price}" data-color="${esc(s.color || '')}" data-size="${esc(s.size || '')}" data-stock="${s.stock}">加入</button>`
                : '<span class="muted">无货</span>'}</td>
            </tr>`).join('')}</tbody>
        </table>
        <div class="modal-actions"><button class="btn ghost" id="modal-cancel">取消</button></div>`);
      $('#modal-cancel').addEventListener('click', closeModal);
      $$('[data-sku-pick]').forEach((b) => b.addEventListener('click', () => {
        closeModal();
        addToCart({
          goodsId: Number(b.dataset.gid), name: b.dataset.gname, price: Number(b.dataset.price),
          color: b.dataset.color, size: b.dataset.size, maxStock: Number(b.dataset.stock), quantity: 1
        });
      }));
    }
  };
  draw();
}

/* ================= 订单管理 ================= */
async function renderOrders(view) {
  const state = { status: '', keyword: '', range: 'all', page: 1, pageSize: 15 };
  view.innerHTML = `<div class="page-title">订单管理</div><div class="empty">加载中…</div>`;
  const load = async () => {
    const q = `/api/orders?page=${state.page}&pageSize=${state.pageSize}&range=${state.range}` +
      (state.status ? `&status=${state.status}` : '') +
      (state.keyword ? `&keyword=${encodeURIComponent(state.keyword)}` : '');
    let data;
    try { data = await api(q); } catch (e) { return; }
    const totalPages = Math.max(1, Math.ceil(data.total / state.pageSize));
    view.innerHTML = `
      <div class="page-title">订单管理</div>
      <div class="goods-toolbar">
        <input class="grow" id="o-keyword" placeholder="搜索订单号" value="${esc(state.keyword)}">
        <select id="o-status">
          <option value="">全部状态</option>
          ${Object.keys(STATUS).map((k) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}
        </select>
        <select id="o-range">
          <option value="all">全部时间</option>
          <option value="today" ${state.range === 'today' ? 'selected' : ''}>今日</option>
          <option value="week" ${state.range === 'week' ? 'selected' : ''}>近 7 天</option>
          <option value="month" ${state.range === 'month' ? 'selected' : ''}>近 30 天</option>
        </select>
      </div>
      <div class="card">
        ${!data.list || data.list.length === 0
          ? '<div class="empty">暂无符合条件的订单</div>'
          : `<table>
              <thead><tr><th>订单号</th><th>件数</th><th>金额</th><th>状态</th><th>顾客</th><th>时间</th><th class="t-right">操作</th></tr></thead>
              <tbody>${data.list.map((o) => `
                <tr>
                  <td><b>${esc(o.order_no)}</b></td>
                  <td>${o.quantity_count || 0} 件</td>
                  <td style="color:#e1483c;font-weight:700">¥${o.total_amount}</td>
                  <td><span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span></td>
                  <td class="muted">${esc(o.customer_phone || '-')}</td>
                  <td class="muted">${esc(o.created_at)}</td>
                  <td class="t-right"><button class="btn small ghost" onclick="showOrder(${o.id})">详情</button></td>
                </tr>`).join('')}</tbody></table>
              <div class="pager">
                <button class="btn small ghost" id="o-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
                <span>第 ${data.page} 页 / 共 ${totalPages} 页（${data.total} 单）</span>
                <button class="btn small ghost" id="o-next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>
              </div>`}
      </div>`;
    $('#o-keyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.keyword = e.target.value.trim(); state.page = 1; load(); } });
    $('#o-status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
    $('#o-range').addEventListener('change', (e) => { state.range = e.target.value; state.page = 1; load(); });
    if ($('#o-prev')) $('#o-prev').addEventListener('click', () => { state.page--; load(); });
    if ($('#o-next')) $('#o-next').addEventListener('click', () => { state.page++; load(); });
  };
  load();
}

/** 订单详情弹窗（含状态操作）；挂在 window 上供内联 onclick 调用 */
window.showOrder = async function (id) {
  let o;
  try { o = await api('/api/orders/' + id); } catch (e) { return; }
  const acts = [];
  if (o.status === 'pending') {
    acts.push(`<button class="btn" data-act="paid">确认收款</button>`);
    acts.push(`<button class="btn danger" data-act="cancel">取消订单</button>`);
  } else if (o.status === 'paid') {
    acts.push(`<button class="btn" data-act="done">标记完成</button>`);
    acts.push(`<button class="btn danger" data-act="cancel">取消订单</button>`);
    acts.push(`<button class="btn danger" data-act="refund">退款</button>`);
  } else if (o.status === 'done') {
    acts.push(`<button class="btn danger" data-act="refund">退款</button>`);
  }
  openModal(`
    <h3>订单详情</h3>
    <div class="card" style="box-shadow:none;border:1px solid #eef0f3;margin-bottom:14px;padding:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <b>${esc(o.order_no)}</b>
        <span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span>
      </div>
      <div class="muted" style="font-size:13px;line-height:1.8">
        下单时间：${esc(o.created_at)}<br>
        顾客电话：${esc(o.customer_phone || '-')}　备注：${esc(o.remark || '-')}
      </div>
    </div>
    ${o.items.map((it) => `
      <div class="order-item-row">
        <span>${esc(it.goods_name)}<span class="muted">（${esc(it.color || '默认')} / ${esc(it.size || '默认')}）</span></span>
        <span>×${it.quantity}　¥${(it.price * it.quantity).toFixed(2)}</span>
      </div>`).join('')}
    <div class="cart-total"><span>合计</span><span class="sum">¥${o.total_amount}</span></div>
    <div class="modal-actions">
      <button class="btn ghost" id="modal-cancel">关闭</button>
      ${acts.join('')}
    </div>`);
  $('#modal-cancel').addEventListener('click', closeModal);
  $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    const confirmText = { paid: '确认已收到货款？', done: '确认该订单已完成？', cancel: '取消后库存将自动归还，确定取消？', refund: '退款后库存将自动归还，确定退款？' };
    if (act === 'paid') { if (!confirm(confirmText.paid)) return; }
    if (act === 'done') { if (!confirm(confirmText.done)) return; }
    if (act === 'cancel') { if (!confirm(confirmText.cancel)) return; }
    if (act === 'refund') { if (!confirm(confirmText.refund)) return; }
    b.disabled = true;
    try {
      if (act === 'paid' || act === 'done') await api(`/api/orders/${o.id}/status`, { method: 'PUT', data: { status: act } });
      else await api(`/api/orders/${o.id}/${act}`, { method: 'POST' });
      toast('操作成功');
      closeModal();
      render();
    } catch (e) { b.disabled = false; }
  }));
};

/* ================= 店铺管理 ================= */
async function renderStore(view) {
  view.innerHTML = `<div class="page-title">店铺管理</div><div class="empty">加载中…</div>`;
  let d;
  try { d = await api('/api/store/info'); } catch (e) { return; }
  const s = d.store;
  const isOwner = d.role === 'owner';

  view.innerHTML = `
    <div class="page-title">店铺管理</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <b style="font-size:17px">${esc(s ? s.name : '未绑定店铺')}</b>
          <div class="muted" style="margin-top:4px">我的身份：${isOwner ? '店主' : '员工'}　${d.billingEnabled ? `开单授权至 ${esc(d.billingExpireAt)}` : '<span style="color:#b45309">开单功能未授权</span>'}</div>
        </div>
        ${admin.isPlatform && d.canRename ? '<button class="btn ghost" id="btn-rename">修改店铺名</button>' : ''}
      </div>
    </div>

    <div class="card">
      <b>店铺码（员工凭此码加入）</b>
      <div style="font-size:26px;letter-spacing:6px;color:#e1483c;font-weight:700;margin:10px 0">${esc(s ? s.bind_code : '-')}</div>
      ${isOwner ? '<button class="btn small light" id="btn-code">重置店铺码</button>' : ''}
    </div>

    ${d.myStores && d.myStores.length > 0 ? `
      <div class="card">
        <b>我的店铺（${d.myStores.length}/${d.storeLimit}）</b>
        <table style="margin-top:8px"><tbody>
          ${d.myStores.map((ms) => `<tr>
            <td>${esc(ms.name)}${s && ms.id === s.id ? ' <span class="badge on">当前</span>' : ''}</td>
            <td class="muted">创建于 ${esc(ms.created_at)}</td>
            <td class="t-right">${s && ms.id !== s.id ? `<button class="btn small ghost" data-switch="${ms.id}">切换到此店</button>` : ''}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>` : ''}

    <div class="card">
      <b>店铺成员</b>
      <table style="margin-top:8px">
        <thead><tr><th>账号</th><th>角色</th><th>加入时间</th>${isOwner ? '<th class="t-right">操作</th>' : ''}</tr></thead>
        <tbody>
          ${(d.members || []).map((m) => `<tr>
            <td>${esc(m.username)}</td>
            <td>${m.role === 'owner' ? '店主' : '员工'}</td>
            <td class="muted">${esc(m.created_at)}</td>
            ${isOwner ? `<td class="t-right">${m.role === 'owner' ? '' : `<button class="btn small danger" data-remove="${m.id}" data-name="${esc(m.username)}">移除</button>`}</td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${!isOwner ? '<button class="btn danger" id="btn-unbind">退出当前店铺</button>' : ''}`;

  if ($('#btn-rename')) $('#btn-rename').addEventListener('click', async () => {
    const name = prompt('新的店铺名称（每月限改一次）：', s.name);
    if (!name || !name.trim() || name.trim() === s.name) return;
    try { await api('/api/store/rename', { method: 'POST', data: { storeName: name.trim() } }); toast('店铺名称已修改'); renderMain($('#app')); } catch (e) {}
  });
  if ($('#btn-code')) $('#btn-code').addEventListener('click', async () => {
    if (!confirm('重置后旧店铺码立即失效，确定重置？')) return;
    try { const r = await api('/api/store/code', { method: 'POST' }); toast('新店铺码：' + r.bindCode); renderStore(view); } catch (e) {}
  });
  $$('[data-switch]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('切换店铺后，商品与订单数据将切换为新店铺的数据，确定？')) return;
    try {
      const r = await api('/api/store/switch', { method: 'POST', data: { storeId: Number(b.dataset.switch) } });
      saveAuth(r.token, r.admin);
      toast('已切换店铺');
      render();
    } catch (e) {}
  }));
  $$('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`确定将成员【${b.dataset.name}】移出店铺？`)) return;
    try { await api('/api/store/member/remove', { method: 'POST', data: { memberId: Number(b.dataset.remove) } }); toast('已移除'); renderStore(view); } catch (e) {}
  }));
  if ($('#btn-unbind')) $('#btn-unbind').addEventListener('click', async () => {
    if (!confirm('退出后将无法访问该店铺的商品与订单，确定退出？')) return;
    try {
      const r = await api('/api/store/unbind', { method: 'POST' });
      saveAuth(r.token, r.admin);
      toast('已退出店铺');
      location.hash = '#/setup';
      render();
    } catch (e) {}
  });
}

/* ================= 平台管理（仅平台管理员可见） ================= */
async function renderPlatform(view) {
  if (!admin.isPlatform) { view.innerHTML = '<div class="empty">无权限：仅平台管理员可访问</div>'; return; }
  view.innerHTML = `<div class="page-title">平台管理</div><div class="empty">加载中…</div>`;
  let data;
  try { data = await api('/api/platform/stores'); } catch (e) { return; }
  const list = data.list || [];

  view.innerHTML = `
    <div class="page-title">平台管理 <span style="font-size:13px;color:#999;font-weight:400">共 ${list.length} 家店铺</span></div>
    <div class="card">
      ${list.length === 0
        ? '<div class="empty">暂无店铺</div>'
        : `<table>
            <thead><tr><th>店铺</th><th>店铺码</th><th>店主</th><th>成员</th><th>订单数</th><th>创建时间</th><th>开单授权</th><th class="t-right">操作</th></tr></thead>
            <tbody>${list.map((s) => `
              <tr>
                <td><b>${esc(s.name)}</b></td>
                <td class="muted">${esc(s.bind_code)}</td>
                <td class="muted">${esc(s.owner_name || '-')}</td>
                <td class="t-center">${s.member_count}</td>
                <td class="t-center">${s.order_count}</td>
                <td class="muted">${esc(s.created_at)}</td>
                <td>${s.enabled
                  ? `<span class="badge on">剩余 ${s.daysLeft} 天</span><div class="muted" style="font-size:12px;margin-top:2px">${esc(s.expireAt)}</div>`
                  : (s.expireAt
                    ? `<span class="badge off">已到期</span><div class="muted" style="font-size:12px;margin-top:2px">${esc(s.expireAt)}</div>`
                    : '<span class="badge cancelled">未授权</span>')}</td>
                <td class="t-right"><button class="btn small ghost" data-bill="${s.id}" data-name="${esc(s.name)}">设置授权</button></td>
              </tr>`).join('')}</tbody></table>`}
    </div>`;

  $$('[data-bill]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.bill;
    const name = b.dataset.name;
    openModal(`
      <h3>开单授权 · ${esc(name)}</h3>
      <label class="field"><span class="lbl">按天数授权（从现在起算）</span>
        <div style="display:flex;gap:8px">
          <input id="pl-days" type="number" min="1" placeholder="如：30" style="flex:1">
          <button class="btn" id="pl-days-go">授权</button>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${[30, 90, 365].map((d) => `<button class="btn small light pl-quick" data-days="${d}">${d === 365 ? '一年' : d + ' 天'}</button>`).join('')}
        </div>
      </label>
      <label class="field"><span class="lbl">或自定义到期时间</span>
        <div style="display:flex;gap:8px">
          <input id="pl-expire" type="datetime-local" style="flex:1">
          <button class="btn" id="pl-expire-go">设置</button>
        </div>
      </label>
      <button class="btn danger" id="pl-close" style="width:100%">关闭该店铺开单权限</button>
      <div class="modal-actions"><button class="btn ghost" id="modal-cancel">取消</button></div>`);

    const doSet = async (body) => {
      try {
        const r = await api(`/api/platform/stores/${id}/billing`, { method: 'POST', data: body });
        toast(r.message || '设置成功');
        closeModal();
        renderPlatform(view);
      } catch (e) {}
    };
    $('#pl-days-go').addEventListener('click', () => {
      const days = parseInt($('#pl-days').value, 10);
      if (!(days > 0)) { toast('请输入大于 0 的天数', true); return; }
      doSet({ days });
    });
    $$('.pl-quick').forEach((q) => q.addEventListener('click', () => doSet({ days: Number(q.dataset.days) })));
    $('#pl-expire-go').addEventListener('click', () => {
      const v = $('#pl-expire').value; // YYYY-MM-DDTHH:mm
      if (!v) { toast('请选择到期时间', true); return; }
      doSet({ expireAt: v.replace('T', ' ') + ':00' });
    });
    $('#pl-close').addEventListener('click', () => {
      if (!confirm(`确定关闭店铺【${name}】的开单权限？关闭后立即生效，该店将无法开单`)) return;
      doSet({ days: 0 });
    });
    $('#modal-cancel').addEventListener('click', closeModal);
  }));
}

/* ================= 启动 ================= */
render();
