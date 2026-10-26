/** 首页仪表盘 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 首页仪表盘 ================= */
async function renderDashboard(view) {
  view.innerHTML = `<div class="page-title">首页</div><div class="empty">加载中…</div>`;
  let d = null;
  try {
    d = await api('/api/stats/dashboard');
  } catch (e) {
    return;
  }
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
        <a href="#/orders" style="color:var(--primary-dark);font-size:13px">查看全部 →</a>
      </div>
      <div id="dash-orders"><div class="empty">加载中…</div></div>
    </div>`;
  try {
    const od = await api('/api/orders?range=today&page=1&pageSize=5');
    const box = $('#dash-orders');
    if (!od.list || od.list.length === 0) {
      box.innerHTML = '<div class="empty">今天还没有订单，去「开单」开始第一笔生意吧</div>';
      return;
    }
    box.innerHTML = `<table>
      <thead><tr><th>订单号</th><th>商品数</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
      <tbody>${od.list
        .map(
          (o) => `<tr style="cursor:pointer" onclick="showOrder(${o.id})">
        <td>${esc(o.order_no)}</td><td>${o.quantity_count || 0} 件</td><td>¥${o.total_amount}</td>
        <td><span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span></td>
        <td class="muted">${esc(o.created_at)}</td></tr>`
        )
        .join('')}</tbody></table>`;
  } catch (e) {}
}

export { renderDashboard };
