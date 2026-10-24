// 首页：经营看板
// 结构：周期销售额（书签切换）→ 关键指标 → 近 7 天趋势（可点选）→ 低库存（可直达补货）
const { request } = require('../../utils/api');
const { fmtMoney } = require('../../utils/util');

Page({
  data: {
    dateText: '', // 顶部日期，如：10月7日星期三

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
    pendingOrders: 0, // 待收款订单数
    periodOrders: 0, // 周期订单数
    periodSales: '0.00', // 周期销售额
    compareText: '', // 环比文案：如 "+12.3% 较上周"
    compareDirection: 'flat', // up / down / flat
    todoList: [], // 今日待办 [{ key, icon, text, count, path }]
    trend: [], // 近 7 天趋势 [{ date, amount, amountText, orders, barH }]
    trendIndex: 0, // 趋势图当前选中项
    trendSelected: null, // 当前选中项数据
    lowStock: [] // 低库存商品
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
      wx.reLaunch({ url: '/pages/register/register?mode=bind' });
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
      // 环比标签：今日=较昨日 / 本周=较上周 / 本月=较上月
      const compare = data.compare || {};
      const baseLabel = { today: '较昨日', week: '较上周', month: '较上月' }[this.data.rangeKey] || '较上期';
      let compareText = '';
      if (compare.percent !== null && compare.percent !== undefined) {
        const sign = compare.percent > 0 ? '+' : '';
        compareText = `${sign}${compare.percent}% ${baseLabel}`;
      } else if ((data.periodSales || 0) > 0 && !compare.prevSales) {
        compareText = '本期新增';
      }
      // 今日待办：待收款订单 / 低库存商品 / 会员生日提醒
      const todoList = [];
      if ((data.pendingOrders || 0) > 0) {
        todoList.push({
          key: 'pending',
          icon: 'icon-receipt',
          text: '待收款订单',
          count: data.pendingOrders,
          path: 'orders'
        });
      }
      if ((data.lowStock || []).length > 0) {
        todoList.push({
          key: 'lowStock',
          icon: 'icon-package',
          text: '低库存商品',
          count: data.lowStock.length,
          path: 'goods'
        });
      }
      if ((data.birthdays || []).length > 0) {
        todoList.push({
          key: 'birthday',
          icon: 'icon-cake',
          text: '会员生日提醒',
          count: data.birthdays.length,
          path: 'customer'
        });
      }
      this.setData({
        goodsTotal: data.goodsTotal || 0,
        goodsOnSale: data.goodsOnSale || 0,
        goodsOffSale: data.goodsOffSale || 0,
        pendingOrders: data.pendingOrders || 0,
        periodOrders: data.periodOrders || 0,
        periodSales: fmtMoney(data.periodSales || 0),
        compareText,
        compareDirection: compare.direction || 'flat',
        todoList,
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

  goGoods() {
    wx.switchTab({ url: '/pages/goods/goods' });
  },

  /** 快捷操作：快速开单（空购物车时按上次成交项预置常用商品，否则恢复未结算购物车） */
  goCreateOrder() {
    try {
      const cart = wx.getStorageSync('billing_cart');
      if (!Array.isArray(cart) || !cart.length) {
        wx.setStorageSync('billing_preset_frequent', 1);
      }
    } catch (e) {}
    wx.switchTab({ url: '/pages/billing/billing' });
  },

  /** 快捷操作：拍照上传（进入商品编辑并直接唤起选图/裁剪） */
  goPhotoUpload() {
    wx.navigateTo({ url: '/pages/goods-edit/goods-edit?focus=image' });
  },

  /** 今日待办点击：按类型跳转 */
  onTodoTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'pending') {
      try {
        wx.setStorageSync('orders_pending_filter', 1);
      } catch (err) {}
      wx.switchTab({ url: '/pages/orders/orders' });
      return;
    }
    if (key === 'lowStock') {
      this.goGoods();
      return;
    }
    if (key === 'birthday') {
      wx.navigateTo({ url: '/pages/customer/list' });
    }
  },

  /** 点击低库存商品 -> 去编辑补货 */
  goRestock(e) {
    wx.navigateTo({ url: `/pages/goods-edit/goods-edit?id=${e.currentTarget.dataset.id}` });
  }
});
