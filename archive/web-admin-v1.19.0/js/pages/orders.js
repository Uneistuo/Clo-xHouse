/** 订单管理：列表 + 详情操作 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 订单管理 ================= */
async function renderOrders(view) {
  const state = { status: '', keyword: '', range: 'all', page: 1, pageSize: 15 };
  view.innerHTML = `<div class="page-title">订单管理</div><div class="empty">加载中…</div>`;
  const load = async () => {
    const q =
      `/api/orders?page=${state.page}&pageSize=${state.pageSize}&range=${state.range}` +
      (state.status ? `&status=${state.status}` : '') +
      (state.keyword ? `&keyword=${encodeURIComponent(state.keyword)}` : '');
    let data;
    try {
      data = await api(q);
    } catch (e) {
      return;
    }
    const totalPages = Math.max(1, Math.ceil(data.total / state.pageSize));
    view.innerHTML = `
      <div class="page-title">订单管理</div>
      <div class="goods-toolbar">
        <input class="grow" id="o-keyword" placeholder="搜索订单号" value="${esc(state.keyword)}">
        <select id="o-status">
          <option value="">全部状态</option>
          ${Object.keys(STATUS)
            .map((k) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${STATUS[k]}</option>`)
            .join('')}
        </select>
        <select id="o-range">
          <option value="all">全部时间</option>
          <option value="today" ${state.range === 'today' ? 'selected' : ''}>今日</option>
          <option value="week" ${state.range === 'week' ? 'selected' : ''}>近 7 天</option>
          <option value="month" ${state.range === 'month' ? 'selected' : ''}>近 30 天</option>
        </select>
      </div>
      <div class="card">
        ${
          !data.list || data.list.length === 0
            ? '<div class="empty">暂无符合条件的订单</div>'
            : `<table>
              <thead><tr><th>订单号</th><th>件数</th><th>金额</th><th>状态</th><th>顾客</th><th>时间</th><th class="t-right">操作</th></tr></thead>
              <tbody>${data.list
                .map(
                  (o) => `
                <tr>
                  <td><b>${esc(o.order_no)}</b></td>
                  <td>${o.quantity_count || 0} 件</td>
                  <td style="color:var(--primary-dark);font-weight:700">¥${o.total_amount}</td>
                  <td><span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span></td>
                  <td class="muted">${esc(o.customer_name ? `${o.customer_name} ${o.customer_phone || ''}` : o.customer_phone || '-')}</td>
                  <td class="muted">${esc(o.created_at)}</td>
                  <td class="t-right"><button class="btn small ghost" onclick="showOrder(${o.id})">详情</button></td>
                </tr>`
                )
                .join('')}</tbody></table>
              <div class="pager">
                <button class="btn small ghost" id="o-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
                <span>第 ${data.page} 页 / 共 ${totalPages} 页（${data.total} 单）</span>
                <button class="btn small ghost" id="o-next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>
              </div>`
        }
      </div>`;
    const onOrderKeyword = debounce(() => {
      state.keyword = $('#o-keyword').value.trim();
      state.page = 1;
      load();
    }, 300);
    $('#o-keyword').addEventListener('input', onOrderKeyword);
    $('#o-keyword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onOrderKeyword();
    });
    $('#o-status').addEventListener('change', (e) => {
      state.status = e.target.value;
      state.page = 1;
      load();
    });
    $('#o-range').addEventListener('change', (e) => {
      state.range = e.target.value;
      state.page = 1;
      load();
    });
    if ($('#o-prev'))
      $('#o-prev').addEventListener('click', () => {
        state.page--;
        load();
      });
    if ($('#o-next'))
      $('#o-next').addEventListener('click', () => {
        state.page++;
        load();
      });
  };
  load();
}

/** 订单详情弹窗（含状态操作）；挂到 window 上供内联 onclick 调用 */
export async function showOrder(id) {
  let o;
  try {
    o = await api('/api/orders/' + id);
  } catch (e) {
    return;
  }
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
    <div class="card" style="box-shadow:none;border:1px solid var(--hairline);margin-bottom:14px;padding:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <b>${esc(o.order_no)}</b>
        <span class="badge ${STATUS_CLASS[o.status]}">${STATUS[o.status] || o.status}</span>
      </div>
      <div class="muted" style="font-size:13px;line-height:1.8">
        下单时间：${esc(o.created_at)}<br>
        顾客电话：${esc(o.customer_phone || '-')}　备注：${esc(o.remark || '-')}
      </div>
    </div>
    ${o.items
      .map(
        (it) => `
      <div class="order-item-row">
        <span>${esc(it.goods_name)}<span class="muted">（${esc(it.color || '默认')} / ${esc(it.size || '默认')}）</span></span>
        <span>×${it.quantity}　¥${(it.price * it.quantity).toFixed(2)}</span>
      </div>`
      )
      .join('')}
    <div class="cart-total"><span>合计</span><span class="sum">¥${o.total_amount}</span></div>
    <div class="modal-actions">
      <button class="btn ghost" id="print-order" type="button">打印小票</button>
      <button class="btn ghost" id="modal-cancel">关闭</button>
      ${acts.join('')}
    </div>`);
  $('#modal-cancel').addEventListener('click', closeModal);
  $('#print-order').addEventListener('click', () => {
    // 仅打印弹窗内容（@media print 中隐藏应用外壳）
    document.body.classList.add('print-order');
    const cleanup = () => {
      document.body.classList.remove('print-order');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000); // Safari 不触发 afterprint 时兜底
  });
  $$('[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      const act = b.dataset.act;
      const confirmText = {
        paid: '确认已收到货款？',
        done: '确认该订单已完成？',
        cancel: '取消后库存将自动归还，确定取消？',
        refund: '退款后库存将自动归还，确定退款？'
      };
      if (act === 'paid') {
        if (!(await confirm(confirmText.paid))) return;
      }
      if (act === 'done') {
        if (!(await confirm(confirmText.done))) return;
      }
      if (act === 'cancel') {
        if (!(await confirm(confirmText.cancel))) return;
      }
      if (act === 'refund') {
        if (!(await confirm(confirmText.refund))) return;
      }
      b.disabled = true;
      try {
        if (act === 'paid' || act === 'done')
          await api(`/api/orders/${o.id}/status`, { method: 'PUT', data: { status: act } });
        else await api(`/api/orders/${o.id}/${act}`, { method: 'POST' });
        toast('操作成功');
        closeModal();
        requestRender();
      } catch (e) {
        b.disabled = false;
      }
    })
  );
}

// 供模板内联 onclick 调用
window.showOrder = showOrder;
export { renderOrders };
