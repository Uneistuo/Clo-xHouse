// 开单页：商家现场出单
// 流程：搜索/选择上架商品 -> 选颜色尺码、数量（自动算小计）-> 多件商品合并订单
//      -> 填客户手机号/备注/收款方式 -> 提交（后端事务：生成订单 + 自动扣减库存）
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');
const { printer } = require('../../utils/printer');
const { buildReceipt } = require('../../utils/receipt');

Page({
  /** 空处理：配合 wxml 中的 catchtap，阻止弹窗内点击事件冒泡到遮罩（否则点输入框会关闭弹窗） */
  noop() {},

  data: {
    keyword: '',
    goodsList: [],       // 上架商品列表（含库存）
    cart: [],            // 购物车（订单商品）
    totalAmount: '0.00', // 订单总金额
    totalQuantity: 0,

    // 商品规格选择弹层
    selectVisible: false,
    selGoods: null,      // 当前选择的商品
    selColor: '',        // 已选颜色
    selSize: '',         // 已选尺码
    selQty: 1,           // 购买数量
    selColors: [],       // 可选颜色数组
    selSizes: [],        // 可选尺码数组
    selSkuStock: 0,      // 当前所选规格（颜色+尺码）的库存

    // 提交信息（平铺在页面上）
    customerPhone: '',
    remark: '',
    paidNow: false,      // 顾客已现场付款 -> 直接标记为已收款
    submitting: false,
    restricted: false,       // 开单白名单：未授权/已到期不可开单（平台管理员控制时效）
    restrictedExpired: false, // true=授权已到期 / false=从未授权
    billingExpireText: '',   // 授权到期时间（有效时页面顶部展示）
    successInfo: null,       // 开单成功弹层数据 { orderId, orderNo, totalAmount, paid }

    // 客户/会员管理（开单时添加 / 识别老客户）
    showAddCustomerBtn: false,    // 输入 11 位手机号且未注册会员时，输入框末端显示"+ 添加会员"按钮
    customerMatches: [],          // 输入 4 位后匹配到的会员预选列表 { id, phone, surname, gender, displayName }
    selectedCustomerId: 0,        // 已选中/已添加的会员 ID（下单时随订单落库；手动改手机号即清零）

    // 添加会员弹窗
    addCustomerVisible: false,
    newCustomerSurname: '',      // 新会员姓氏输入
    newCustomerGender: 0          // 新会员性别 0=未选 1=先生 2=女士
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.restoreCart();
    this.checkBilling();
    this.loadGoods();
    // 进入页面静默尝试连接已配对打印机
    this._ensurePrinterConnected();
  },

  /** 下拉刷新：重新拉取在售商品与授权状态 */
  onPullDownRefresh() {
    this.checkBilling();
    this.loadGoods().finally(() => wx.stopPullDownRefresh());
  },

  /** 从本地缓存恢复购物车（防止误退出/跳转丢失已选商品） */
  restoreCart() {
    try {
      const cart = wx.getStorageSync('billing_cart');
      if (Array.isArray(cart) && cart.length) {
        this.setData({ cart });
        this.calcTotal();
      }
    } catch (e) { /* 忽略缓存读取异常 */ }
  },

  /** 持久化购物车到本地缓存（成功开单后写入空数组即清空） */
  persistCart() {
    try { wx.setStorageSync('billing_cart', this.data.cart); } catch (e) { /* 忽略缓存写入异常 */ }
  },

  /**
   * 静默连接已配对打印机（不阻塞页面；失败不打扰用户，开单时再提示）
   */
  _ensurePrinterConnected() {
    const saved = printer.loadSavedDevice();
    if (!saved || printer.connected) return;
    printer.quickConnect(saved.deviceId).catch(() => {});
  },

  /**
   * 检查打印机配对状态：未配对则弹 modal 并跳转配对页
   * @returns {boolean} true=可以继续开单
   */
  _checkPrinterBeforeBill() {
    const saved = printer.loadSavedDevice();
    if (saved) return true;
    wx.showModal({
      title: '未连接打印机',
      content: '检测到您还未配对蓝牙打印机，开单后将无法自动打印小票。是否前往配对？',
      confirmText: '去配对',
      cancelText: '暂不开单',
      success: (res) => {
        if (res.confirm) {
          wx.redirectTo({ url: '/pages/printer-pair/printer-pair' });
        }
      }
    });
    return false;
  },

  /**
   * 打印小票：订单成功后调用；失败弹 modal 询问重试/跳过
   */
  async _printReceipt(orderData) {
    const { orderNo, totalAmount, customerPhone, remark, items } = orderData;
    // 加载店铺信息（用于小票顶部）
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
    } catch (e) { /* 继续用已有信息 */ }

    const receiptBytes = buildReceipt({
      store: { name: storeName },
      admin: { username: salesName },
      order: { orderNo, totalAmount, customerPhone, remark },
      items
    });

    // 如果未连接，先尝试静默连接
    if (!printer.connected) {
      const saved = printer.loadSavedDevice();
      if (!saved) {
        wx.showModal({
          title: '未配对打印机',
          content: '订单已生成，但无法打印小票。是否前往配对？',
          confirmText: '去配对',
          success: (r) => {
            if (r.confirm) wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
          }
        });
        return;
      }
      const ok = await printer.quickConnect(saved.deviceId);
      if (!ok) {
        this._showPrintFailModal(receiptBytes, orderNo);
        return;
      }
    }

    try {
      await printer.writeBytes(receiptBytes);
      wx.showToast({ title: '小票已打印', icon: 'success' });
    } catch (e) {
      console.error('[print]', e);
      this._showPrintFailModal(receiptBytes, orderNo);
    }
  },

  /** 打印失败 modal：让用户选择重试或跳过 */
  _showPrintFailModal(receiptBytes, orderNo) {
    const that = this;
    wx.showModal({
      title: '打印失败',
      content: `订单 ${orderNo} 已生成，但小票打印失败。是否重试？`,
      confirmText: '重试',
      cancelText: '跳过',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 重试前重新连接
            const saved = printer.loadSavedDevice();
            if (saved && !printer.connected) {
              await printer.quickConnect(saved.deviceId);
            }
            await printer.writeBytes(receiptBytes);
            wx.showToast({ title: '小票已打印', icon: 'success' });
          } catch (e2) {
            wx.showToast({ title: '打印失败，已跳过', icon: 'none' });
          }
        }
      }
    });
  },

  /** 校验店铺开单授权时效（未授权/到期时整页展示受限提示；后端提交时同样实时校验） */
  async checkBilling() {
    try {
      const data = await request({ url: '/api/store/info' });
      const expireAt = data.billingExpireAt || '';
      this.setData({
        restricted: !data.billingEnabled,
        restrictedExpired: !data.billingEnabled && !!expireAt,
        billingExpireText: data.billingEnabled ? expireAt : ''
      });
    } catch (e) {
      // 接口异常时不拦截，提交时以后端校验结果为准
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    // 本地即时过滤已加载的上架商品列表
    this.filterGoods();
  },

  /** 拉取全部上架商品（开单只能选择上架且未删除的商品） */
  async loadGoods() {
    try {
      const data = await request({
        url: '/api/goods',
        data: { status: 'on', page: 1, pageSize: 200 }
      });
      this.rawGoods = (data.list || []).map((g) => ({
        ...g,
        colorArr: g.colors ? g.colors.split(',').filter(Boolean) : [],
        sizeArr: g.sizes ? g.sizes.split(',').filter(Boolean) : [],
        skus: g.skus || [],   // 规格库存（颜色+尺码 -> 库存）
        priceText: fmtMoney(g.price),
        cover: g.image ? resolveImg(g.image.split(',')[0], BASE_URL) : ''
      }));
      this.filterGoods();
    } catch (e) {
      // 空商品表时接口返回空列表，页面正常渲染
    }
  },

  /** 查询商品某规格（颜色+尺码）的库存；商品无规格行时回退用总库存 */
  getSkuStock(goods, color, size) {
    if (!goods.skus || goods.skus.length === 0) return goods.stock || 0;
    const sku = goods.skus.find((s) => (s.color || '') === (color || '') && (s.size || '') === (size || ''));
    return sku ? sku.stock : 0;
  },

  /** 根据关键字过滤商品（纯前端过滤，避免频繁请求） */
  filterGoods() {
    const kw = this.data.keyword.trim();
    const list = (this.rawGoods || []).filter((g) => !kw || g.name.indexOf(kw) >= 0);
    this.setData({ goodsList: list });
  },

  // ============ 选择商品：打开规格弹层 ============
  openSelect(e) {
    const goods = this.data.goodsList.find((g) => g.id === e.currentTarget.dataset.id);
    if (!goods) return;
    if (goods.stock <= 0) {
      wx.showToast({ title: '该商品库存不足', icon: 'none' });
      return;
    }
    this.setData({
      selectVisible: true,
      selGoods: goods,
      selColors: goods.colorArr.length ? goods.colorArr : [],
      selSizes: goods.sizeArr.length ? goods.sizeArr : [],
      // 无颜色/尺码属性时规格值为空串（与后端 SKU 空规格行对应）
      selColor: '',
      selSize: '',
      selQty: 1,
      selSkuStock: goods.stock // 规格未选时先展示总库存
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

  /** 根据当前已选颜色/尺码刷新该规格库存（未选完时显示商品总库存） */
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

  /** 弹层内数量步进（不超过所选规格库存） */
  selQtyMinus() {
    if (this.data.selQty <= 1) return;
    this.setData({ selQty: this.data.selQty - 1 });
  },
  selQtyPlus() {
    const { selQty, selSkuStock } = this.data;
    if (selQty >= selSkuStock) {
      wx.showToast({ title: '已达该规格库存上限', icon: 'none' });
      return;
    }
    this.setData({ selQty: selQty + 1 });
  },

  /** 确认加入订单（相同商品+颜色+尺码自动合并数量） */
  confirmAdd() {
    const { selGoods, selColor, selSize, selQty, cart } = this.data;
    if (this.data.selColors.length && !selColor) {
      wx.showToast({ title: '请选择颜色', icon: 'none' }); return;
    }
    if (this.data.selSizes.length && !selSize) {
      wx.showToast({ title: '请选择尺码', icon: 'none' }); return;
    }
    // 该规格（SKU）可用库存
    const skuStock = this.getSkuStock(selGoods, selColor, selSize);
    if (skuStock <= 0) {
      wx.showToast({ title: '该规格库存不足', icon: 'none' });
      return;
    }
    // 购物车内已有相同规格则合并
    const exist = cart.find((c) => c.goodsId === selGoods.id && c.color === selColor && c.size === selSize);
    if (exist) {
      const newQty = exist.quantity + selQty;
      if (newQty > skuStock) {
        wx.showToast({ title: `该规格合计数量超出库存（${skuStock}）`, icon: 'none' });
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
        stock: skuStock,   // 该规格库存（步进器上限）
        subtotal: fmtMoney(selGoods.price * selQty)
      });
    }
    this.setData({ selectVisible: false, cart });
    this.calcTotal();
    this.persistCart();
  },

  closeSelect() { this.setData({ selectVisible: false }); },

  // ============ 订单商品操作 ============
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
      wx.showToast({ title: '已达商品库存上限', icon: 'none' });
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

  /** 计算订单总金额 / 总件数 */
  calcTotal() {
    const { cart } = this.data;
    let total = 0;
    let qty = 0;
    cart.forEach((c) => { total += c.price * c.quantity; qty += c.quantity; });
    this.setData({ totalAmount: fmtMoney(total), totalQuantity: qty });
  },

  // ============ 提交订单 ============
  /** 顾客手机号输入：根据输入位数触发不同会员查询
   *  - 11 位：检查是否已是本店会员，决定"添加"按钮显隐
   *  - 4 位：按后 4 位查询匹配的会员，下方显示预选列表
   *  - 其他：清空所有会员相关状态
   *  - 输入变化：清空"添加"按钮与匹配列表，避免过期数据 */
  onPhoneInput(e) {
    const phone = String(e.detail.value || '').replace(/\D/g, '').slice(0, 11);
    this.setData({
      customerPhone: phone,
      showAddCustomerBtn: false,
      customerMatches: [],
      selectedCustomerId: 0  // 手动改手机号即取消会员关联
    });
    if (phone.length === 11) {
      this.checkCustomerExists(phone);
    } else if (phone.length === 4) {
      this.matchCustomerByLast4(phone);
    }
  },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },
  onPaidNowChange(e) { this.setData({ paidNow: e.detail.value }); },

  /** 查询完整手机号是否已是本店会员 */
  async checkCustomerExists(phone) {
    try {
      const data = await request({ url: `/api/customer/exists?phone=${phone}`, method: 'GET' });
      this.setData({ showAddCustomerBtn: !data.exists });
    } catch (e) {
      // 错误提示已由 request 统一处理
    }
  },

  /** 按手机号后 4 位查询匹配会员（用于预选） */
  async matchCustomerByLast4(suffix) {
    try {
      const data = await request({ url: '/api/customer/match', method: 'POST', data: { suffix } });
      this.setData({ customerMatches: data.list || [] });
    } catch (e) {
      this.setData({ customerMatches: [] });
    }
  },

  /** 打开添加会员弹窗（默认重置姓氏/性别） */
  onAddCustomerTap() {
    this.setData({ addCustomerVisible: true, newCustomerSurname: '', newCustomerGender: 0 });
  },

  /** 关闭添加会员弹窗 */
  closeAddCustomer() {
    this.setData({ addCustomerVisible: false });
  },

  /** 弹窗内：姓氏输入 */
  onNewCustomerSurnameInput(e) {
    this.setData({ newCustomerSurname: e.detail.value });
  },

  /** 弹窗内：性别选择 */
  onNewCustomerGenderTap(e) {
    this.setData({ newCustomerGender: Number(e.currentTarget.dataset.gender) });
  },

  /** 弹窗内：确认添加（提交后端，已存在则覆盖姓氏/性别） */
  async confirmAddCustomer() {
    const { customerPhone, newCustomerSurname, newCustomerGender } = this.data;
    if (!newCustomerSurname.trim()) {
      wx.showToast({ title: '请输入姓氏', icon: 'none' });
      return;
    }
    if (newCustomerGender !== 1 && newCustomerGender !== 2) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    try {
      const r = await request({
        url: '/api/customer',
        method: 'POST',
        data: {
          phone: customerPhone,
          surname: newCustomerSurname.trim(),
          gender: newCustomerGender
        }
      });
      wx.showToast({ title: r.message || '已添加会员', icon: 'success' });
      // 记住新会员 ID，本次下单自动关联该会员
      this.setData({
        addCustomerVisible: false,
        showAddCustomerBtn: false,
        selectedCustomerId: (r && r.id) || 0
      });
    } catch (e) {
      // 错误提示已由 request 统一处理（重名/格式错误等）
    }
  },

  /** 选择预选会员：回填完整手机号并记住会员 ID（下单时落库） */
  onSelectCustomer(e) {
    const { id, phone, name } = e.currentTarget.dataset;
    this.setData({
      customerPhone: phone,
      selectedCustomerId: parseInt(id, 10) || 0,
      customerMatches: [],
      showAddCustomerBtn: false
    });
    wx.showToast({ title: `已选择 ${name}`, icon: 'none' });
  },

  /** 底部"收款并出单"按钮：校验后提交（后端事务生成订单并扣减库存） */
  async submitOrder() {
    const { cart, customerPhone, remark, paidNow, submitting, restricted, selectedCustomerId } = this.data;
    if (submitting) return;
    if (restricted) {
      wx.showToast({
        title: this.data.restrictedExpired ? '开单授权已到期，请联系平台管理员续期' : '开单功能未开通，请联系平台管理员',
        icon: 'none'
      });
      return;
    }
    if (cart.length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    // 提交前检查打印机配对状态：未配对时提示并中止本次开单（修复"提示了仍下单"）
    if (!this._checkPrinterBeforeBill()) return;
    this.setData({ submitting: true });
    try {
      const data = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          items: cart.map((c) => ({
            goodsId: c.goodsId,
            color: c.color,
            size: c.size,
            quantity: c.quantity
          })),
          customerPhone: customerPhone.trim(),
          customerId: selectedCustomerId || 0,
          remark: remark.trim(),
          paidNow
        }
      });
      // 记录本次小票数据（供成功弹层"补打小票"使用）
      this._lastReceipt = {
        orderNo: data.orderNo,
        totalAmount: data.totalAmount,
        paidNow,
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
      // 清空购物车并弹出成功卡片（含订单号/金额/收款状态）
      this.setData({
        cart: [],
        customerPhone: '',
        remark: '',
        paidNow: false,
        successInfo: {
          orderId: data.id,
          orderNo: data.orderNo,
          totalAmount: fmtMoney(data.totalAmount),
          paid: paidNow
        }
      });
      this.calcTotal();
      this.persistCart();
      this.loadGoods();
      // 异步打印小票（不阻塞成功弹层）
      this._printReceipt(this._lastReceipt).catch((e) => console.error('[print]', e));
    } catch (e) {
      // 后端实时校验：授权被关闭/到期（1002）时同步切换为受限状态
      if (e && e.code === 1002) {
        this.setData({ restricted: true, restrictedExpired: !!this.data.billingExpireText || this.data.restrictedExpired });
        this.checkBilling();
      }
      // 失败提示由请求封装统一处理；刷新商品库存展示
      this.loadGoods();
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 开单成功弹层操作 ============
  /** 关闭成功弹层，继续开单 */
  closeSuccess() {
    this.setData({ successInfo: null });
  },

  /** 查看刚开出的订单详情 */
  goOrderFromSuccess() {
    const info = this.data.successInfo;
    this.setData({ successInfo: null });
    if (info && info.orderId) {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${info.orderId}` });
    }
  },

  /** 补打小票（复用本次开单的小票数据） */
  reprintFromSuccess() {
    if (this._lastReceipt) {
      this._printReceipt(this._lastReceipt).catch((e) => console.error('[print]', e));
    }
  }
});
