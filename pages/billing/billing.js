// 开单页：商家现场出单（优化版：dialog.confirm 替代 wx.showModal + 按钮加载态）
// 流程：搜索/选择上架商品 -> 选颜色尺码、数量（自动算小计）-> 多件商品合并订单
//      -> 填客户手机号/备注/收款方式 -> 提交（后端事务：生成订单 + 自动扣减库存）
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');
const { printer } = require('../../utils/printer');
const { buildReceipt } = require('../../utils/receipt');
const { confirm, toast, loading: showLoading, hideLoading } = require('../../utils/dialog');

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
    restricted: false,
    restrictedExpired: false,
    billingExpireText: '',
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
    this.checkBilling();
    this.loadGoods(true);
    this._ensurePrinterConnected();
  },

  /** 同步 TabBar：开单页隐藏悬浮圆钮；仅结算栏可见时才与 TabBar 拼接 */
  _syncTabBar() {
    if (typeof this.getTabBar !== 'function') return;
    const tabBar = this.getTabBar();
    if (!tabBar) return;
    tabBar.setData({
      selected: 2,
      billingDock: !this.data.restricted
    });
  },

  onUnload() {
    clearTimeout(this._searchTimer);
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
      if (Array.isArray(cart) && cart.length) {
        this.setData({ cart });
        this.calcTotal();
      }
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

    const receiptBytes = buildReceipt({
      store: { name: storeName },
      admin: { username: salesName },
      order: { orderNo, totalAmount, customerPhone, remark },
      items
    });

    if (!printer.connected) {
      const saved = printer.loadSavedDevice();
      if (!saved) {
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
    if (!retry) return;
    try {
      const saved = printer.loadSavedDevice();
      if (saved && !printer.connected) {
        await printer.quickConnect(saved.deviceId);
      }
      await printer.writeBytes(receiptBytes);
      toast('小票已打印', 'success');
    } catch (e2) {
      toast('打印失败，已跳过', 'none');
    }
  },

  async checkBilling() {
    try {
      const data = await request({ url: '/api/store/info' });
      const expireAt = data.billingExpireAt || '';
      this.setData({
        restricted: !data.billingEnabled,
        restrictedExpired: !data.billingEnabled && !!expireAt,
        billingExpireText: data.billingEnabled ? expireAt : ''
      });
      this._syncTabBar();
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
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/goods',
        data: { keyword: this.data.keyword.trim(), status: 'on', page, pageSize: 20 }
      });
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
      this.setData({
        goodsList: merged,
        page,
        hasMore: merged.length < (data.total || 0),
        loading: false
      });
    } catch (e) {
      if (seq === this._goodsSeq) this.setData({ loading: false });
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

  openSelect(e) {
    const goods = this.data.goodsList.find((g) => g.id === e.currentTarget.dataset.id);
    if (!goods) return;
    if (goods.stock <= 0) {
      toast('该商品库存不足', 'none');
      return;
    }
    this.setData({
      selectVisible: true,
      selGoods: goods,
      selColors: goods.colorArr.length ? goods.colorArr : [],
      selSizes: goods.sizeArr.length ? goods.sizeArr : [],
      selColor: '',
      selSize: '',
      selQty: 1,
      selSkuStock: goods.stock
    });
  },

  pickColor(e) {
    this.setData({ selColor: e.currentTarget.dataset.v });
    this.syncSelSkuStock();
  },
  pickSize(e) {
    this.setData({ selSize: e.currentTarget.dataset.v });
    this.syncSelSkuStock();
  },

  syncSelSkuStock() {
    const { selGoods, selColors, selSizes, selColor, selSize } = this.data;
    if (!selGoods) return;
    let stock;
    if ((selColors.length && !selColor) || (selSizes.length && !selSize)) {
      stock = selGoods.stock;
    } else {
      stock = this.getSkuStock(selGoods, selColor, selSize);
    }
    this.setData({ selSkuStock: stock });
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
    this.setData({ selectVisible: false, cart, addingItem: false });
    this.calcTotal();
    this.persistCart();
  },

  closeSelect() {
    this.setData({ selectVisible: false });
  },

  cartMinus(e) {
    const idx = e.currentTarget.dataset.index;
    const cart = this.data.cart;
    if (cart[idx].quantity <= 1) return;
    cart[idx].quantity -= 1;
    cart[idx].subtotal = fmtMoney(cart[idx].price * cart[idx].quantity);
    this.setData({ cart });
    this.calcTotal();
    this.persistCart();
  },
  cartPlus(e) {
    const idx = e.currentTarget.dataset.index;
    const cart = this.data.cart;
    if (cart[idx].quantity >= cart[idx].stock) {
      toast('已达商品库存上限', 'none');
      return;
    }
    cart[idx].quantity += 1;
    cart[idx].subtotal = fmtMoney(cart[idx].price * cart[idx].quantity);
    this.setData({ cart });
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
