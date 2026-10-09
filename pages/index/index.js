// 首页：今日店况（销售额/今日订单/待收款/商品统计 + 今日单据）
// 所有数据来自后端统计接口（实时读数据库），无任何硬编码业务数据
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, STATUS_CLASS } = require('../../utils/util');

Page({
  data: {
    dateText: '',           // 顶部日期，如：10月7日星期三
    goodsTotal: 0,
    goodsOnSale: 0,
    goodsOffSale: 0,
    todayOrders: 0,
    todaySales: '0.00',
    pendingOrders: 0,       // 待收款订单数
    todayOrdersList: [],    // 今日单据（前5条）
    loading: true
  },

  onShow() {
    // 未登录拦截
    if (!getApp().checkLogin()) return;
    // 未绑定店铺拦截（引导到店铺创建/绑定页）
    const adminInfo = wx.getStorageSync('adminInfo') || {};
    if (!adminInfo.storeId) {
      wx.reLaunch({ url: '/pages/store/store' });
      return;
    }
    this.setData({ dateText: this.buildDateText() });
    this.loadDashboard();
    this.loadTodayOrders();
  },

  /** 生成顶部日期文案：如 "10月7日星期三" */
  buildDateText() {
    const d = new Date();
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}月${d.getDate()}日星期${weeks[d.getDay()]}`;
  },

  /** 拉取统计数据（数据库为空时后端返回 0，页面正常渲染） */
  async loadDashboard() {
    try {
      const data = await request({ url: '/api/stats/dashboard' });
      this.setData({
        goodsTotal: data.goodsTotal || 0,
        goodsOnSale: data.goodsOnSale || 0,
        goodsOffSale: data.goodsOffSale || 0,
        todayOrders: data.todayOrders || 0,
        todaySales: fmtMoney(data.todaySales || 0),
        pendingOrders: data.pendingOrders || 0,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /** 拉取今日单据（最近5条） */
  async loadTodayOrders() {
    try {
      const data = await request({
        url: '/api/orders',
        data: { range: 'today', page: 1, pageSize: 5 }
      });
      const list = (data.list || []).map((o) => ({
        ...o,
        amountText: fmtMoney(o.total_amount),
        timeText: (o.created_at || '').slice(11, 16), // 只显示时分
        statusText: STATUS_TEXT[o.status] || o.status,
        statusClass: STATUS_CLASS[o.status] || 'tag-gray'
      }));
      this.setData({ todayOrdersList: list });
    } catch (e) {
      // 空表/网络异常时保持空列表，页面正常渲染
    }
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    Promise.all([this.loadDashboard(), this.loadTodayOrders()])
      .finally(() => wx.stopPullDownRefresh());
  },

  // 快捷入口
  goBilling() { wx.switchTab({ url: '/pages/billing/billing' }); },
  goAddGoods() { wx.navigateTo({ url: '/pages/goods-edit/goods-edit' }); },
  goGoods() { wx.switchTab({ url: '/pages/goods/goods' }); },
  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },

  /** 点击今日单据 -> 订单详情 */
  goDetail(e) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  /** 退出登录 */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) getApp().logout();
      }
    });
  }
});
