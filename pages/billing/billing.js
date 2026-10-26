// 开单页：商家现场出单（优化版：dialog.confirm 替代 wx.showModal + 按钮加载态）
// 流程：搜索/选择上架商品 -> 选颜色尺码、数量（自动算小计）-> 多件商品合并订单
//      -> 填客户手机号/备注/收款方式 -> 提交（后端事务：生成订单 + 自动扣减库存）
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');
const { printer } = require('../../utils/printer');
const { buildReceiptWithSettings, recordPrint } = require('../../utils/print-service');
const { confirm, toast, loading: showLoading, hideLoading } = require('../../utils/dialog');
const warmup = require('../../utils/warmup');

/** 低库存阈值（与统计接口 LOW_STOCK 一致） */
const LOW_STOCK = 5;
/** 常用规格记忆存储键（按商品 id 存最近 3 个组合） */
const RECENT_SPECS_KEY = 'billing_recent_specs';
/** 常用商品记忆存储键（最近一次成交项，去重后最多 3 条） */
const FREQUENT_GOODS_KEY = 'billing_frequent_goods';
/** 首页「快速开单」写入的一次性标记：开单页消费后按常用商品预置购物车 */
const PRESET_FLAG_KEY = 'billing_preset_frequent';
/**
 * 店铺授权信息缓存：开单授权横幅 / 受限态决定页面首屏高度，
 * 首帧用缓存渲染可避免「先进页面、后补数据」造成的整页下移。
 */
const STORE_CACHE_KEY = 'billing_store_cache';
/** 结算栏「拉出」类名的兜底清理时间：正常由 animationend 精确摘除，动画被降级/中断时靠它 */
const DOCK_PULL_MS = 420;

function readStoreCache() {
  try {
    const c = wx.getStorageSync(STORE_CACHE_KEY);
    if (c && typeof c === 'object' && 'billingEnabled' in c) return c;
  } catch (e) {}
  return null;
}

const storeCache = readStoreCache();

Page({
  /** 空处理：配合 wxml 中的 catchtap，阻止弹窗内点击事件冒泡到遮罩 */
  noop() {},

  data: {
    keyword: '',
    goodsList: [],
    // 商品列表分页状态（P1-3：首屏只拉 20 条，触底加载更多，搜索走服务端）
    page: 1,
    hasMore: false,
    loading: false,
    cart: [],
    totalAmount: '0.00',
    totalQuantity: 0,

    selectVisible: false,
    selGoods: null,
    selColor: '',
    selSize: '',
    selQty: 1,
    selColors: [],
    selSizes: [],
    selSkuStock: 0,
    addingItem: false, // 规格弹层“加入订单”按钮加载态

    customerPhone: '',
    remark: '',
    submitting: false,
    // 首屏直接用上次的授权信息渲染：横幅/受限态若晚到，会把下方内容整体推下去
    restricted: storeCache ? !storeCache.billingEnabled : false,
    restrictedExpired: storeCache ? !storeCache.billingEnabled && !!storeCache.billingExpireAt : false,
    billingExpireText: storeCache && storeCache.billingEnabled ? storeCache.billingExpireAt || '' : '',
    dockPulling: false, // 结算栏「从 TabBar 后方拉出」动画：只在普通栏→拼接栏那一次为 true
    dockHidden: false, // 页面被隐藏时先把结算栏藏起来，避免下次显示的第一帧先露出原位（见 onHide）
    successInfo: null,

    showAddCustomerBtn: false,
    customerMatches: [],
    selectedCustomerId: 0,
    addCustomerVisible: false,
    newCustomerSurname: '',
    newCustomerGender: 0
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this._syncTabBar();
    this.restoreCart();
    this._consumePresetFlag();
    this.checkBilling();
    this.loadGoods(true);
    this._ensurePrinterConnected();
  },

  /** 消费首页「快速开单」标记：首屏商品加载完成后按常用商品预置购物车（一次性） */
  _consumePresetFlag() {
    this._presetPending = false;
    try {
      if (wx.getStorageSync(PRESET_FLAG_KEY)) {
        wx.removeStorageSync(PRESET_FLAG_KEY);
        this._presetPending = true;
      }
    } catch (e) {}
  },

  /** 同步 TabBar：开单页隐藏悬浮圆钮；仅结算栏可见时才与 TabBar 拼接 */
  _syncTabBar() {
    if (typeof this.getTabBar !== 'function') return;
    const tabBar = this.getTabBar();
    if (!tabBar || typeof tabBar.applyBarState !== 'function') return;
    const dock = !this.data.restricted;
    const info = tabBar.applyBarState({ selected: 2, dock });
    // 结算栏要拉出的两种情形：
    //   · c：普通栏 → 拼接栏，栏体刚落位，结算栏跟着从后方抽出来；
    //   · 页面从缓存里重新显示（onHide 里把结算栏藏了）：也要拉一次，
    //     否则它会直接"凭空出现"，看着又是一次弹跳。
    if (dock && (!info || info.switching === 'c' || this.data.dockHidden)) {
      this._pullDockCard();
    } else if (this.data.dockHidden) {
      this.setData({ dockHidden: false });
    }
  },

  /**
   * 结算栏拉出：类名留在场上时 CSS 不会重播，所以同一状态的重复同步不会打断动画。
   * 结算栏是固定定位的，动画只走 transform，不影响列表排版。
   */
  _pullDockCard() {
    if (this.data.dockPulling) return;
    clearTimeout(this._pullTimer);
    this.setData({ dockPulling: true, dockHidden: false });
    this._pullTimer = setTimeout(() => this.setData({ dockPulling: false }), DOCK_PULL_MS);
  },

  /** 结算栏「拉出」动画结束：立刻摘掉类名，z-index 在落位那一帧就回到 TabBar 之上 */
  onDockPullEnd() {
    clearTimeout(this._pullTimer);
    if (this.data.dockPulling) this.setData({ dockPulling: false });
  },

  /**
   * 离开页面时先把结算栏藏起来（只改透明度，不动布局）。
   * 开单页是 tab 页，会被缓存复用：不藏的话，下次切回来的第一帧画的是
   * 「上一次的静止态」，紧接着才被动画拉下去重新抽出——看起来就是弹两下。
   */
  onHide() {
    clearTimeout(this._pullTimer);
    this.setData({ dockPulling: false, dockHidden: true });
  },

  onUnload() {
    clearTimeout(this._searchTimer);
    clearTimeout(this._pullTimer);
  },

  onPullDownRefresh() {
    this.checkBilling();
    this.loadGoods(true).finally(() => wx.stopPullDownRefresh());
  },

  /** 触底加载更多商品（P1-3） */
  onReachBottom() {
    if (this.data.hasMore) this.loadGoods(false);
  },

  restoreCart() {
    try {
      const cart = wx.getStorageSync('billing_cart');
      if (!Array.isArray(cart) || !cart.length) return;
      // 购物车没变化就不回填：每次 onShow 重建购物车节点会让列表下方内容重新排版
      if (JSON.stringify(cart) === JSON.stringify(this.data.cart)) return;
      this.setData({ cart });
      this.calcTotal();
    } catch (e) {}
  },

  persistCart() {
    try {
      wx.setStorageSync('billing_cart', this.data.cart);
    } catch (e) {}
  },

  _ensurePrinterConnected() {
    const saved = printer.loadSavedDevice();
    if (!saved || printer.connected) return;
    printer.quickConnect(saved.deviceId).catch(() => {});
  },

  async _checkPrinterBeforeBill() {
    const saved = printer.loadSavedDevice();
    if (saved) return true;
    const go = await confirm({
      title: '未连接打印机',
      content: '检测到您还未配对蓝牙打印机，开单后将无法自动打印小票。是否前往配对？',
      confirmText: '去配对',
      cancelText: '暂不开单'
    });
    if (go) wx.redirectTo({ url: '/pages/printer-pair/printer-pair' });
    return false;
  },

  async _printReceipt(orderData) {
    const { orderNo, totalAmount, customerPhone, remark, items } = orderData;
    let storeName = '';
    let salesName = '';
    try {
      const admin = wx.getStorageSync('adminInfo') || {};
      storeName = admin.storeName || '';
      salesName = admin.username || '';
      const storeInfo = await request({ url: '/api/store/info' });
      if (storeInfo && storeInfo.store) {
        storeName = storeInfo.store.name || storeName;
      }
    } catch (e) {}

    const receiptBytes = buildReceiptWithSettings({
      store: { name: storeName },
      admin: { username: salesName },
      order: { orderNo, totalAmount, customerPhone, remark },
      items
    });

    if (!printer.connected) {
      const saved = printer.loadSavedDevice();
      if (!saved) {
        recordPrint({ orderNo, ok: false });
        const go = await confirm({
          title: '未配对打印机',
          content: '订单已生成，但无法打印小票。是否前往配对？',
          confirmText: '去配对',
          cancelText: '暂不'
        });
        if (go) wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
        return;
      }
      const ok = await printer.quickConnect(saved.deviceId);
      if (!ok) {
        await this._showPrintFailModal(receiptBytes, orderNo);
        return;
      }
    }

    try {
      await printer.writeBytes(receiptBytes);
      recordPrint({ orderNo, ok: true });
      toast('小票已打印', 'success');
    } catch (e) {
      console.error('[print]', e);
      await this._showPrintFailModal(receiptBytes, orderNo);
    }
  },

  async _showPrintFailModal(receiptBytes, orderNo) {
    const retry = await confirm({
      title: '打印失败',
      content: `订单 ${orderNo} 已生成，但小票打印失败。是否重试？`,
      confirmText: '重试',
      cancelText: '跳过'
    });
    if (!retry) {
      recordPrint({ orderNo, ok: false });
      return;
    }
    try {
      const saved = printer.loadSavedDevice();
      if (saved && !printer.connected) {
        await printer.quickConnect(saved.deviceId);
      }
      await printer.writeBytes(receiptBytes);
      recordPrint({ orderNo, ok: true });
      toast('小票已打印', 'success');
    } catch (e2) {
      recordPrint({ orderNo, ok: false });
      toast('打印失败，已跳过', 'none');
    }
  },

  async checkBilling() {
    try {
      const data = await request({ url: '/api/store/info' });
      const expireAt = data.billingExpireAt || '';
      const next = {
        restricted: !data.billingEnabled,
        restrictedExpired: !data.billingEnabled && !!expireAt,
        billingExpireText: data.billingEnabled ? expireAt : ''
      };
      // 写回缓存：下次进页面首帧就有正确高度（横幅/受限态不会晚到）
      try {
        wx.setStorageSync(STORE_CACHE_KEY, {
          billingEnabled: !!data.billingEnabled,
          billingExpireAt: expireAt
        });
      } catch (e) {}
      // 只下发真正变化的字段：避免每次 onShow 都触发一次整页重排
      const patch = {};
      Object.keys(next).forEach((k) => {
        if (this.data[k] !== next[k]) patch[k] = next[k];
      });
      if (Object.keys(patch).length) {
        this.setData(patch);
        if ('restricted' in patch) this._syncTabBar();
      }
    } catch (e) {}
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    // 搜索走服务端：防抖 400ms 后重置分页并加载第一页（P1-3）
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadGoods(true), 400);
  },

  /** 清空搜索词并重新加载 */
  clearKeyword() {
    clearTimeout(this._searchTimer);
    this.setData({ keyword: '' });
    this.loadGoods(true);
  },

  /**
   * 加载商品列表（P1-3 分页加载）
   * - reset=true：搜索/下拉刷新/开单完成后重置到第一页
   * - reset=false：onReachBottom 追加下一页
   * 搜索词由服务端过滤（keyword 参数），保证“加载更多”的结果也参与匹配
   */
  async loadGoods(reset = true) {
    if (!reset && (this.data.loading || !this.data.hasMore)) return;
    const page = reset ? 1 : this.data.page + 1;
    const seq = (this._goodsSeq = (this._goodsSeq || 0) + 1); // 丢弃过期响应（快速输入搜索词时）
    // 已经成功加载过一次后，再次进入页面走静默刷新：
    // 不翻 loading，骨架屏/加载提示节点就不会被重建，页面显示后不再重排
    const silent = reset && this._goodsLoadedOnce;
    const params = { keyword: this.data.keyword.trim(), status: 'on', page, pageSize: 20 };
    // 首次进入命中启动预热：直接渲染，骨架屏不出现
    const warm = reset && !silent ? warmup.take('billing-goods', params) : null;
    if (!silent && !warm) this.setData({ loading: true });
    try {
      const data = warm || (await request({ url: '/api/goods', data: params }));
      if (seq !== this._goodsSeq) return;
      const list = (data.list || []).map((g) => ({
        ...g,
        colorArr: g.colors ? g.colors.split(',').filter(Boolean) : [],
        sizeArr: g.sizes ? g.sizes.split(',').filter(Boolean) : [],
        skus: g.skus || [],
        priceText: fmtMoney(g.price),
        cover: g.image ? resolveImg(g.image.split(',')[0], BASE_URL) : ''
      }));
      const merged = reset ? list : this.data.goodsList.concat(list);
      this._goodsLoadedOnce = true;
      this.setData({
        goodsList: merged,
        page,
        hasMore: merged.length < (data.total || 0),
        loading: false
      });
      // 首页「快速开单」进入后，首屏商品加载完成时按常用商品预置购物车
      if (reset && this._presetPending) this._presetFrequentGoods();
      // 预热快照可能已经过时：先渲染再静默补拉一次最新数据
      if (warm) this.loadGoods(true);
    } catch (e) {
      if (seq === this._goodsSeq && this.data.loading) this.setData({ loading: false });
    }
  },

  /** 商品封面加载失败 -> 显示占位图（P1-4） */
  onGoodsImgError(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) return;
    this.setData({ [`goodsList[${index}].cover`]: '' });
  },

  getSkuStock(goods, color, size) {
    if (!goods.skus || goods.skus.length === 0) return goods.stock || 0;
    const sku = goods.skus.find((s) => (s.color || '') === (color || '') && (s.size || '') === (size || ''));
    return sku ? sku.stock : 0;
  },

  /** 读取某商品的常用规格记忆（最近选择的组合，最多 3 个） */
  _loadRecentSpecs(goodsId) {
    try {
      const all = wx.getStorageSync(RECENT_SPECS_KEY) || {};
      return Array.isArray(all[goodsId]) ? all[goodsId] : [];
    } catch (e) {
      return [];
    }
  },

  /** 记录本次选择的规格组合，下次开单置顶显示 */
  _saveRecentSpec(goodsId, color, size) {
    try {
      const all = wx.getStorageSync(RECENT_SPECS_KEY) || {};
      const key = String(goodsId);
      const list = Array.isArray(all[key]) ? all[key] : [];
      const combo = { color: color || '', size: size || '' };
      all[key] = [combo, ...list.filter((r) => !(r.color === combo.color && r.size === combo.size))].slice(0, 3);
      wx.setStorageSync(RECENT_SPECS_KEY, all);
    } catch (e) {}
  },

  // ============ 常用商品预置（首页「快速开单」用） ============
  /** 开单成功后记住本次成交项（按规格去重，最多 3 条），下次快速开单可一键预置 */
  _rememberFrequentGoods(cart) {
    try {
      const seen = new Set();
      const list = [];
      for (const c of cart) {
        const item = { goodsId: c.goodsId, color: c.color || '', size: c.size || '' };
        const key = `${item.goodsId}|${item.color}|${item.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(item);
        if (list.length >= 3) break;
      }
      wx.setStorageSync(FREQUENT_GOODS_KEY, list);
    } catch (e) {}
  },

  /**
   * 为商品挑选一个可下单的规格（优先沿用上次的；缺货则回退到第一个有库存的组合）
   * @returns {{color: string, size: string} | null} 无货返回 null
   */
  _pickSpec(goods, color, size) {
    const colors = (goods.colorArr && goods.colorArr.length ? goods.colorArr : ['']).slice();
    const sizes = (goods.sizeArr && goods.sizeArr.length ? goods.sizeArr : ['']).slice();
    const preferColor = colors.includes(color) ? color : colors[0];
    const preferSize = sizes.includes(size) ? size : sizes[0];
    if (this.getSkuStock(goods, preferColor, preferSize) > 0) {
      return { color: preferColor, size: preferSize };
    }
    for (const c of colors) {
      for (const s of sizes) {
        if (this.getSkuStock(goods, c, s) > 0) return { color: c, size: s };
      }
    }
    return null;
  },

  /** 按「常用商品」把上次成交项（默认规格、数量 1、校验库存）预置进购物车 */
  _presetFrequentGoods() {
    if (!this._presetPending) return;
    this._presetPending = false;
    if (this.data.cart.length) return; // 已有购物车内容时不打扰
    let frequent = [];
    try {
      frequent = wx.getStorageSync(FREQUENT_GOODS_KEY) || [];
    } catch (e) {}
    if (!Array.isArray(frequent) || !frequent.length) return;
    const cart = [];
    for (const f of frequent) {
      const goods = this.data.goodsList.find((g) => g.id === f.goodsId);
      if (!goods) continue; // 商品已下架/不在首屏 -> 静默跳过
      const spec = this._pickSpec(goods, f.color, f.size);
      if (!spec) continue; // 无库存 -> 静默跳过
      const stock = this.getSkuStock(goods, spec.color, spec.size);
      cart.push({
        goodsId: goods.id,
        goodsNo: goods.goods_no || '',
        name: goods.name,
        cover: goods.cover,
        color: spec.color,
        size: spec.size,
        price: goods.price,
        quantity: 1,
        stock,
        subtotal: fmtMoney(goods.price)
      });
    }
    if (!cart.length) return;
    this.setData({ cart });
    this.calcTotal();
    this.persistCart();
    toast(`已按上次开单预置 ${cart.length} 件商品，可直接结算`, 'none');
  },

  /** 某规格选项是否库存不足（< LOW_STOCK）：按另一维当前选中值过滤 */
  _isLowOption(goods, kind, value, otherValue) {
    const skus = goods.skus || [];
    if (!skus.length) return (goods.stock || 0) < LOW_STOCK;
    let total = 0;
    for (const s of skus) {
      const color = s.color || '';
      const size = s.size || '';
      if (kind === 'color') {
        if (color !== value) continue;
        if (otherValue && size !== otherValue) continue;
      } else {
        if (size !== value) continue;
        if (otherValue && color !== otherValue) continue;
      }
      total += s.stock || 0;
    }
    return total < LOW_STOCK;
  },

  /** 构建规格选项（常用规格置顶 + 低库存标记） */
  _buildSelOptions(goods, selColor, selSize, recent) {
    const recentColors = new Set(recent.map((r) => r.color).filter(Boolean));
    const recentSizes = new Set(recent.map((r) => r.size).filter(Boolean));
    const sortByRecent = (arr, recentSet) =>
      arr.slice().sort((a, b) => (recentSet.has(b) ? 1 : 0) - (recentSet.has(a) ? 1 : 0));
    return {
      selColors: sortByRecent(goods.colorArr || [], recentColors).map((v) => ({
        value: v,
        low: this._isLowOption(goods, 'color', v, selSize),
        recent: recentColors.has(v)
      })),
      selSizes: sortByRecent(goods.sizeArr || [], recentSizes).map((v) => ({
        value: v,
        low: this._isLowOption(goods, 'size', v, selColor),
        recent: recentSizes.has(v)
      }))
    };
  },

  openSelect(e) {
    const goods = this.data.goodsList.find((g) => g.id === e.currentTarget.dataset.id);
    if (!goods) return;
    if (goods.stock <= 0) {
      toast('该商品库存不足', 'none');
      return;
    }
    // 常用规格记忆：命中且仍有库存时预选
    const recent = this._loadRecentSpecs(goods.id);
    let selColor = '';
    let selSize = '';
    const last = recent[0];
    if (last && this.getSkuStock(goods, last.color, last.size) > 0) {
      if (!goods.colorArr.length || goods.colorArr.includes(last.color)) selColor = last.color;
      if (!goods.sizeArr.length || goods.sizeArr.includes(last.size)) selSize = last.size;
    }
    const opts = this._buildSelOptions(goods, selColor, selSize, recent);
    const partial = (opts.selColors.length && !selColor) || (opts.selSizes.length && !selSize);
    this.setData({
      selectVisible: true,
      selGoods: goods,
      selColor,
      selSize,
      selQty: 1,
      selColors: opts.selColors,
      selSizes: opts.selSizes,
      selSkuStock: partial ? goods.stock : this.getSkuStock(goods, selColor, selSize)
    });
  },

  pickColor(e) {
    this._refreshSelOptions('selColor', e.currentTarget.dataset.v);
  },
  pickSize(e) {
    this._refreshSelOptions('selSize', e.currentTarget.dataset.v);
  },

  /** 选择变化：选项标记 + 库存数合并为一次 setData，减少渲染次数 */
  _refreshSelOptions(key, value) {
    const { selGoods } = this.data;
    if (!selGoods) return;
    const selColor = key === 'selColor' ? value : this.data.selColor;
    const selSize = key === 'selSize' ? value : this.data.selSize;
    const recent = this._loadRecentSpecs(selGoods.id);
    const opts = this._buildSelOptions(selGoods, selColor, selSize, recent);
    const partial = (opts.selColors.length && !selColor) || (opts.selSizes.length && !selSize);
    this.setData({
      ...(key ? { [key]: value } : {}),
      ...opts,
      selSkuStock: partial ? selGoods.stock : this.getSkuStock(selGoods, selColor, selSize)
    });
  },

  selQtyMinus() {
    if (this.data.selQty <= 1) return;
    this.setData({ selQty: this.data.selQty - 1 });
  },
  selQtyPlus() {
    const { selQty, selSkuStock } = this.data;
    if (selQty >= selSkuStock) {
      toast('已达该规格库存上限', 'none');
      return;
    }
    this.setData({ selQty: selQty + 1 });
  },

  /** 长按 + 快速加 5（库存不足时按剩余库存截断） */
  selQtyLongPress() {
    const { selQty, selSkuStock } = this.data;
    if (selSkuStock <= 0) {
      toast('该规格库存不足', 'none');
      return;
    }
    const next = Math.min(selQty + 5, selSkuStock);
    if (next === selQty) {
      toast('已达该规格库存上限', 'none');
      return;
    }
    this.setData({ selQty: next });
    toast(`已加至 ${next} 件`, 'none');
  },

  confirmAdd() {
    if (this.data.addingItem) return;
    const { selGoods, selColor, selSize, selQty, cart } = this.data;
    if (this.data.selColors.length && !selColor) {
      toast('请选择颜色', 'none');
      return;
    }
    if (this.data.selSizes.length && !selSize) {
      toast('请选择尺码', 'none');
      return;
    }
    const skuStock = this.getSkuStock(selGoods, selColor, selSize);
    if (skuStock <= 0) {
      toast('该规格库存不足', 'none');
      return;
    }
    this.setData({ addingItem: true });
    const exist = cart.find((c) => c.goodsId === selGoods.id && c.color === selColor && c.size === selSize);
    if (exist) {
      const newQty = exist.quantity + selQty;
      if (newQty > skuStock) {
        toast(`该规格合计数量超出库存（${skuStock}）`, 'none');
        this.setData({ addingItem: false });
        return;
      }
      exist.quantity = newQty;
      exist.subtotal = fmtMoney(exist.price * newQty);
    } else {
      cart.push({
        goodsId: selGoods.id,
        goodsNo: selGoods.goods_no || '',
        name: selGoods.name,
        cover: selGoods.cover,
        color: selColor,
        size: selSize,
        price: selGoods.price,
        quantity: selQty,
        stock: skuStock,
        subtotal: fmtMoney(selGoods.price * selQty)
      });
    }
    this._saveRecentSpec(selGoods.id, selColor, selSize);
    this.setData({ selectVisible: false, cart, addingItem: false });
    this.calcTotal();
    this.persistCart();
  },

  closeSelect() {
    this.setData({ selectVisible: false });
  },

  cartMinus(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const cart = this.data.cart;
    if (!cart[idx] || cart[idx].quantity <= 1) return;
    const quantity = cart[idx].quantity - 1;
    const subtotal = fmtMoney(cart[idx].price * quantity);
    // 数量/小计用路径更新，避免整个 cart 数组参与差量计算
    this.setData({
      [`cart[${idx}].quantity`]: quantity,
      [`cart[${idx}].subtotal`]: subtotal
    });
    this.calcTotal();
    this.persistCart();
  },
  cartPlus(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const cart = this.data.cart;
    if (!cart[idx]) return;
    if (cart[idx].quantity >= cart[idx].stock) {
      toast('已达商品库存上限', 'none');
      return;
    }
    const quantity = cart[idx].quantity + 1;
    const subtotal = fmtMoney(cart[idx].price * quantity);
    this.setData({
      [`cart[${idx}].quantity`]: quantity,
      [`cart[${idx}].subtotal`]: subtotal
    });
    this.calcTotal();
    this.persistCart();
  },
  cartRemove(e) {
    const cart = this.data.cart.slice();
    cart.splice(e.currentTarget.dataset.index, 1);
    this.setData({ cart });
    this.calcTotal();
    this.persistCart();
  },

  calcTotal() {
    const { cart } = this.data;
    let total = 0;
    let qty = 0;
    cart.forEach((c) => {
      total += c.price * c.quantity;
      qty += c.quantity;
    });
    this.setData({ totalAmount: fmtMoney(total), totalQuantity: qty });
  },

  onPhoneInput(e) {
    const phone = String(e.detail.value || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    this.setData({
      customerPhone: phone,
      showAddCustomerBtn: false,
      customerMatches: [],
      selectedCustomerId: 0
    });
    if (phone.length === 11) {
      this.checkCustomerExists(phone);
    } else if (phone.length === 4) {
      this.matchCustomerByLast4(phone);
    }
  },
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async checkCustomerExists(phone) {
    try {
      const data = await request({ url: `/api/customer/exists?phone=${phone}`, method: 'GET' });
      this.setData({ showAddCustomerBtn: !data.exists });
    } catch (e) {}
  },

  async matchCustomerByLast4(suffix) {
    try {
      const data = await request({ url: '/api/customer/match', method: 'POST', data: { suffix } });
      this.setData({ customerMatches: data.list || [] });
    } catch (e) {
      this.setData({ customerMatches: [] });
    }
  },

  onAddCustomerTap() {
    this.setData({ addCustomerVisible: true, newCustomerSurname: '', newCustomerGender: 0 });
  },
  closeAddCustomer() {
    this.setData({ addCustomerVisible: false });
  },
  onNewCustomerSurnameInput(e) {
    this.setData({ newCustomerSurname: e.detail.value });
  },
  onNewCustomerGenderTap(e) {
    this.setData({ newCustomerGender: Number(e.currentTarget.dataset.gender) });
  },

  async confirmAddCustomer() {
    const { customerPhone, newCustomerSurname, newCustomerGender } = this.data;
    if (!newCustomerSurname.trim()) {
      toast('请输入姓氏', 'none');
      return;
    }
    if (newCustomerGender !== 1 && newCustomerGender !== 2) {
      toast('请选择性别', 'none');
      return;
    }
    try {
      const r = await request({
        url: '/api/customer',
        method: 'POST',
        data: { phone: customerPhone, surname: newCustomerSurname.trim(), gender: newCustomerGender }
      });
      toast(r.message || '已添加会员', 'success');
      this.setData({
        addCustomerVisible: false,
        showAddCustomerBtn: false,
        selectedCustomerId: (r && r.id) || 0
      });
    } catch (e) {}
  },

  onSelectCustomer(e) {
    const { id, phone, name } = e.currentTarget.dataset;
    this.setData({
      customerPhone: phone,
      selectedCustomerId: parseInt(id, 10) || 0,
      customerMatches: [],
      showAddCustomerBtn: false
    });
    toast(`已选择 ${name}`, 'none');
  },

  async submitOrder() {
    const { cart, customerPhone, remark, submitting, restricted, selectedCustomerId } = this.data;
    if (submitting) return;
    if (restricted) {
      toast(
        this.data.restrictedExpired ? '开单授权已到期，请联系平台管理员续期' : '开单功能未开通，请联系平台管理员',
        'none'
      );
      return;
    }
    if (cart.length === 0) {
      toast('请先选择商品', 'none');
      return;
    }
    if (!(await this._checkPrinterBeforeBill())) return;
    this.setData({ submitting: true });
    try {
      const data = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          items: cart.map((c) => ({ goodsId: c.goodsId, color: c.color, size: c.size, quantity: c.quantity })),
          customerPhone: customerPhone.trim(),
          customerId: selectedCustomerId || 0,
          remark: remark.trim(),
          paidNow: false
        }
      });
      this._lastReceipt = {
        orderNo: data.orderNo,
        totalAmount: data.totalAmount,
        paidNow: false,
        customerPhone: customerPhone.trim(),
        remark: remark.trim(),
        items: cart.map((c) => ({
          goodsNo: c.goodsNo,
          name: c.name,
          color: c.color,
          size: c.size,
          price: c.price,
          quantity: c.quantity
        }))
      };
      // 记住本次成交项，供首页「快速开单」预置（清空购物车前记录）
      this._rememberFrequentGoods(cart);
      this.setData({
        cart: [],
        customerPhone: '',
        remark: '',
        successInfo: {
          orderId: data.id,
          orderNo: data.orderNo,
          totalAmount: fmtMoney(data.totalAmount),
          paid: false
        }
      });
      this.calcTotal();
      this.persistCart();
      this.loadGoods(true);
      this._printReceipt(this._lastReceipt).catch((e) => console.error('[print]', e));
    } catch (e) {
      if (e && e.code === 1002) {
        this.setData({
          restricted: true,
          restrictedExpired: !!this.data.billingExpireText || this.data.restrictedExpired
        });
        this._syncTabBar();
        this.checkBilling();
      }
      this.loadGoods(true);
    } finally {
      this.setData({ submitting: false });
    }
  },

  closeSuccess() {
    this.setData({ successInfo: null });
  },
  goOrderFromSuccess() {
    const info = this.data.successInfo;
    this.setData({ successInfo: null });
    if (info && info.orderId) {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${info.orderId}` });
    }
  },
  reprintFromSuccess() {
    if (this._lastReceipt) {
      this._printReceipt(this._lastReceipt).catch((e) => console.error('[print]', e));
    }
  }
});
