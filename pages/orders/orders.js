// 订单管理页：订单列表 + 订单号搜索 + 状态筛选（状态显示在订单右侧）
const { request } = require('../../utils/api');
const { fmtMoney, STATUS_TEXT, STATUS_CLASS, PAY_METHOD_TEXT } = require('../../utils/util');

const PAGE_SIZE = 20;

// 状态筛选选项（显示文案与接口状态值一一对应）
const FILTER_KEYS = ['', 'pending', 'paid', 'done', 'refunded'];

Page({
  data: {
    filters: ['全部状态', '待收款', '已收款', '待售后', '已售后'],
    filterIndex: 0,
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.loadOrders(true);
  },

  onKeywordInput(e) { this.setData({ keyword: e.detail.value }); },
  handleSearch() { this.loadOrders(true); },

  /** 搜索栏右侧状态筛选 */
  onFilterChange(e) {
    this.setData({ filterIndex: Number(e.detail.value) });
    this.loadOrders(true);
  },

  /** 拉取订单列表（无订单时显示空状态） */
  async loadOrders(reset = false) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/orders',
        data: {
          status: FILTER_KEYS[this.data.filterIndex] || '',
          keyword: this.data.keyword.trim(),
          page,
          pageSize: PAGE_SIZE
        }
      });
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
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
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
