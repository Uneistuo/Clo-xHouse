// 订单管理页：订单列表 + 订单号搜索 + 状态筛选（tab 化）+ 时间范围筛选
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, STATUS_CLASS, PAY_METHOD_TEXT } = require('../../utils/util');

const PAGE_SIZE = 20;

Page({
  data: {
    // 状态筛选（tab 化）
    tabs: [
      { key: '', text: '全部' },
      { key: 'pending', text: '待收款' },
      { key: 'paid', text: '已收款' },
      { key: 'done', text: '待售后' },
      { key: 'refunded', text: '已售后' }
    ],
    statusKey: '',

    // 时间范围筛选（与 Web 端一致）
    ranges: [
      { key: 'all', text: '全部时间' },
      { key: 'today', text: '今日' },
      { key: 'week', text: '近 7 天' },
      { key: 'month', text: '近 30 天' }
    ],
    rangeTexts: ['全部时间', '今日', '近 7 天', '近 30 天'],
    rangeIndex: 0,

    keyword: '',
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
    loaded: false // 是否已完成首次加载（用于骨架屏判断）
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    // 首页"待收款订单"待办跳转：自动切到待收款 tab（一次性标记）
    try {
      if (wx.getStorageSync('orders_pending_filter')) {
        wx.removeStorageSync('orders_pending_filter');
        if (this.data.statusKey !== 'pending') this.setData({ statusKey: 'pending' });
      }
    } catch (err) {}
    this.loadOrders(true);
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },
  handleSearch() {
    this.loadOrders(true);
  },

  /** 清空搜索词并重新加载 */
  clearKeyword() {
    this.setData({ keyword: '' });
    this.loadOrders(true);
  },

  /** 切换状态筛选 tab */
  switchStatus(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.statusKey) return;
    this.setData({ statusKey: key });
    this.loadOrders(true);
  },

  /** 切换时间范围 */
  onRangeChange(e) {
    this.setData({ rangeIndex: Number(e.detail.value) });
    this.loadOrders(true);
  },

  /** 拉取订单列表（无订单时显示空状态） */
  async loadOrders(reset = false) {
    // 分页加载中忽略重复请求；reset（切筛选/搜索）允许打断
    if (this.data.loading && !reset) return;
    const page = reset ? 1 : this.data.page + 1;
    // 请求序号：晚到的旧响应丢弃，防止切换筛选时竞态覆盖
    const seq = (this._seq = (this._seq || 0) + 1);
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/orders',
        data: {
          status: this.data.statusKey,
          range: this.data.ranges[this.data.rangeIndex].key,
          keyword: this.data.keyword.trim(),
          page,
          pageSize: PAGE_SIZE
        }
      });
      if (seq !== this._seq) return;
      const list = (data.list || []).map((o) => ({
        ...o,
        amountText: fmtMoney(o.total_amount),
        statusText: STATUS_TEXT[o.status] || o.status,
        statusClass: STATUS_CLASS[o.status] || 'tag-gray',
        payText: PAY_METHOD_TEXT[o.pay_method] || o.pay_method
      }));
      this.setData({
        list: reset ? list : this.data.list.concat(list),
        total: data.total || 0,
        page,
        hasMore: list.length >= PAGE_SIZE,
        loading: false,
        loaded: true
      });
    } catch (e) {
      if (seq === this._seq) this.setData({ loading: false, loaded: true });
    }
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadOrders(false);
  },

  onPullDownRefresh() {
    this.loadOrders(true).finally(() => wx.stopPullDownRefresh());
  },

  /** 查看订单详情 */
  goDetail(e) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  /** 去开单 */
  goBilling() {
    wx.switchTab({ url: '/pages/billing/billing' });
  }
});
