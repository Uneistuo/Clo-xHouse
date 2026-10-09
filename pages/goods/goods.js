// 商品管理页：商品列表 + 名称搜索 + 上下架筛选 + 上下架/编辑/删除操作
// 全部数据来自后端 /api/goods 接口（实时读数据库），空表时显示空状态
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');

const PAGE_SIZE = 20;

Page({
  data: {
    keyword: '',            // 搜索关键字
    statusTab: 'all',       // 筛选：all 全部 / on 上架 / off 下架
    tabs: [
      { key: 'all', text: '全部' },
      { key: 'on', text: '上架中' },
      { key: 'off', text: '已下架' }
    ],
    list: [],               // 商品列表
    total: 0,               // 商品总数
    page: 1,
    hasMore: false,
    loading: false
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    // 从编辑页返回时刷新列表
    this.loadGoods(true);
  },

  onUnload() {
    clearTimeout(this._searchTimer);
  },

  /** 搜索输入（400ms 防抖自动搜索） */
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadGoods(true), 400);
  },

  /** 触发搜索 */
  handleSearch() {
    clearTimeout(this._searchTimer);
    this.loadGoods(true);
  },

  /** 切换上架状态筛选 */
  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ statusTab: key });
    this.loadGoods(true);
  },

  /**
   * 拉取商品列表
   * @param reset true 表示从第一页重新加载
   */
  async loadGoods(reset = false) {
    // 分页加载中忽略重复分页请求；reset（切筛选/搜索/操作后刷新）允许打断
    if (!reset && this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    // 请求序号：晚到的旧响应直接丢弃，防止切换筛选时竞态覆盖新结果
    const seq = (this._seq = (this._seq || 0) + 1);
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/goods',
        data: {
          keyword: this.data.keyword.trim(),
          status: this.data.statusTab === 'all' ? '' : this.data.statusTab,
          page,
          pageSize: PAGE_SIZE
        }
      });
      if (seq !== this._seq) return; // 已有更新的请求，丢弃本次结果
      const list = (data.list || []).map((g) => ({
        ...g,
        priceText: fmtMoney(g.price),
        originalPriceText: fmtMoney(g.original_price),
        cover: g.image ? resolveImg(g.image.split(',')[0], BASE_URL) : ''
      }));
      this.setData({
        list: reset ? list : this.data.list.concat(list),
        total: data.total || 0,
        page,
        hasMore: list.length >= PAGE_SIZE,
        loading: false
      });
    } catch (e) {
      if (seq === this._seq) this.setData({ loading: false });
    }
  },

  /** 上拉加载更多 */
  onReachBottom() {
    if (this.data.hasMore) this.loadGoods(false);
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadGoods(true).finally(() => wx.stopPullDownRefresh());
  },

  /** 上架 / 下架切换 */
  toggleStatus(e) {
    const { id, onsale } = e.currentTarget.dataset;
    const action = onsale === 1 ? '下架' : '上架';
    wx.showModal({
      title: '提示',
      content: `确定将该商品${action}吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({
            url: `/api/goods/${id}/status`,
            method: 'PUT',
            data: { onSale: onsale === 1 ? 0 : 1 }
          });
          wx.showToast({ title: `已${action}`, icon: 'success' });
          // 「全部」页签下局部更新单条状态，避免整页刷新打断浏览位置；
          // 处于上架/下架筛选页签时商品需离开当前列表，整页刷新
          if (this.data.statusTab === 'all') {
            const idx = this.data.list.findIndex((g) => g.id === id);
            if (idx > -1) {
              this.setData({ [`list[${idx}].on_sale`]: onsale === 1 ? 0 : 1 });
            }
          } else {
            this.loadGoods(true);
          }
        } catch (e) { /* 失败提示已由请求层统一 toast */ }
      }
    });
  },

  /** 编辑商品 */
  goEdit(e) {
    wx.navigateTo({ url: `/pages/goods-edit/goods-edit?id=${e.currentTarget.dataset.id}` });
  },

  /** 新增商品 */
  goAdd() {
    wx.navigateTo({ url: '/pages/goods-edit/goods-edit' });
  },

  /** 逻辑删除商品 */
  handleDelete(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除确认',
      content: `确定删除商品【${name}】吗？（历史订单数据不受影响）`,
      confirmColor: '#e54d42',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({ url: `/api/goods/${id}`, method: 'DELETE' });
          wx.showToast({ title: '已删除', icon: 'success' });
          // 局部移除该条并同步总数；当前页删空且还有后续数据时整页刷新补齐
          const idx = this.data.list.findIndex((g) => g.id === id);
          if (idx > -1) {
            this.data.list.splice(idx, 1);
            this.setData({
              list: this.data.list,
              total: Math.max(0, this.data.total - 1)
            });
          }
          if (this.data.list.length === 0 && this.data.hasMore) {
            this.loadGoods(true);
          }
        } catch (e) { /* 失败提示已由请求层统一 toast */ }
      }
    });
  },

  /** 跳转分类管理 */
  goCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  }
});
