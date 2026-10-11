// 订单详情页：查看订单明细 + 订单状态操作（标记已收款/已完成、取消、退款、补打小票）
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, STATUS_CLASS, PAY_METHOD_TEXT } = require('../../utils/util');
const { printer } = require('../../utils/printer');
const { buildReceipt } = require('../../utils/receipt');

Page({
  data: {
    id: null,
    order: null,
    items: [],
    amountText: '0.00',
    statusText: '',
    statusClass: '',
    payText: '',
    loading: true
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    this.setData({ id: options.id });
  },

  onShow() {
    if (this.data.id) this.loadOrder();
  },

  /** 加载订单详情（含商品明细快照） */
  async loadOrder() {
    this.setData({ loading: true });
    try {
      const o = await request({ url: `/api/orders/${this.data.id}` });
      this.setData({
        order: o,
        items: (o.items || []).map((it) => ({ ...it, amountText: fmtMoney(it.price * it.quantity) })),
        amountText: fmtMoney(o.total_amount),
        statusText: STATUS_TEXT[o.status] || o.status,
        statusClass: STATUS_CLASS[o.status] || 'tag-gray',
        payText: PAY_METHOD_TEXT[o.pay_method] || o.pay_method,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /**
   * 修改订单状态（正向流转：待收款→已收款→已完成）
   */
  changeStatus(e) {
    const status = e.currentTarget.dataset.status; // 目标状态
    const text = STATUS_TEXT[status];
    wx.showModal({
      title: '操作确认',
      content: `确定将订单标记为【${text}】吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        await request({
          url: `/api/orders/${this.data.id}/status`,
          method: 'PUT',
          data: { status }
        });
        wx.showToast({ title: '操作成功', icon: 'success' });
        this.loadOrder();
      }
    });
  },

  /**
   * 取消订单（后端事务：状态置为已取消 + 自动归还商品库存）
   */
  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '取消后订单不可恢复，商品库存将自动归还。确定取消吗？',
      confirmColor: '#e54d42',
      success: async (res) => {
        if (!res.confirm) return;
        await request({ url: `/api/orders/${this.data.id}/cancel`, method: 'POST' });
        wx.showToast({ title: '已取消', icon: 'success' });
        this.loadOrder();
      }
    });
  },

  /**
   * 售后处理（后端事务：状态置为已售后 + 自动归还商品库存）
   */
  refundOrder() {
    wx.showModal({
      title: '售后确认',
      content: '确认已完成售后（退款/换货）吗？商品库存将自动归还。',
      confirmColor: '#e54d42',
      success: async (res) => {
        if (!res.confirm) return;
        await request({ url: `/api/orders/${this.data.id}/refund`, method: 'POST' });
        wx.showToast({ title: '售后完成', icon: 'success' });
        this.loadOrder();
      }
    });
  },

  /**
   * 补打小票：从当前订单 + 商品明细重新生成 ESC/POS 并发送
   */
  async reprintReceipt() {
    const { order, items } = this.data;
    if (!order) return;

    const saved = printer.loadSavedDevice();
    if (!saved) {
      wx.showModal({
        title: '未配对打印机',
        content: '请先在【店铺页 → 打印设置】中配对蓝牙打印机后再补打。',
        confirmText: '去配对',
        success: (r) => {
          if (r.confirm) wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
        }
      });
      return;
    }

    wx.showLoading({ title: '打印中...', mask: true });
    try {
      // 加载店铺信息（用于小票顶部店名）
      const admin = wx.getStorageSync('adminInfo') || {};
      let storeName = admin.storeName || '';
      try {
        const info = await request({ url: '/api/store/info' });
        if (info && info.store) {
          storeName = info.store.name || storeName;
        }
      } catch (e) { /* 用已有信息继续 */ }

      // 若未连接则静默尝试连接
      if (!printer.connected) {
        const ok = await printer.quickConnect(saved.deviceId);
        if (!ok) throw new Error('连接打印机失败');
      }

      const bytes = buildReceipt({
        store: { name: storeName },
        admin: { username: admin.username || '' },
        order: {
          orderNo: order.order_no,
          created_at: order.created_at,
          totalAmount: order.total_amount,
          customerPhone: order.customer_phone,
          remark: order.remark,
          payMethod: order.pay_method
        },
        items: items.map((it) => ({
          goodsNo: it.goods_no || '',
          name: it.goods_name,
          color: it.color,
          size: it.size,
          price: it.price,
          quantity: it.quantity
        }))
      });

      await printer.writeBytes(bytes);
      wx.hideLoading();
      wx.showToast({ title: '小票已补打', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showModal({
        title: '补打失败',
        content: e.message || '请检查打印机连接',
        showCancel: false
      });
    }
  }
});
