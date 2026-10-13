// 商品管理页：商品列表 + 名称搜索 + 上下架筛选 + 上下架/编辑/删除 + 批量操作 + 低库存预警
// 全部数据来自后端 /api/goods 接口（实时读数据库），空表时显示空状态
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');

const PAGE_SIZE = 20;
const LOW_STOCK = 5; // 低库存阈值（库存 <= 该值时高亮预警）

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
    loading: false,
    loaded: false,          // 是否已完成首次加载（用于骨架屏判断）

    // 批量管理模式
    manageMode: false,
    selectedIds: [],
    allSelected: false
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
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
      const selectedIds = this.data.selectedIds;
      const list = (data.list || []).map((g) => ({
        ...g,
        priceText: fmtMoney(g.price),
        originalPriceText: fmtMoney(g.original_price),
        cover: g.image ? resolveImg(g.image.split(',')[0], BASE_URL) : '',
        stockWarn: g.stock <= LOW_STOCK,
        selected: selectedIds.indexOf(g.id) > -1
      }));
      const merged = reset ? list : this.data.list.concat(list);
      this.setData({
        list: merged,
        total: data.total || 0,
        page,
        hasMore: list.length >= PAGE_SIZE,
        loading: false,
        loaded: true,
        allSelected: merged.length > 0 && merged.every((g) => g.selected)
      });
    } catch (e) {
      if (seq === this._seq) this.setData({ loading: false, loaded: true });
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

  // ============ 批量管理模式 ============
  /** 进入/退出管理模式 */
  toggleManage() {
    const next = !this.data.manageMode;
    const list = this.data.list.map((g) => ({ ...g, selected: false }));
    this.setData({ manageMode: next, list, selectedIds: [], allSelected: false });
  },

  /** 卡片点击：管理模式下切换选中，否则无操作 */
  onCardTap(e) {
    if (!this.data.manageMode) return;
    this.toggleSelect(e);
  },

  /** 单选/取消单个商品 */
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g));
    const selectedIds = list.filter((g) => g.selected).map((g) => g.id);
    this.setData({ list, selectedIds, allSelected: list.length > 0 && selectedIds.length === list.length });
  },

  /** 全选/取消全选（当前已加载列表） */
  toggleSelectAll() {
    const next = !this.data.allSelected;
    const list = this.data.list.map((g) => ({ ...g, selected: next }));
    this.setData({ list, selectedIds: next ? list.map((g) => g.id) : [], allSelected: next });
  },

  /** 批量上下架 */
  batchOnSale(e) {
    const onSale = String(e.currentTarget.dataset.onsale) === '1' ? 1 : 0;
    const ids = this.data.selectedIds;
    if (!ids.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量操作',
      content: `确定将选中的 ${ids.length} 个商品${onSale ? '上架' : '下架'}吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        try {
          for (const id of ids) {
            await request({ url: `/api/goods/${id}/status`, method: 'PUT', data: { onSale } });
          }
          wx.hideLoading();
          wx.showToast({ title: '操作完成', icon: 'success' });
          this.toggleManage();
          this.loadGoods(true);
        } catch (e) {
          wx.hideLoading();
        }
      }
    });
  },

  /** 批量删除（逻辑删除，历史订单不受影响） */
  batchDelete() {
    const ids = this.data.selectedIds;
    if (!ids.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量删除',
      content: `确定删除选中的 ${ids.length} 个商品吗？历史订单数据不受影响。`,
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...', mask: true });
        try {
          for (const id of ids) {
            await request({ url: `/api/goods/${id}`, method: 'DELETE' });
          }
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.toggleManage();
          this.loadGoods(true);
        } catch (e) {
          wx.hideLoading();
        }
      }
    });
  },

  // ============ 单条操作 ============
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
      confirmColor: '#dc2626',
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
