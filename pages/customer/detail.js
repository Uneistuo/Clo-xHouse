// 会员详情页：CRM 统计 + 编辑/删除 + 消费记录（按会员关联的订单）
const { request } = require('../../utils/api');
const { STATUS_TEXT } = require('../../utils/util');

const PAGE_SIZE = 20;

Page({
  /** 空处理：配合 wxml 中的 catchtap，阻止弹窗内点击事件冒泡到遮罩（否则点输入框会关闭弹窗） */
  noop() {},

  data: {
    id: 0,
    customer: null,   // 会员信息（含 CRM 统计）
    loaded: false,

    // 消费记录
    orders: [],
    orderTotal: 0,
    orderPage: 1,
    orderHasMore: false,
    orderLoading: false,
    orderLoaded: false,

    // 编辑弹窗
    editVisible: false,
    editSurname: '',
    editGender: 0,
    saving: false
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id, 10) || 0 });
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.loadDetail();
    this.loadOrders(true);
  },

  /** 加载会员详情（含 CRM 统计） */
  async loadDetail() {
    try {
      const data = await request({ url: `/api/customer/${this.data.id}` });
      this.setData({ customer: data, loaded: true });
      wx.setNavigationBarTitle({ title: data.displayName || '会员详情' });
    } catch (e) {
      // 错误提示已由 request 统一处理
    }
  },

  /** 加载消费记录 */
  async loadOrders(reset = false) {
    if (!reset && (this.data.orderLoading || !this.data.orderHasMore)) return;
    const page = reset ? 1 : this.data.orderPage + 1;
    const seq = (this._seq = (this._seq || 0) + 1);
    this.setData({ orderLoading: true });
    try {
      const data = await request({
        url: `/api/customer/${this.data.id}/orders`,
        data: { page, pageSize: PAGE_SIZE }
      });
      if (seq !== this._seq) return;
      const merged = reset ? data.list : this.data.orders.concat(data.list);
      this.setData({
        orders: merged,
        orderTotal: data.total || 0,
        orderPage: page,
        orderHasMore: data.list.length >= PAGE_SIZE,
        orderLoaded: true
      });
    } catch (e) {
      this.setData({ orderLoaded: true });
    } finally {
      this.setData({ orderLoading: false });
    }
  },

  onReachBottom() {
    if (this.data.orderHasMore) this.loadOrders(false);
  },

  /** 订单状态文案 */
  statusText(status) {
    return STATUS_TEXT[status] || status;
  },

  /** 跳转订单详情 */
  goOrder(e) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  // ============ 编辑会员 ============
  openEdit() {
    const { surname, gender } = this.data.customer;
    this.setData({ editVisible: true, editSurname: surname, editGender: gender });
  },
  closeEdit() {
    this.setData({ editVisible: false });
  },
  onEditSurnameInput(e) {
    this.setData({ editSurname: e.detail.value });
  },
  onEditGenderTap(e) {
    this.setData({ editGender: Number(e.currentTarget.dataset.gender) });
  },
  async confirmEdit() {
    const { id, editSurname, editGender, saving } = this.data;
    if (saving) return;
    if (!editSurname.trim()) {
      wx.showToast({ title: '请输入姓氏', icon: 'none' });
      return;
    }
    if (editGender !== 1 && editGender !== 2) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await request({
        url: `/api/customer/${id}`,
        method: 'PUT',
        data: { surname: editSurname.trim(), gender: editGender }
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editVisible: false });
      this.loadDetail(); // 刷新显示名与统计
    } catch (e) {
      // 错误提示已由 request 统一处理
    } finally {
      this.setData({ saving: false });
    }
  },

  // ============ 删除会员 ============
  onDelete() {
    const { id, displayName } = this.data.customer;
    wx.showModal({
      title: '删除会员',
      content: `确定删除会员【${displayName}】？该操作不可恢复，历史订单中的姓名快照将保留。`,
      confirmColor: '#e1483c',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await request({ url: `/api/customer/${id}`, method: 'DELETE' });
          wx.showToast({ title: '会员已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch (e) {
          // 错误提示已由 request 统一处理
        }
      }
    });
  }
});
