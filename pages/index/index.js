// 首页：经营看板
// 结构：周期销售额（书签切换）→ 关键指标 → 近 7 天趋势（可点选）→ 低库存（可直达补货）
const { request } = require('../../utils/api');
const { fmtMoney } = require('../../utils/util');

Page({
  data: {
    dateText: '',           // 顶部日期，如：10月7日星期三

    // 周期切换（书签）
    ranges: [
      { key: 'today', text: '今日' },
      { key: 'week', text: '本周' },
      { key: 'month', text: '本月' }
    ],
    rangeKey: 'today',
    rangeLabel: '今日',

    // 统计
    goodsTotal: 0,
    goodsOnSale: 0,
    goodsOffSale: 0,
    pendingOrders: 0,       // 待收款订单数
    periodOrders: 0,        // 周期订单数
    periodSales: '0.00',    // 周期销售额
    trend: [],              // 近 7 天趋势 [{ date, amount, amountText, orders, barH }]
    trendIndex: 0,          // 趋势图当前选中项
    trendSelected: null,    // 当前选中项数据
    lowStock: []            // 低库存商品
  },

  onShow() {
    // 未登录拦截
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // 未绑定店铺拦截（引导到店铺创建/绑定页）
    const adminInfo = wx.getStorageSync('adminInfo') || {};
    if (!adminInfo.storeId) {
      wx.reLaunch({ url: '/pages/store/store' });
      return;
    }
    this.setData({ dateText: this.buildDateText() });
    this.loadDashboard();
  },

  /** 生成顶部日期文案：如 "10月7日星期三" */
  buildDateText() {
    const d = new Date();
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}月${d.getDate()}日星期${weeks[d.getDay()]}`;
  },

  /** 切换统计周期 */
  switchRange(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.rangeKey) return;
    const label = (this.data.ranges.find((r) => r.key === key) || {}).text || '今日';
    this.setData({ rangeKey: key, rangeLabel: label });
    this.loadDashboard();
  },

  /** 点选趋势图某一天，查看当日销售额 */
  pickTrend(e) {
    const i = Number(e.currentTarget.dataset.index);
    const t = this.data.trend[i];
    if (t) this.setData({ trendIndex: i, trendSelected: t });
  },

  /** 拉取统计数据（数据库为空时后端返回 0，页面正常渲染） */
  async loadDashboard() {
    try {
      const data = await request({
        url: '/api/stats/dashboard',
        data: { range: this.data.rangeKey }
      });
      // 趋势柱状：按最大值归一化（最小 4% 保证可见），默认选中最后一天（今天）
      const trend = data.trend || [];
      const max = Math.max(1, ...trend.map((t) => t.amount || 0));
      const trendView = trend.map((t) => ({
        date: t.date,
        amount: t.amount || 0,
        amountText: fmtMoney(t.amount || 0),
        orders: t.orders || 0,
        barH: Math.max(4, Math.round(((t.amount || 0) / max) * 100))
      }));
      const last = trendView.length - 1;
      this.setData({
        goodsTotal: data.goodsTotal || 0,
        goodsOnSale: data.goodsOnSale || 0,
        goodsOffSale: data.goodsOffSale || 0,
        pendingOrders: data.pendingOrders || 0,
        periodOrders: data.periodOrders || 0,
        periodSales: fmtMoney(data.periodSales || 0),
        trend: trendView,
        trendIndex: last,
        trendSelected: trendView[last] || null,
        lowStock: data.lowStock || []
      });
    } catch (e) {
      // 接口异常时保持既有数据，页面正常渲染
    }
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  },

  goGoods() { wx.switchTab({ url: '/pages/goods/goods' }); },
  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },

  /** 点击低库存商品 -> 去编辑补货 */
  goRestock(e) {
    wx.navigateTo({ url: `/pages/goods-edit/goods-edit?id=${e.currentTarget.dataset.id}` });
  }
});
