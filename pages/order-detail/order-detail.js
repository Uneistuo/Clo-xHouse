// 订单详情页：查看订单明细 + 状态操作（标记已收款/已完成、取消、售后、补打小票）
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, PAY_METHOD_TEXT } = require('../../utils/util');
const { printer } = require('../../utils/printer');
const { buildReceiptWithSettings, recordPrint } = require('../../utils/print-service');
const { confirm, alert, toast, loading: showLoading, hideLoading } = require('../../utils/dialog');

Page({
  data: {
    id: null,
    order: null,
    items: [],
    amountText: '0.00',
    statusText: '',
    payText: '',
    timeline: [], // 订单动态时间线 [{ key, label, time, done }]
    statusPulse: false, // 状态变化后短暂脉冲高亮
    loading: true,
    actionLoading: false // 订单状态操作进行中（禁用按钮 + 加载态）
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    this.setData({ id: options.id });
  },

  onShow() {
    if (this.data.id) this.loadOrder();
  },

  /** 下拉刷新：重新拉取订单详情 */
  onPullDownRefresh() {
    this.loadOrder().finally(() => wx.stopPullDownRefresh());
  },

  /** 加载订单详情（含商品明细快照） */
  async loadOrder() {
    this.setData({ loading: true });
    try {
      const o = await request({ url: `/api/orders/${this.data.id}` });
      // 状态变化时给状态标签一个短暂脉冲（首次进入不触发）
      const statusChanged = !!this._lastStatus && this._lastStatus !== o.status;
      this._lastStatus = o.status;
      this.setData({
        order: o,
        items: (o.items || []).map((it) => ({ ...it, amountText: fmtMoney(it.price * it.quantity) })),
        amountText: fmtMoney(o.total_amount),
        statusText: STATUS_TEXT[o.status] || o.status,
        payText: PAY_METHOD_TEXT[o.pay_method] || o.pay_method,
        timeline: this._buildTimeline(o),
        statusPulse: statusChanged,
        loading: false
      });
      if (statusChanged) {
        clearTimeout(this._pulseTimer);
        this._pulseTimer = setTimeout(() => this.setData({ statusPulse: false }), 700);
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /** 组装订单动态时间线：创建 → 收款 → 完成（取消/售后作为终止节点追加） */
  _buildTimeline(o) {
    const paidDone = !!o.paid_at || ['paid', 'done', 'refunded'].includes(o.status);
    const doneDone = !!o.done_at || o.status === 'done';
    const timeOrDash = (t) => t || '—';
    const timeline = [
      { key: 'created', label: '订单创建', time: timeOrDash(o.created_at), done: !!o.created_at },
      { key: 'paid', label: '已收款', time: paidDone ? timeOrDash(o.paid_at || o.updated_at) : '—', done: paidDone },
      { key: 'done', label: '交易完成', time: doneDone ? timeOrDash(o.done_at || o.updated_at) : '—', done: doneDone }
    ];
    if (o.status === 'cancelled') {
      timeline.push({
        key: 'cancelled',
        label: '订单已取消',
        time: timeOrDash(o.cancelled_at || o.updated_at),
        done: true
      });
    }
    if (o.status === 'refunded') {
      timeline.push({
        key: 'refunded',
        label: '售后完成',
        time: timeOrDash(o.refunded_at || o.updated_at),
        done: true
      });
    }
    return timeline;
  },

  /** 修改订单状态（正向流转：待收款→已收款→已完成） */
  async changeStatus(e) {
    if (this.data.actionLoading) return;
    const status = e.currentTarget.dataset.status;
    const text = STATUS_TEXT[status];
    const ok = await confirm({
      title: '操作确认',
      content: `确定将订单标记为【${text}】吗？`
    });
    if (!ok) return;

    this.setData({ actionLoading: true });
    try {
      await request({
        url: `/api/orders/${this.data.id}/status`,
        method: 'PUT',
        data: { status }
      });
      toast('操作成功', 'success');
      await this.loadOrder();
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ actionLoading: false });
    }
  },

  /** 取消订单（后端事务：状态置为已取消 + 自动归还商品库存） */
  async cancelOrder() {
    if (this.data.actionLoading) return;
    const ok = await confirm({
      title: '取消订单',
      content: '取消后订单不可恢复，商品库存将自动归还。确定取消吗？',
      confirmText: '确定取消'
    });
    if (!ok) return;

    this.setData({ actionLoading: true });
    try {
      await request({ url: `/api/orders/${this.data.id}/cancel`, method: 'POST' });
      toast('已取消', 'success');
      await this.loadOrder();
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ actionLoading: false });
    }
  },

  /** 售后处理（后端事务：状态置为已售后 + 自动归还商品库存） */
  async refundOrder() {
    if (this.data.actionLoading) return;
    const ok = await confirm({
      title: '售后确认',
      content: '确认已完成售后（退款/换货）吗？商品库存将自动归还。',
      confirmText: '确认售后'
    });
    if (!ok) return;

    this.setData({ actionLoading: true });
    try {
      await request({ url: `/api/orders/${this.data.id}/refund`, method: 'POST' });
      toast('售后完成', 'success');
      await this.loadOrder();
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ actionLoading: false });
    }
  },

  /** 补打小票：从当前订单 + 商品明细重新生成 ESC/POS 并发送 */
  async reprintReceipt() {
    const { order, items } = this.data;
    if (!order) return;

    const saved = printer.loadSavedDevice();
    if (!saved) {
      const go = await confirm({
        title: '未配对打印机',
        content: '请先在【店铺页 → 打印设置】中配对蓝牙打印机后再补打。',
        confirmText: '去配对',
        cancelText: '暂不'
      });
      if (go) wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
      return;
    }

    showLoading('打印中...');
    try {
      // 加载店铺信息（用于小票顶部店名）
      const admin = wx.getStorageSync('adminInfo') || {};
      let storeName = admin.storeName || '';
      try {
        const info = await request({ url: '/api/store/info' });
        if (info && info.store) storeName = info.store.name || storeName;
      } catch (e) {
        /* 用已有信息继续 */
      }

      // 若未连接则静默尝试连接
      if (!printer.connected) {
        const ok = await printer.quickConnect(saved.deviceId);
        if (!ok) throw new Error('连接打印机失败');
      }

      const bytes = buildReceiptWithSettings({
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
      recordPrint({ orderNo: order.order_no, ok: true });
      hideLoading();
      toast('小票已补打', 'success');
    } catch (e) {
      recordPrint({ orderNo: order.order_no, ok: false });
      hideLoading();
      alert({ title: '补打失败', content: e.message || '请检查打印机连接' });
    }
  }
});
