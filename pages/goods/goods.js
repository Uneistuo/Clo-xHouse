// 商品管理页：商品列表 + 名称搜索 + 上下架筛选 + 点击查看/编辑商品 + 批量管理（上下架/删除）+ 低库存预警
// 全部数据来自后端 /api/goods 接口（实时读数据库），空表时显示空状态
const { request, BASE_URL } = require('../../utils/api');
const { fmtMoney, resolveImg } = require('../../utils/util');
const warmup = require('../../utils/warmup');
const { confirm, toast, loading: showLoading, hideLoading } = require('../../utils/dialog');

const PAGE_SIZE = 20;
const LOW_STOCK = 5;
/** 批量栏「拉出」类名的兜底清理时间：正常由 animationend 精确摘除，动画被降级/中断时靠它 */
const DOCK_PULL_MS = 420;

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
    batchPulling: false, // 批量栏「从 TabBar 后方拉出」动画：只在普通栏→拼接栏那一次为 true
    batchHidden: false, // 页面被隐藏时先藏起批量栏，避免缓存页重新显示时先露出原位（见 onHide）
    selectedIds: [],
    allSelected: false,

    // 按钮加载状态
    loadingBatch: false // 批量操作 loading
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this._syncTabBar();
    this.loadGoods(true);
  },

  // 批量栏可见时让 TabBar 收起顶角，与批量栏拼接成同一块面板。
  // 注意：不要在 onHide 里复位 —— 开单页同样是拼接态，切页时复位会让
  // 中间"开单"键先变回凸起圆钮再消失，形成来回跳换。
  _syncTabBar(dock = this.data.manageMode) {
    if (typeof this.getTabBar !== 'function') return;
    const tabBar = this.getTabBar();
    if (!tabBar || typeof tabBar.applyBarState !== 'function') return;
    const info = tabBar.applyBarState({ selected: 1, dock });
    // 普通栏 → 拼接栏（c）：批量栏跟着从 TabBar 后方拉出，与栏体拼成同一块面板。
    // 页面从缓存里重新显示时（onHide 已把批量栏藏了）同样要拉一次，
    // 否则它会直接"凭空出现"，看着又是一次弹跳。
    if (dock && (!info || info.switching === 'c' || this.data.batchHidden)) {
      this._pullBatchBar();
    } else if (this.data.batchHidden) {
      this.setData({ batchHidden: false });
    }
  },

  /** 批量栏拉出：类名在场时不重播，重复同步不会打断动画 */
  _pullBatchBar() {
    if (this.data.batchPulling) return;
    clearTimeout(this._pullTimer);
    this.setData({ batchPulling: true, batchHidden: false });
    this._pullTimer = setTimeout(() => this.setData({ batchPulling: false }), DOCK_PULL_MS);
  },

  /** 批量栏「拉出」动画结束：立刻摘掉类名，z-index 在落位那一帧就回到 TabBar 之上 */
  onBatchPullEnd() {
    clearTimeout(this._pullTimer);
    if (this.data.batchPulling) this.setData({ batchPulling: false });
  },

  /** 离开页面时先藏起批量栏：缓存页重新显示的第一帧不能先画出「上一次的静止态」 */
  onHide() {
    clearTimeout(this._pullTimer);
    this.setData({ batchPulling: false, batchHidden: true });
  },

  onUnload() {
    clearTimeout(this._searchTimer);
    clearTimeout(this._pullTimer);
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

  async loadGoods(reset = false, silent = false) {
    if (!reset && this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    const params = {
      keyword: this.data.keyword.trim(),
      status: this.data.statusTab === 'all' ? '' : this.data.statusTab,
      page,
      pageSize: PAGE_SIZE
    };
    const seq = (this._seq = (this._seq || 0) + 1);
    // 首次进入命中启动预热：直接渲染，骨架屏不出现
    const warm = reset && !silent ? warmup.take('goods', params) : null;
    if (!silent && !warm) this.setData({ loading: true });
    try {
      const data = warm || (await warmup.fetch('goods', { url: '/api/goods', data: params }));
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
      // 预热快照可能已经过时：先渲染再静默补拉一次最新数据
      if (warm) this.loadGoods(true, true);
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
    this._syncTabBar(next);
  },

  /** 卡片点击：普通态 = 进入商品编辑；批量态 = 勾选 / 取消 */
  onCardTap(e) {
    if (this.data.manageMode) {
      this.toggleSelect(e);
      return;
    }
    this.goEdit(e);
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

  // ============ 商品详情 / 编辑 ============
  /** 进入商品编辑页（卡片点击 / 由其他入口复用） */
  goEdit(e) {
    const id = e && e.currentTarget ? e.currentTarget.dataset.id : e;
    wx.navigateTo({ url: `/pages/goods-edit/goods-edit?id=${id}` });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/goods-edit/goods-edit' });
  },

  goCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  }
});
