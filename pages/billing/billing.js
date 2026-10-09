// 开单页：商家现场出单
// 流程：搜索/选择上架商品 -> 选颜色尺码、数量（自动算小计）-> 多件商品合并订单
//      -> 填客户手机号/备注/收款方式 -> 提交（后端事务：生成订单 + 自动扣减库存）
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');

Page({
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
    billingExpireText: ''    // 授权到期时间（有效时页面顶部展示）
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.checkBilling();
    this.loadGoods();
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
  },
  cartRemove(e) {
    const cart = this.data.cart.slice();
    cart.splice(e.currentTarget.dataset.index, 1);
    this.setData({ cart });
    this.calcTotal();
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
  onPhoneInput(e) { this.setData({ customerPhone: e.detail.value }); },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },
  onPaidNowChange(e) { this.setData({ paidNow: e.detail.value }); },

  /** 底部"收款并出单"按钮：校验后提交（后端事务生成订单并扣减库存） */
  async submitOrder() {
    const { cart, customerPhone, remark, paidNow, submitting, restricted } = this.data;
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
          remark: remark.trim(),
          paidNow
        }
      });
      this.setData({ cart: [], customerPhone: '', remark: '', paidNow: false });
      this.calcTotal();
      wx.showModal({
        title: '开单成功',
        content: `订单号 ${data.orderNo}\n应收金额 ￥${fmtMoney(data.totalAmount)}${paidNow ? '（已标记收款）' : '（待收款）'}`,
        showCancel: false,
        success: () => {
          // 开单后刷新商品列表（库存已变化）
          this.loadGoods();
        }
      });
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
  }
});
