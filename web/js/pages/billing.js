/** 开单收银 */
/* eslint-env browser */
import { $, $$, esc, fixImg, firstImg, debounce } from '../utils.js';
import { toast, openModal, closeModal, confirm, prompt, setBtnLoading } from '../ui.js';
import { api, admin } from '../store.js';
import { STATUS, STATUS_CLASS } from '../config.js';
import { requestRender } from '../bus.js';

/* ================= 开单 ================= */
const BILLING_PAGE_SIZE = 30;

/** 拉取一页在售商品（分页避免商品超过 200 条时被截断） */
async function fetchBillingGoods(page) {
  const data = await api(`/api/goods?status=on&page=${page}&pageSize=${BILLING_PAGE_SIZE}`);
  return { list: data.list || [], total: Number(data.total || 0) };
}

/** 商品卡片（列表追加时复用，图片懒加载） */
const goodsCard = (g) => `
  <div class="g-item" data-add="${g.id}">
    ${
      firstImg(g.image)
        ? `<img src="${esc(fixImg(firstImg(g.image)))}" alt="${esc(g.name)}" loading="lazy" decoding="async">`
        : '<div class="ph"><span class="icon icon-shirt"></span></div>'
    }
    <div class="g-name">${esc(g.name)}</div>
    <div class="g-price">¥${g.price}</div>
    <div class="g-stock">库存 ${g.stock}</div>
  </div>`;

async function renderBilling(view) {
  view.innerHTML = `<div class="page-title">开单</div><div class="empty">加载中…</div>`;
  let first;
  try {
    first = await fetchBillingGoods(1);
  } catch (e) {
    return;
  }
  const goodsList = first.list;
  let goodsTotal = first.total || goodsList.length;
  let goodsPage = 1;
  let loadingMore = false;
  const cart = []; // {goodsId, name, price, color, size, quantity, maxStock}
  let selectedCustomerId = 0; // 已选/已添加的会员 ID（下单时随订单落库；手动改手机号即清零）
  let blPhone = ''; // 手机号输入值（draw 重绘间保持，修复加购后输入丢失）
  let blRemark = ''; // 备注输入值（同上）

  const hasMoreGoods = () => goodsList.length < goodsTotal;
  const loadMoreHtml = () => {
    if (!goodsList.length) return '';
    if (hasMoreGoods())
      return `<button class="btn ghost" id="btn-load-more">加载更多（已显示 ${goodsList.length} / ${goodsTotal} 件）</button>`;
    return goodsTotal > BILLING_PAGE_SIZE ? `<span class="muted">已显示全部 ${goodsList.length} 件商品</span>` : '';
  };

  const draw = () => {
    view.innerHTML = `
      <div class="page-title">开单</div>
      <div class="billing-wrap">
        <div class="billing-goods">
          ${
            goodsList.length === 0
              ? '<div class="empty">暂无在售商品，请先到「商品」页添加</div>'
              : `<div class="billing-goods-grid">${goodsList.map(goodsCard).join('')}</div>`
          }
          <div class="load-more" id="load-more-wrap">${loadMoreHtml()}</div>
        </div>
        <div class="cart-panel card">
          <b style="font-size:15px">当前订单</b>
          <div id="cart-lines">
            ${
              cart.length === 0
                ? '<div class="empty">点击左侧商品加入订单</div>'
                : cart
                    .map(
                      (it, i) => `
              <div class="cart-line">
                <div class="cl-info">
                  <div class="cl-name">${esc(it.name)}</div>
                  <div class="cl-sku">${it.color || it.size ? `${esc(it.color || '默认')} / ${esc(it.size || '默认')}` : '默认规格'} · ¥${it.price}</div>
                </div>
                <div class="qty">
                  <button data-dec="${i}">−</button><span>${it.quantity}</span><button data-inc="${i}">＋</button>
                </div>
              </div>`
                    )
                    .join('')
            }
          </div>
          <div class="cart-total"><span>合计</span><span class="sum">¥${cart.reduce((s, it) => s + it.price * it.quantity, 0).toFixed(2)}</span></div>
          <div class="field" style="margin-top:10px">
            <span class="lbl">顾客手机（选填）</span>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="bl-phone" maxlength="11" placeholder="售后联系；输 4 位识别会员" style="flex:1" value="${esc(blPhone)}">
              <button class="btn small ghost" id="bl-add-customer" type="button" style="display:none;white-space:nowrap">+ 添加会员</button>
            </div>
            <div id="bl-matches" style="margin-top:8px"></div>
          </div>
          <label class="field"><span class="lbl">备注（选填）</span><input id="bl-remark" placeholder="如：打折、包邮" value="${esc(blRemark)}"></label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-2);margin-bottom:6px">
            <input type="checkbox" id="bl-paid" style="width:auto">顾客已现场付款（直接记为已收款）
          </label>
          <button class="btn" id="btn-submit" style="width:100%;padding:12px;font-size:15px" ${cart.length === 0 ? 'disabled' : ''}>确认开单</button>
        </div>
      </div>`;

    // 点击商品加入订单（事件委托，追加分页数据后无需重新绑定）
    $('.billing-goods').addEventListener('click', (e) => {
      const el = e.target.closest('[data-add]');
      if (!el) return;
      const g = goodsList.find((x) => String(x.id) === el.dataset.add);
      if (!g) return;
      if (g.stock <= 0) {
        toast('该商品库存不足', true);
        return;
      }
      if (g.skus && g.skus.length) openSkuPicker(g);
      else
        addToCart({
          goodsId: g.id,
          name: g.name,
          price: g.price,
          color: '',
          size: '',
          maxStock: g.stock,
          quantity: 1
        });
    });
    const bindQty = () => {
      $$('[data-inc]').forEach((b) =>
        b.addEventListener('click', () => {
          const it = cart[Number(b.dataset.inc)];
          if (it.quantity >= it.maxStock) {
            toast('已达该规格库存上限', true);
            return;
          }
          it.quantity++;
          draw();
        })
      );
      $$('[data-dec]').forEach((b) =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.dec);
          cart[i].quantity--;
          if (cart[i].quantity <= 0) cart.splice(i, 1);
          draw();
        })
      );
    };
    bindQty();
    // draw() 会重建按钮，因此每次重绘都要重新绑定「加载更多」
    const moreBtn = $('#btn-load-more');
    if (moreBtn) moreBtn.addEventListener('click', loadMore);

    const updateLoadMore = () => {
      const wrap = $('#load-more-wrap');
      if (!wrap) return;
      wrap.innerHTML = loadMoreHtml();
      const btn = $('#btn-load-more');
      if (btn) btn.addEventListener('click', loadMore);
    };

    // 函数声明会提升，供上面 draw() 内的按钮绑定安全引用
    async function loadMore() {
      if (loadingMore || !hasMoreGoods()) return;
      loadingMore = true;
      const btn = $('#btn-load-more');
      setBtnLoading(btn, true);
      try {
        const next = await fetchBillingGoods(goodsPage + 1);
        goodsPage += 1;
        if (next.total) goodsTotal = next.total;
        // 后端返回空页时停止继续加载，避免 total 异常导致死循环
        if (!next.list.length) goodsTotal = goodsList.length;
        const grid = $('.billing-goods-grid');
        if (grid && next.list.length) grid.insertAdjacentHTML('beforeend', next.list.map(goodsCard).join(''));
        goodsList.push(...next.list);
        updateLoadMore();
      } catch (e) {
      } finally {
        loadingMore = false;
        const b = $('#btn-load-more');
        if (b) setBtnLoading(b, false);
      }
    }

    // ===== 会员识别：输入 11 位检查是否已注册 / 输入 4 位查询预选 =====
    const phoneEl = $('#bl-phone');
    const matchesEl = $('#bl-matches');
    const addBtn = $('#bl-add-customer');
    phoneEl.addEventListener('input', async () => {
      blPhone = phoneEl.value.replace(/\D/g, '').slice(0, 11);
      phoneEl.value = blPhone;
      selectedCustomerId = 0; // 手动改手机号即取消会员关联
      addBtn.style.display = 'none';
      matchesEl.innerHTML = '';
      try {
        if (blPhone.length === 11) {
          const d = await api(`/api/customer/exists?phone=${blPhone}`);
          if (d && !d.exists) addBtn.style.display = '';
        } else if (blPhone.length === 4) {
          const d = await api('/api/customer/match', { method: 'POST', data: { suffix: blPhone } });
          const list = (d && d.list) || [];
          if (list.length) {
            matchesEl.innerHTML = list
              .map(
                (c) => `
              <div class="bl-match" data-id="${c.id}" data-phone="${esc(c.phone)}" data-name="${esc(c.displayName)}"
                   style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-subtle);border-radius:8px;margin-bottom:4px;cursor:pointer;font-size:13px">
                <b>${esc(c.displayName)}</b><span class="muted">${esc(c.phone)}</span>
              </div>`
              )
              .join('');
            $$('.bl-match').forEach((el) =>
              el.addEventListener('click', () => {
                selectedCustomerId = Number(el.dataset.id);
                blPhone = el.dataset.phone;
                phoneEl.value = blPhone;
                matchesEl.innerHTML = '';
                addBtn.style.display = 'none';
                toast(`已选择 ${el.dataset.name}`);
              })
            );
          }
        }
      } catch (e) {}
    });

    // 添加会员弹窗（输入姓氏 + 性别，成功后记住 ID 供本次开单关联）
    addBtn.addEventListener('click', () => {
      openModal(`
        <h3>添加会员</h3>
        <p class="muted" style="margin:4px 0 12px;font-size:13px">手机号 ${esc(blPhone)}</p>
        <form id="add-customer-form">
          <label class="field"><span class="lbl">姓氏</span><input name="surname" maxlength="10" placeholder="如：赵" required></label>
          <label class="field"><span class="lbl">性别</span>
            <select name="gender" style="width:100%">
              <option value="1">先生</option>
              <option value="2">女士</option>
            </select>
          </label>
          <button class="btn" style="width:100%;margin-top:6px">确认添加</button>
        </form>`);
      $('#add-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const r = await api('/api/customer', {
            method: 'POST',
            data: { phone: blPhone, surname: String(fd.get('surname') || '').trim(), gender: Number(fd.get('gender')) }
          });
          toast(r.message || '已添加会员');
          selectedCustomerId = (r && r.id) || 0;
          addBtn.style.display = 'none';
          closeModal();
        } catch (e2) {}
      });
    });

    // 备注输入：重绘间保持
    $('#bl-remark').addEventListener('input', (e) => {
      blRemark = e.target.value;
    });

    const addToCart = (item) => {
      const found = cart.find((x) => x.goodsId === item.goodsId && x.color === item.color && x.size === item.size);
      if (found) {
        if (found.quantity >= found.maxStock) {
          toast('已达该规格库存上限', true);
          return;
        }
        found.quantity++;
      } else cart.push(item);
      draw();
    };

    $('#btn-submit').addEventListener('click', async () => {
      if (!cart.length) return;
      const btn = $('#btn-submit');
      setBtnLoading(btn, true);
      try {
        const res = await api('/api/orders', {
          method: 'POST',
          data: {
            items: cart.map((it) => ({ goodsId: it.goodsId, color: it.color, size: it.size, quantity: it.quantity })),
            customerPhone: blPhone.trim(),
            customerId: selectedCustomerId || 0,
            remark: blRemark.trim(),
            paidNow: $('#bl-paid').checked
          }
        });
        toast(`开单成功：${res.orderNo}（¥${res.totalAmount}）`);
        cart.length = 0;
        selectedCustomerId = 0;
        blPhone = '';
        blRemark = ''; // 清空本次开单输入
        // 重新拉取第一页商品以刷新库存（分页状态一并重置）
        try {
          const d2 = await fetchBillingGoods(1);
          goodsList.length = 0;
          goodsList.push(...d2.list);
          goodsTotal = d2.total || goodsList.length;
          goodsPage = 1;
        } catch (e) {}
        draw();
      } catch (e) {
        setBtnLoading(btn, false);
      }
    });

    function openSkuPicker(g) {
      openModal(`
        <h3>选择规格 · ${esc(g.name)}</h3>
        <table>
          <thead><tr><th>颜色</th><th>尺码</th><th>库存</th><th class="t-right">数量</th></tr></thead>
          <tbody>${g.skus
            .map(
              (s) => `
            <tr>
              <td>${esc(s.color || '默认')}</td><td>${esc(s.size || '默认')}</td>
              <td>${s.stock}</td>
              <td class="t-right">${
                s.stock > 0
                  ? `<button class="btn small" data-sku-pick data-gid="${g.id}" data-gname="${esc(g.name)}" data-price="${g.price}" data-color="${esc(s.color || '')}" data-size="${esc(s.size || '')}" data-stock="${s.stock}">加入</button>`
                  : '<span class="muted">无货</span>'
              }</td>
            </tr>`
            )
            .join('')}</tbody>
        </table>
        <div class="modal-actions"><button class="btn ghost" id="modal-cancel">取消</button></div>`);
      $('#modal-cancel').addEventListener('click', closeModal);
      $$('[data-sku-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          closeModal();
          addToCart({
            goodsId: Number(b.dataset.gid),
            name: b.dataset.gname,
            price: Number(b.dataset.price),
            color: b.dataset.color,
            size: b.dataset.size,
            maxStock: Number(b.dataset.stock),
            quantity: 1
          });
        })
      );
    }
  };
  draw();
}

export { renderBilling };
