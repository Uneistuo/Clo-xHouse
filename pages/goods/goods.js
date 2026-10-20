// 商品管理页：商品列表 + 名称搜索 + 上下架筛选 + 上下架/编辑/删除 + 批量操作 + 低库存预警
// 全部数据来自后端 /api/goods 接口（实时读数据库），空表时显示空状态
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');
const { confirm, toast, loading: showLoading, hideLoading } = require('../../utils/dialog');

const PAGE_SIZE = 20;
const LOW_STOCK = 5;

Page({
  data: {
    keyword: '',
    statusTab: 'all',
    tabs: [
      { key: 'all', text: '全部' },
      { key: 'on', text: '上架中' },
      { key: 'off', text: '已下架' }
    ],
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
    loaded: false,

    manageMode: false,
    selectedIds: [],
    allSelected: false,

    // 按钮加载状态
    loadingDelete: null, // 单个删除/上下架的 loading id
    loadingBatch: false // 批量操作 loading
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadGoods(true);
  },

  onUnload() {
    clearTimeout(this._searchTimer);
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadGoods(true), 400);
  },

  handleSearch() {
    clearTimeout(this._searchTimer);
    this.loadGoods(true);
  },

  /** 清空搜索词并重新加载 */
  clearKeyword() {
    clearTimeout(this._searchTimer);
    this.setData({ keyword: '' });
    this.loadGoods(true);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ statusTab: key });
    this.loadGoods(true);
  },

  async loadGoods(reset = false) {
    if (!reset && this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
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
      if (seq !== this._seq) return;
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

  onReachBottom() {
    if (this.data.hasMore) this.loadGoods(false);
  },

  /** 商品封面加载失败 -> 显示占位图（P1-4） */
  onCoverError(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) return;
    this.setData({ [`list[${index}].cover`]: '' });
  },

  onPullDownRefresh() {
    this.loadGoods(true).finally(() => wx.stopPullDownRefresh());
  },

  // ============ 批量管理模式 ============
  toggleManage() {
    const next = !this.data.manageMode;
    const list = this.data.list.map((g) => ({ ...g, selected: false }));
    this.setData({ manageMode: next, list, selectedIds: [], allSelected: false });
  },

  onCardTap(e) {
    if (!this.data.manageMode) return;
    this.toggleSelect(e);
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g));
    const selectedIds = list.filter((g) => g.selected).map((g) => g.id);
    this.setData({ list, selectedIds, allSelected: list.length > 0 && selectedIds.length === list.length });
  },

  toggleSelectAll() {
    const next = !this.data.allSelected;
    const list = this.data.list.map((g) => ({ ...g, selected: next }));
    this.setData({ list, selectedIds: next ? list.map((g) => g.id) : [], allSelected: next });
  },

  async batchOnSale(e) {
    if (this.data.loadingBatch) return;
    const onSale = String(e.currentTarget.dataset.onsale) === '1' ? 1 : 0;
    const ids = this.data.selectedIds;
    if (!ids.length) {
      toast('请先选择商品', 'none');
      return;
    }
    const confirmed = await confirm({
      title: '批量操作',
      content: `确定将选中的 ${ids.length} 个商品${onSale ? '上架' : '下架'}吗？`
    });
    if (!confirmed) return;

    this.setData({ loadingBatch: true });
    try {
      for (const id of ids) {
        await request({ url: `/api/goods/${id}/status`, method: 'PUT', data: { onSale } });
      }
      toast('操作完成', 'success');
      this.toggleManage();
      this.loadGoods(true);
    } catch (e) {
      // 错误已由 request 统一 toast
    } finally {
      this.setData({ loadingBatch: false });
    }
  },

  async batchDelete() {
    if (this.data.loadingBatch) return;
    const ids = this.data.selectedIds;
    if (!ids.length) {
      toast('请先选择商品', 'none');
      return;
    }
    const confirmed = await confirm({
      title: '批量删除',
      content: `确定删除选中的 ${ids.length} 个商品吗？历史订单数据不受影响。`
    });
    if (!confirmed) return;

    this.setData({ loadingBatch: true });
    try {
      for (const id of ids) {
        await request({ url: `/api/goods/${id}`, method: 'DELETE' });
      }
      toast('已删除', 'success');
      this.toggleManage();
      this.loadGoods(true);
    } catch (e) {
    } finally {
      this.setData({ loadingBatch: false });
    }
  },

  // ============ 单条操作 ============
  async toggleStatus(e) {
    const { id, onsale } = e.currentTarget.dataset;
    const action = onsale === 1 ? '下架' : '上架';
    this.setData({ loadingDelete: id });
    try {
      const confirmed = await confirm({
        title: '提示',
        content: `确定将该商品${action}吗？`
      });
      if (!confirmed) {
        this.setData({ loadingDelete: null });
        return;
      }

      await request({
        url: `/api/goods/${id}/status`,
        method: 'PUT',
        data: { onSale: onsale === 1 ? 0 : 1 }
      });
      toast(`已${action}`, 'success');
      if (this.data.statusTab === 'all') {
        const idx = this.data.list.findIndex((g) => g.id === id);
        if (idx > -1) {
          this.setData({ [`list[${idx}].on_sale`]: onsale === 1 ? 0 : 1 });
        }
      } else {
        this.loadGoods(true);
      }
    } catch (e) {
    } finally {
      this.setData({ loadingDelete: null });
    }
  },

  goEdit(e) {
    wx.navigateTo({ url: `/pages/goods-edit/goods-edit?id=${e.currentTarget.dataset.id}` });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/goods-edit/goods-edit' });
  },

  async handleDelete(e) {
    const { id, name } = e.currentTarget.dataset;
    this.setData({ loadingDelete: id });
    try {
      const confirmed = await confirm({
        title: '删除确认',
        content: `确定删除商品【${name}】吗？（历史订单数据不受影响）`
      });
      if (!confirmed) {
        this.setData({ loadingDelete: null });
        return;
      }

      await request({ url: `/api/goods/${id}`, method: 'DELETE' });
      toast('已删除', 'success');
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
    } catch (e) {
    } finally {
      this.setData({ loadingDelete: null });
    }
  },

  goCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  }
});
