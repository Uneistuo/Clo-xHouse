/** 店铺管理 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 店铺管理 ================= */
async function renderStore(view) {
  view.innerHTML = `<div class="page-title">店铺管理</div><div class="empty">加载中…</div>`;
  let d;
  try {
    d = await api('/api/store/info');
  } catch (e) {
    return;
  }
  const s = d.store;
  const isOwner = d.role === 'owner';

  view.innerHTML = `
    <div class="page-title">店铺管理</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <b style="font-size:17px">${esc(s ? s.name : '未绑定店铺')}</b>
          <div class="muted" style="margin-top:4px">我的身份：${isOwner ? '店主' : '员工'}　${d.billingEnabled ? `开单授权至 ${esc(d.billingExpireAt)}` : '<span style="color:var(--warning-ink)">开单功能未授权</span>'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <b>店铺码（员工凭此码加入）</b>
      <div style="font-size:26px;letter-spacing:6px;color:var(--primary-dark);font-weight:700;margin:10px 0">${esc(s ? s.bind_code : '-')}</div>
      ${isOwner ? '<button class="btn small light" id="btn-code">重置店铺码</button>' : ''}
    </div>

    ${
      d.myStores && d.myStores.length > 0
        ? `
      <div class="card">
        <b>我的店铺（${d.myStores.length}/${d.storeLimit}）</b>
        <table style="margin-top:8px"><tbody>
          ${d.myStores
            .map(
              (ms) => `<tr>
            <td>${esc(ms.name)}${s && ms.id === s.id ? ' <span class="badge on">当前</span>' : ''}</td>
            <td class="muted">创建于 ${esc(ms.created_at)}</td>
            <td class="t-right">${s && ms.id !== s.id ? `<button class="btn small ghost" data-switch="${ms.id}">切换到此店</button>` : ''}</td>
          </tr>`
            )
            .join('')}
        </tbody></table>
      </div>`
        : ''
    }

    <div class="card">
      <b>店铺成员</b>
      <table style="margin-top:8px">
        <thead><tr><th>账号</th><th>角色</th><th>加入时间</th>${isOwner ? '<th class="t-right">操作</th>' : ''}</tr></thead>
        <tbody>
          ${(d.members || [])
            .map(
              (m) => `<tr>
            <td>${esc(m.username)}</td>
            <td>${m.role === 'owner' ? '店主' : '员工'}</td>
            <td class="muted">${esc(m.created_at)}</td>
            ${isOwner ? `<td class="t-right">${m.role === 'owner' ? '' : `<button class="btn small danger" data-remove="${m.id}" data-name="${esc(m.username)}">移除</button>`}</td>` : ''}
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    ${!isOwner ? '<button class="btn danger" id="btn-unbind">退出当前店铺</button>' : ''}`;

  if ($('#btn-code'))
    $('#btn-code').addEventListener('click', async () => {
      if (!(await confirm('重置后旧店铺码立即失效，确定重置？'))) return;
      try {
        const r = await api('/api/store/code', { method: 'POST' });
        toast('新店铺码：' + r.bindCode);
        renderStore(view);
      } catch (e) {}
    });
  $$('[data-switch]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirm('切换店铺后，商品与订单数据将切换为新店铺的数据，确定？'))) return;
      try {
        const r = await api('/api/store/switch', { method: 'POST', data: { storeId: Number(b.dataset.switch) } });
        saveAuth(r.token, r.admin);
        toast('已切换店铺');
        requestRender();
      } catch (e) {}
    })
  );
  $$('[data-remove]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirm(`确定将成员【${b.dataset.name}】移出店铺？`))) return;
      try {
        await api('/api/store/member/remove', { method: 'POST', data: { memberId: Number(b.dataset.remove) } });
        toast('已移除');
        renderStore(view);
      } catch (e) {}
    })
  );
  if ($('#btn-unbind'))
    $('#btn-unbind').addEventListener('click', async () => {
      if (!(await confirm('退出后将无法访问该店铺的商品与订单，确定退出？'))) return;
      try {
        const r = await api('/api/store/unbind', { method: 'POST' });
        saveAuth(r.token, r.admin);
        toast('已退出店铺');
        location.hash = '#/setup';
        requestRender();
      } catch (e) {}
    });
}

export { renderStore };
