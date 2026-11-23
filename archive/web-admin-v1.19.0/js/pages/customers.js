/** 会员管理 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 会员管理 ================= */
// 会员列表（搜索/分页）+ 新增/编辑/删除；消费次数/累计金额由后端 CRM 统计返回
async function renderCustomers(view) {
  const state = { keyword: '', page: 1, pageSize: 15 };
  view.innerHTML = `<div class="page-title">会员管理</div><div class="empty">加载中…</div>`;
  const load = async () => {
    const q =
      `/api/customer/list?page=${state.page}&pageSize=${state.pageSize}` +
      (state.keyword ? `&keyword=${encodeURIComponent(state.keyword)}` : '');
    let data;
    try {
      data = await api(q);
    } catch (e) {
      return;
    }
    const totalPages = Math.max(1, Math.ceil(data.total / state.pageSize));
    view.innerHTML = `
      <div class="page-title">会员管理</div>
      <div class="goods-toolbar">
        <input class="grow" id="c-keyword" placeholder="搜索手机号 / 姓氏" value="${esc(state.keyword)}">
        <button class="btn" id="c-add">+ 新增会员</button>
      </div>
      <div class="card">
        ${
          !data.list || data.list.length === 0
            ? '<div class="empty">暂无会员，可在开单页输入手机号添加，或点右上角「新增会员」</div>'
            : `<table>
              <thead><tr><th>会员</th><th>手机号</th><th>消费次数</th><th>累计金额</th><th>最近到店</th><th class="t-right">操作</th></tr></thead>
              <tbody>${data.list
                .map(
                  (c) => `
                <tr>
                  <td><b>${esc(c.displayName)}</b></td>
                  <td class="muted">${esc(c.phone)}</td>
                  <td>${c.orderCount} 次</td>
                  <td style="color:var(--primary-dark);font-weight:700">¥${c.totalAmount}</td>
                  <td class="muted">${esc(c.lastOrderAt || '-')}</td>
                  <td class="t-right">
                    <button class="btn small ghost" data-edit="${c.id}" data-surname="${esc(c.surname)}" data-gender="${c.gender}">编辑</button>
                    <button class="btn small danger" data-del="${c.id}" data-name="${esc(c.displayName)}" style="margin-left:6px">删除</button>
                  </td>
                </tr>`
                )
                .join('')}</tbody></table>
              <div class="pager">
                <button class="btn small ghost" id="c-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
                <span>第 ${data.page} 页 / 共 ${totalPages} 页（${data.total} 人）</span>
                <button class="btn small ghost" id="c-next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>
              </div>`
        }
      </div>`;
    const onCustomerKeyword = debounce(() => {
      state.keyword = $('#c-keyword').value.trim();
      state.page = 1;
      load();
    }, 300);
    $('#c-keyword').addEventListener('input', onCustomerKeyword);
    $('#c-keyword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onCustomerKeyword();
    });
    $('#c-add').addEventListener('click', openAddModal);
    if ($('#c-prev'))
      $('#c-prev').addEventListener('click', () => {
        state.page--;
        load();
      });
    if ($('#c-next'))
      $('#c-next').addEventListener('click', () => {
        state.page++;
        load();
      });
    $$('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEditModal(b.dataset.edit, b.dataset.surname, b.dataset.gender))
    );
    $$('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirm(`确定删除会员【${b.dataset.name}】？历史订单中的姓名快照将保留。`))) return;
        try {
          await api(`/api/customer/${b.dataset.del}`, { method: 'DELETE' });
          toast('会员已删除');
          load();
        } catch (e) {}
      })
    );
  };

  // 新增会员弹窗
  function openAddModal() {
    openModal(`
      <h3>新增会员</h3>
      <form id="c-form">
        <label class="field"><span class="lbl">手机号</span><input name="phone" maxlength="11" placeholder="11 位手机号" required></label>
        <label class="field"><span class="lbl">姓氏</span><input name="surname" maxlength="10" placeholder="如：赵" required></label>
        <label class="field"><span class="lbl">性别</span>
          <select name="gender" style="width:100%">
            <option value="1">先生</option>
            <option value="2">女士</option>
          </select>
        </label>
        <button class="btn" style="width:100%;margin-top:6px">确认添加</button>
      </form>`);
    $('#c-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const phone = String(fd.get('phone') || '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(phone)) {
        toast('请输入 11 位手机号', true);
        return;
      }
      try {
        const r = await api('/api/customer', {
          method: 'POST',
          data: { phone, surname: String(fd.get('surname') || '').trim(), gender: Number(fd.get('gender')) }
        });
        toast(r.message || '已添加会员');
        closeModal();
        load();
      } catch (e2) {}
    });
  }

  // 编辑会员弹窗
  function openEditModal(id, surname, gender) {
    openModal(`
      <h3>编辑会员</h3>
      <form id="c-form">
        <label class="field"><span class="lbl">姓氏</span><input name="surname" maxlength="10" value="${esc(surname)}" required></label>
        <label class="field"><span class="lbl">性别</span>
          <select name="gender" style="width:100%">
            <option value="1" ${String(gender) === '1' ? 'selected' : ''}>先生</option>
            <option value="2" ${String(gender) === '2' ? 'selected' : ''}>女士</option>
          </select>
        </label>
        <button class="btn" style="width:100%;margin-top:6px">保存</button>
      </form>`);
    $('#c-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api(`/api/customer/${id}`, {
          method: 'PUT',
          data: { surname: String(fd.get('surname') || '').trim(), gender: Number(fd.get('gender')) }
        });
        toast('已保存');
        closeModal();
        load();
      } catch (e2) {}
    });
  }

  load();
}

export { renderCustomers };
