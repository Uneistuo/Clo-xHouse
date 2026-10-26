// 分类管理页：默认模式仅展示 + 底部新增；管理模式下可长按拖动排序、删除
const { request } = require('../../utils/api');
const { confirm, toast } = require('../../utils/dialog');

Page({
  data: {
    list: [], // 分类列表（每项含 shiftY 字段用于拖动时位移）
    loading: true,
    // 新增分类表单（默认模式）
    addName: '',
    adding: false, // 新增按钮加载态
    // 管理模式与长按拖拽
    manageMode: false,
    itemHrpx: 120, // 列表项高度（rpx）
    itemH: 0, // 列表项高度（px），用于计算位移
    dragging: false,
    dragIndex: -1,
    dragStartY: 0,
    dragCurrentY: 0,
    targetIndex: -1
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.loadList();
  },

  /** 下拉刷新：重新拉取分类列表 */
  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  /** 加载分类列表（含每个分类商品数） */
  async loadList() {
    this.setData({ loading: true });
    try {
      const list = await request({ url: '/api/category' });
      const arr = (list || []).map((c) => ({ ...c, shiftY: 0 }));
      // 列表项高度换算（rpx -> px）用于拖动位移计算
      const sys = wx.getSystemInfoSync();
      const itemH = (this.data.itemHrpx * sys.windowWidth) / 750;
      this.setData({ list: arr, loading: false, itemH });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // ============ 默认模式：新增分类 ============
  onAddNameInput(e) {
    this.setData({ addName: e.detail.value });
  },

  async handleAdd() {
    if (this.data.adding) return;
    const name = String(this.data.addName || '').trim();
    if (!name) {
      toast('请输入分类名称', 'none');
      return;
    }
    this.setData({ adding: true });
    try {
      await request({ url: '/api/category', method: 'POST', data: { name, sort: 0 } });
      toast('已添加', 'success');
      this.setData({ addName: '' });
      this.loadList();
    } catch (e) {
      // 错误提示由请求封装统一处理
    } finally {
      this.setData({ adding: false });
    }
  },

  // ============ 管理模式开关 ============
  toggleManage() {
    const next = !this.data.manageMode;
    this.setData({
      manageMode: next,
      // 退出管理时重置可能的拖拽状态
      dragging: false,
      dragIndex: -1,
      targetIndex: -1,
      list: this.data.list.map((it) => ({ ...it, shiftY: 0 }))
    });
    // 切回默认模式后保留当前顺序，无需重新请求
  },

  // ============ 管理模式：删除 ============
  async handleDelete(e) {
    const { id, name } = e.currentTarget.dataset;
    const ok = await confirm({
      title: '删除分类',
      content: `确定删除分类【${name}】吗？`,
      confirmText: '删除'
    });
    if (!ok) return;
    try {
      await request({ url: `/api/category/${id}`, method: 'DELETE' });
      toast('已删除', 'success');
      this.loadList();
    } catch (e) {
      // 错误提示由请求封装统一处理
    }
  },

  // ============ 管理模式：长按拖动排序 ============
  onLongPress(e) {
    if (!this.data.manageMode) return;
    const { index } = e.currentTarget.dataset;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    this.setData({
      dragging: true,
      dragIndex: index,
      dragStartY: touch.clientY,
      dragCurrentY: touch.clientY,
      targetIndex: index
    });
  },

  onTouchMove(e) {
    if (!this.data.dragging) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const y = touch.clientY;
    const { dragIndex, dragStartY, itemH, list } = this.data;
    if (itemH <= 0) return;
    const delta = y - dragStartY;
    // 连续插值：被拖动项实时跟随手指；相邻项随其越过边界连续平滑滑出，
    // 避免"瞬时跳一格"的突兀感
    const dCells = delta / itemH; // 拖动跨越的格数（可小数/可负）
    const intCells = Math.floor(dCells); // 已完整跨越的格数（向下取整）
    const frac = dCells - intCells; // 当前格内已走比例 [0, 1)
    const newList = list.map((it, i) => {
      let shiftY = 0;
      if (i === dragIndex) {
        // 被拖动项：精确跟随手指
        shiftY = delta;
      } else if (i > dragIndex) {
        // 拖动项下方的邻居：当拖动项经过本格时连续向上让位
        const rel = i - dragIndex; // 1, 2, 3...
        if (rel <= intCells) {
          // 已被完整推开，停留在新位置
          shiftY = -itemH;
        } else if (rel === intCells + 1) {
          // 正在被推开：随拖动项前进而连续上移
          shiftY = -frac * itemH;
        }
      } else {
        // 拖动项上方的邻居：当拖动项上移经过时连续向下让位
        const rel = dragIndex - i; // 1, 2, 3...
        const absInt = -intCells; // 向上完整跨越的格数
        if (rel <= absInt) {
          shiftY = itemH;
        } else if (rel === absInt + 1) {
          shiftY = frac * itemH;
        }
      }
      return { ...it, shiftY };
    });
    // 目标落点：按四舍五入就近吸附，用于松手时确定最终索引
    const target = Math.max(0, Math.min(list.length - 1, dragIndex + Math.round(dCells)));
    this.setData({ list: newList, dragCurrentY: y, targetIndex: target });
  },

  onTouchEnd() {
    if (!this.data.dragging) return;
    const { list, dragIndex, targetIndex } = this.data;
    this.setData({ dragging: false, dragIndex: -1, dragCurrentY: 0, dragStartY: 0 });
    if (targetIndex === dragIndex || targetIndex < 0) {
      // 位置未变：仅重置位移
      this.setData({ list: list.map((it) => ({ ...it, shiftY: 0 })), targetIndex: -1 });
      return;
    }
    // 提交新顺序：调整 list 顺序并重置所有 shiftY
    const newList = list.slice();
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(targetIndex, 0, moved);
    this.setData({
      list: newList.map((it) => ({ ...it, shiftY: 0 })),
      targetIndex: -1
    });
    this.saveSort(newList.map((c) => c.id));
  },

  /** 持久化分类顺序 */
  async saveSort(ids) {
    try {
      await request({ url: '/api/category/sort', method: 'POST', data: { ids } });
      toast('排序已保存', 'success');
    } catch (e) {
      // 错误提示由请求封装统一处理
    }
  }
});
