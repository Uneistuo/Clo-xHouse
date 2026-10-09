// 订单详情页：查看订单明细 + 订单状态操作（标记已收款/已完成、取消、退款）
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, STATUS_CLASS, PAY_METHOD_TEXT } = require('../../utils/util');

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
  }
});
