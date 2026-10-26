/** 商品管理：列表、编辑弹窗、分类管理 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin, token, saveAuth, clearAuth } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 商品管理 ================= */
async function renderGoods(view) {
  const state = { keyword: '', status: '', categoryId: '', page: 1, pageSize: 15 };
  view.innerHTML = `<div class="page-title">商品管理</div><div class="empty">加载中…</div>`;

  const load = async () => {
    const q =
      `/api/goods?page=${state.page}&pageSize=${state.pageSize}` +
      (state.keyword ? `&keyword=${encodeURIComponent(state.keyword)}` : '') +
      (state.status ? `&status=${state.status}` : '') +
      (state.categoryId ? `&categoryId=${state.categoryId}` : '');
    let data, cats;
    try {
      [data, cats] = await Promise.all([api(q), api('/api/category')]);
    } catch (e) {
      return;
    }

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
        ${
          !data.list || data.list.length === 0
            ? '<div class="empty">暂无商品，点击「新增商品」添加</div>'
            : `<table>
              <thead><tr><th></th><th>商品</th><th>货号</th><th>分类</th><th>售价</th><th>总库存</th><th>状态</th><th class="t-right">操作</th></tr></thead>
              <tbody>${data.list
                .map(
                  (g) => `
                <tr>
                  <td>${firstImg(g.image) ? `<img class="goods-img" src="${esc(fixImg(firstImg(g.image)))}" alt="${esc(g.name)}" loading="lazy" decoding="async">` : '<div class="goods-img-placeholder"><span class="icon icon-shirt"></span></div>'}</td>
                  <td><b>${esc(g.name)}</b>${g.skus && g.skus.length ? `<div class="muted" style="font-size:12px">${g.skus.map((s) => `${esc(s.color || '默认')}/${esc(s.size || '默认')}×${s.stock}`).join('，')}</div>` : ''}</td>
                  <td class="muted">${esc(g.goods_no || '-')}</td>
                  <td class="muted">${esc(g.category_name || '-')}</td>
                  <td style="color:var(--primary-dark);font-weight:700">¥${g.price}</td>
                  <td class="${g.stock <= 5 ? 'stock-warn' : ''}">${g.stock}</td>
                  <td><span class="badge ${g.on_sale ? 'on' : 'off'}">${g.on_sale ? '在售' : '下架'}</span></td>
                  <td class="t-right">
                    <button class="btn small ghost" data-edit="${g.id}">编辑</button>
                    <button class="btn small light" data-toggle="${g.id}" data-on="${g.on_sale}">${g.on_sale ? '下架' : '上架'}</button>
                    <button class="btn small danger" data-del="${g.id}">删除</button>
                  </td>
                </tr>`
                )
                .join('')}</tbody></table>
              <div class="pager">
                <button class="btn small ghost" id="pg-prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
                <span>第 ${data.page} 页 / 共 ${Math.max(1, Math.ceil(data.total / state.pageSize))} 页（${data.total} 件）</span>
                <button class="btn small ghost" id="pg-next" ${state.page >= Math.ceil(data.total / state.pageSize) ? 'disabled' : ''}>下一页</button>
              </div>`
        }
      </div>`;

    // 事件绑定
    const onGoodsKeyword = debounce(() => {
      state.keyword = $('#g-keyword').value.trim();
      state.page = 1;
      load();
    }, 300);
    $('#g-keyword').addEventListener('input', onGoodsKeyword);
    $('#g-keyword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onGoodsKeyword();
    });
    $('#g-status').addEventListener('change', (e) => {
      state.status = e.target.value;
      state.page = 1;
      load();
    });
    $('#g-cat').addEventListener('change', (e) => {
      state.categoryId = e.target.value;
      state.page = 1;
      load();
    });
    $('#btn-add').addEventListener('click', () => openGoodsEditor(null, load));
    $('#btn-cat').addEventListener('click', () => openCategoryManager(load));
    if ($('#pg-prev'))
      $('#pg-prev').addEventListener('click', () => {
        state.page--;
        load();
      });
    if ($('#pg-next'))
      $('#pg-next').addEventListener('click', () => {
        state.page++;
        load();
      });
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openGoodsEditor(Number(b.dataset.edit), load)));
    $$('[data-toggle]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api(`/api/goods/${b.dataset.toggle}/status`, {
            method: 'PUT',
            data: { onSale: b.dataset.on === '1' ? 0 : 1 }
          });
          toast('操作成功');
          load();
        } catch (e) {}
      })
    );
    $$('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirm('确定删除该商品吗？（删除后不可恢复）'))) return;
        try {
          await api(`/api/goods/${b.dataset.del}`, { method: 'DELETE' });
          toast('已删除');
          load();
        } catch (e) {}
      })
    );
  };
  load();
}

/** 新增 / 编辑商品弹窗（编辑时传 id） */
async function openGoodsEditor(id, onDone) {
  let cats = [];
  let g = {
    name: '',
    goods_no: '',
    image: '',
    price: '',
    original_price: '',
    colors: '',
    sizes: '',
    stock: 0,
    category_id: '',
    description: '',
    on_sale: 1
  };
  try {
    cats = await api('/api/category');
    if (id) g = await api('/api/goods/' + id);
  } catch (e) {
    return;
  }

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
          ${images.map((u) => `<img src="${esc(fixImg(u))}" alt="商品图片" loading="lazy" decoding="async" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`).join('')}
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
    if (files.length + images.length > 3) {
      toast('最多 3 张图片', true);
      e.target.value = '';
      return;
    }
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', f);
      try {
        const data = await api('/api/upload', { method: 'POST', form: fd });
        images.push(data.url);
      } catch (e2) {
        return;
      }
    }
    $('#img-list').innerHTML = images
      .map(
        (u) =>
          `<img src="${esc(fixImg(u))}" alt="商品图片" loading="lazy" decoding="async" style="width:60px;height:60px;object-fit:cover;border-radius:8px">`
      )
      .join('');
    e.target.value = '';
  });

  $('#modal-cancel').addEventListener('click', closeModal);
  $('#goods-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = $('button[type=submit]', e.target);
    setBtnLoading(btn, true);
    if (images.length > 3) {
      toast('最多 3 张图片', true);
      setBtnLoading(btn, false);
      return;
    }
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
    setBtnLoading(btn, false);
  });
}

/** 分类管理弹窗 */
async function openCategoryManager(onDone) {
  let cats = [];
  try {
    cats = await api('/api/category');
  } catch (e) {
    return;
  }
  const drawList = () => `
    <table><tbody>
      ${
        cats
          .map(
            (c) => `<tr>
        <td>${esc(c.name)}</td><td class="muted">${c.goods_count} 件商品</td>
        <td class="t-right">
          <button class="btn small ghost" data-cedit="${c.id}">改名</button>
          <button class="btn small danger" data-cdel="${c.id}">删除</button>
        </td></tr>`
          )
          .join('') || '<tr><td colspan="3" class="empty">暂无分类</td></tr>'
      }
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
    try {
      cats = await api('/api/category');
    } catch (e) {
      return;
    }
    $('#cat-list').innerHTML = drawList();
    bindRow();
  };
  const bindRow = () => {
    $$('[data-cedit]').forEach((b) =>
      b.addEventListener('click', async () => {
        const c = cats.find((x) => String(x.id) === b.dataset.cedit);
        const name = await prompt('新的分类名称：', c.name);
        if (!name || !name.trim()) return;
        try {
          await api('/api/category/' + c.id, { method: 'PUT', data: { name: name.trim(), sort: c.sort } });
          toast('已保存');
          refresh();
        } catch (e) {}
      })
    );
    $$('[data-cdel]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirm('确定删除该分类吗？'))) return;
        try {
          await api('/api/category/' + b.dataset.cdel, { method: 'DELETE' });
          toast('已删除');
          refresh();
          onDone && onDone();
        } catch (e) {}
      })
    );
  };
  bindRow();
  $('#cat-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    try {
      await api('/api/category', { method: 'POST', data: { name, sort: (cats.length + 1) * 100 } });
      toast('已添加');
      e.target.reset();
      refresh();
      onDone && onDone();
    } catch (e2) {}
  });
  $('#modal-cancel').addEventListener('click', closeModal);
}

export { renderGoods, openGoodsEditor, openCategoryManager };
