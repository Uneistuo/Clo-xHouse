/** 平台管理（仅平台管理员可见） */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 平台管理（仅平台管理员可见） ================= */
async function renderPlatform(view) {
  if (!admin.isPlatform) {
    view.innerHTML = '<div class="empty">无权限：仅平台管理员可访问</div>';
    return;
  }
  view.innerHTML = `<div class="page-title">平台管理</div><div class="empty">加载中…</div>`;
  let data;
  try {
    data = await api('/api/platform/stores');
  } catch (e) {
    return;
  }
  const list = data.list || [];

  view.innerHTML = `
    <div class="page-title">平台管理 <span style="font-size:13px;color:var(--text-3);font-weight:400">共 ${list.length} 家店铺</span></div>
    <div class="card">
      ${
        list.length === 0
          ? '<div class="empty">暂无店铺</div>'
          : `<table>
            <thead><tr><th>店铺</th><th>店铺码</th><th>店主</th><th>成员</th><th>订单数</th><th>创建时间</th><th>开单授权</th><th class="t-right">操作</th></tr></thead>
            <tbody>${list
              .map(
                (s) => `
              <tr>
                <td><b>${esc(s.name)}</b></td>
                <td class="muted">${esc(s.bind_code)}</td>
                <td class="muted">${esc(s.owner_name || '-')}</td>
                <td class="t-center">${s.member_count}</td>
                <td class="t-center">${s.order_count}</td>
                <td class="muted">${esc(s.created_at)}</td>
                <td>${
                  s.enabled
                    ? `<span class="badge on">剩余 ${s.daysLeft} 天</span><div class="muted" style="font-size:12px;margin-top:2px">${esc(s.expireAt)}</div>`
                    : s.expireAt
                      ? `<span class="badge off">已到期</span><div class="muted" style="font-size:12px;margin-top:2px">${esc(s.expireAt)}</div>`
                      : '<span class="badge cancelled">未授权</span>'
                }</td>
                <td class="t-right">
                  <button class="btn small ghost" data-bill="${s.id}" data-name="${esc(s.name)}">设置授权</button>
                  <button class="btn small ghost" data-rename="${s.id}" data-rname="${esc(s.name)}" style="margin-left:6px">改名</button>
                </td>
              </tr>`
              )
              .join('')}</tbody></table>`
      }
    </div>`;

  $$('[data-bill]').forEach((b) =>
    b.addEventListener('click', () => {
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
        if (!(days > 0)) {
          toast('请输入大于 0 的天数', true);
          return;
        }
        doSet({ days });
      });
      $$('.pl-quick').forEach((q) => q.addEventListener('click', () => doSet({ days: Number(q.dataset.days) })));
      $('#pl-expire-go').addEventListener('click', () => {
        const v = $('#pl-expire').value; // YYYY-MM-DDTHH:mm
        if (!v) {
          toast('请选择到期时间', true);
          return;
        }
        doSet({ expireAt: v.replace('T', ' ') + ':00' });
      });
      $('#pl-close').addEventListener('click', async () => {
        if (!(await confirm(`确定关闭店铺【${name}】的开单权限？关闭后立即生效，该店将无法开单`))) return;
        doSet({ days: 0 });
      });
      $('#modal-cancel').addEventListener('click', closeModal);
    })
  );

  // 改名按钮（无冷却，平台管理员视角）
  $$('[data-rename]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.rename;
      const name = b.dataset.rname;
      const newName = await prompt(`新的店铺名称（无冷却，可随时修改）：`, name);
      if (!newName || !newName.trim() || newName.trim() === name) return;
      try {
        const r = await api(`/api/platform/stores/${id}/rename`, {
          method: 'POST',
          data: { storeName: newName.trim() }
        });
        toast(r.message || '店铺名称已修改');
        renderPlatform(view);
      } catch (e) {}
    })
  );
}

export { renderPlatform };
