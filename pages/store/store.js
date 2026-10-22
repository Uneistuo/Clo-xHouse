// 店铺页（tab 页）：未绑定时可"创建店铺"或"凭店铺码加入"；已绑定时展示店铺信息与成员
// 店主可绑定多个店铺（上限 3 个）：在我的店铺卡片中注册新店铺 / 快捷切换当前店铺
// 平台管理员在本页另有"平台管理"入口（控制各店铺开单白名单）
const { request } = require('../../utils/api');
const { printer } = require('../../utils/printer');
const { confirm, toast } = require('../../utils/dialog');

/** px -> rpx 换算比例（750rpx = 屏幕宽度） */
function getRpxRatio() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  return 750 / (info.windowWidth || 375);
}

Page({
  data: {
    loading: true,
    storeId: 0, // 0 = 未绑定店铺
    role: '', // owner 店主 / staff 员工
    store: null, // { name, bind_code, created_at }
    members: [], // [{ id, username, role, created_at }]
    canRename: false, // 保留字段（暂未在页面使用；改名已统一移至平台管理页）
    nextRenameAt: '', // 保留字段
    isPlatform: false, // 平台管理员标记（显示"平台管理"入口）
    printerHint: '未连接打印机', // 打印设置卡片副标题
    myStores: [], // 店主名下店铺列表 [{ id, name, created_at }]
    storeLimit: 3, // 店主最多可绑定店铺数
    canCreateStore: false, // 是否还能创建新店铺（名下店铺数 < 上限）
    canExpandMembers: false, // 是否有可展开的成员/注册内容；无内容时隐藏拖拽把手
    showSwitchPopup: false, // 切换店铺弹窗显示标记
    membersExpanded: false, // 成员区是否已完全展开（默认收起）
    cardHeight: 0, // 卡片当前总高度（rpx），0 = 由内容自适应
    expandHeight: 0, // 展开区当前高度（rpx）
    isDragging: false, // 是否正在拖拽
    pageStyle: '', // 拖拽时锁定页面滚动，避免触发下拉刷新
    maxExpandHeight: 0, // 完全展开时卡片总高度（rpx）
    collapseHeight: 0 // 收起状态卡片高度（rpx）
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (this.data.isDragging) {
      this._dragMoved = false;
      this._setExpanded(this.data.membersExpanded);
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    // 先用本地缓存兜底，避免接口返回前/失败时误显示未绑定引导
    const cached = wx.getStorageSync('adminInfo') || {};
    this.setData({
      isPlatform: !!cached.isPlatform,
      storeId: cached.storeId || this.data.storeId || 0
    });
    // 未绑定店铺时不再强制跳转，由页面内的引导卡片提供注册/加入入口
    this.loadInfo();
    this.refreshPrinterHint();
  },

  onHide() {
    // 拖拽中切走页面时，按当前状态回弹，避免残留 isDragging / 页面滚动锁
    if (this.data.isDragging) {
      this._dragMoved = false;
      this._setExpanded(this.data.membersExpanded);
      return;
    }
    if (this.data.pageStyle) this.setData({ pageStyle: '' });
  },

  /**
   * 下拉刷新：重新拉取店铺信息
   * 店铺卡片支持下拉展开，原生下拉刷新会与拖拽手势冲突，因此 store.json 已关闭 enablePullDownRefresh；
   * 页面在 onShow 时会自动刷新。保留该回调，便于后续恢复原生刷新时兜底。
   */
  onPullDownRefresh() {
    // 拖拽把手时若被系统误判为下拉刷新，直接忽略，避免打断手势
    if (this.data.isDragging) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadInfo().finally(() => wx.stopPullDownRefresh());
  },

  /** 更新打印设置卡片副标题（已配对/未配对） */
  refreshPrinterHint() {
    const saved = printer.loadSavedDevice();
    if (!saved) {
      this.setData({ printerHint: '未配对打印机（开单后将提示）' });
    } else {
      this.setData({ printerHint: `已配对：${saved.name || '打印机'}` });
    }
  },

  /** 拉取当前绑定店铺信息 */
  async loadInfo() {
    try {
      const data = await request({ url: '/api/store/info' });
      const members = data.members || [];
      const canExpandMembers =
        !!data.storeId && (members.length > 0 || (data.role === 'owner' && !!data.canCreateStore));
      // 切换店铺/解绑/无展开内容时需要重置展开状态，避免沿用上一家店铺的卡片高度
      const resetCard = !data.storeId || (!!this.data.storeId && data.storeId !== this.data.storeId);
      const resetExpand = resetCard || !canExpandMembers;
      this.setData(
        {
          loading: false,
          storeId: data.storeId || 0,
          role: data.role || '',
          store: data.store,
          members,
          canRename: !!data.canRename,
          nextRenameAt: data.nextRenameAt || '',
          myStores: data.myStores || [],
          storeLimit: data.storeLimit || 3,
          canCreateStore: !!data.canCreateStore,
          canExpandMembers,
          ...(resetExpand
            ? {
                membersExpanded: false,
                cardHeight: 0,
                expandHeight: 0,
                isDragging: false,
                pageStyle: '',
                maxExpandHeight: 0,
                collapseHeight: 0
              }
            : {})
        },
        () => {
          if (this.data.storeId && this.data.canExpandMembers) wx.nextTick(() => this._measureCard());
        }
      );
      // 同步本地缓存的 adminInfo（店铺名/店铺ID）
      const adminInfo = wx.getStorageSync('adminInfo') || {};
      wx.setStorageSync('adminInfo', {
        ...adminInfo,
        storeId: data.storeId || 0,
        storeName: data.store ? data.store.name : null
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /** 测量收起高度与展开内容高度，换算成 rpx 后驱动拖拽/回弹 */
  _measureCard() {
    if (!this.data.storeId || !this.data.canExpandMembers) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('.store-card').boundingClientRect();
    query.select('.expand-area').boundingClientRect();
    query.select('.expand-inner').boundingClientRect();
    query.exec((res) => {
      const cardRect = res[0];
      const expandRect = res[1];
      const innerRect = res[2];
      if (!cardRect || !expandRect || !innerRect) return;
      if (this.data.isDragging) return; // 拖拽中不打断手指跟随

      const ratio = getRpxRatio();
      const collapseHeight = Math.max(0, Math.round((cardRect.height - expandRect.height) * ratio));
      const contentHeight = Math.max(0, Math.round(innerRect.height * ratio));
      const maxExpandHeight = collapseHeight + contentHeight;
      const expanded = this.data.membersExpanded;
      this.setData({
        collapseHeight,
        maxExpandHeight,
        expandHeight: expanded ? contentHeight : 0,
        cardHeight: collapseHeight + (expanded ? contentHeight : 0)
      });
    });
  },

  /** 展开/收起成员区（点击把手时调用） */
  toggleMembers() {
    this._setExpanded(!this.data.membersExpanded);
  },

  /** 设置展开状态并同步卡片/展开区高度 */
  _setExpanded(expanded) {
    if (!this.data.canExpandMembers) {
      this.setData({
        isDragging: false,
        pageStyle: '',
        membersExpanded: false,
        expandHeight: 0,
        cardHeight: 0
      });
      return;
    }
    const contentHeight = Math.max(0, this.data.maxExpandHeight - this.data.collapseHeight);
    if (expanded && contentHeight <= 0) {
      this.setData({ isDragging: false, pageStyle: '' });
      return;
    }
    this.setData({
      isDragging: false,
      pageStyle: '',
      membersExpanded: expanded,
      expandHeight: expanded ? contentHeight : 0,
      cardHeight: this.data.collapseHeight + (expanded ? contentHeight : 0)
    });
  },

  /** 触摸开始：记录起点与当前展开高度 */
  onDragStart(e) {
    if (!this.data.canExpandMembers) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const mode = (e.currentTarget.dataset || {}).mode || 'expand';
    if (mode === 'expand' && this.data.membersExpanded) return;
    if (mode === 'collapse' && !this.data.membersExpanded) return;
    if (this.data.maxExpandHeight - this.data.collapseHeight <= 0) return;

    this._dragMode = mode;
    this._dragStartY = touch.clientY;
    this._dragStartExpand = this.data.expandHeight;
    this._dragMoved = false;
    this._rpxRatio = getRpxRatio();
    // 锁定页面滚动，避免拖拽时页面跟随移动；同时兜底停止可能残留的下拉刷新
    // overscroll-behavior 在部分安卓机型会被忽略，保留作为支持机型的增强；overflow 负责基础锁定
    wx.stopPullDownRefresh();
    this.setData({
      isDragging: true,
      pageStyle: 'overflow: hidden; overscroll-behavior: none;'
    });
  },

  /** 触摸移动：展开区高度跟随手指，向上/向下都受最大/最小值约束 */
  onDragMove(e) {
    if (!this.data.isDragging) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;

    const deltaPx = touch.clientY - this._dragStartY;
    if (Math.abs(deltaPx) > 4) this._dragMoved = true;
    const contentHeight = Math.max(0, this.data.maxExpandHeight - this.data.collapseHeight);
    const nextExpand = Math.round(
      Math.max(0, Math.min(contentHeight, this._dragStartExpand + deltaPx * (this._rpxRatio || 1)))
    );
    this.setData({
      expandHeight: nextExpand,
      cardHeight: this.data.collapseHeight + nextExpand
    });
  },

  /** 触摸结束：未移动视为点击，移动则按 40% 阈值吸附 */
  onDragEnd() {
    if (!this.data.isDragging) return;
    const contentHeight = Math.max(0, this.data.maxExpandHeight - this.data.collapseHeight);
    const moved = this._dragMoved;
    this._dragMoved = false;

    if (!moved) {
      this.toggleMembers();
      return;
    }

    const threshold = contentHeight * 0.4;
    const shouldExpand =
      this._dragMode === 'collapse'
        ? this.data.expandHeight > contentHeight - threshold
        : this.data.expandHeight >= threshold;
    this._setExpanded(shouldExpand);
  },

  /** 触摸被系统打断：按当前状态回弹，不触发点击切换 */
  onDragCancel() {
    if (!this.data.isDragging) return;
    this._dragMoved = false;
    this._setExpanded(this.data.membersExpanded);
  },

  /** 绑定/创建成功后更新本地登录态（后端重签了携带店铺身份的 Token） */
  saveNewToken(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    // 切换/新建/退出店铺后先收起卡片，避免旧店铺的展开高度残留
    this.setData({
      membersExpanded: false,
      cardHeight: 0,
      expandHeight: 0,
      maxExpandHeight: 0,
      collapseHeight: 0,
      isDragging: false,
      pageStyle: ''
    });
    this.loadInfo();
  },

  // 注册新店铺（仅店主；已有店铺后仍可继续创建，上限 3 个，创建后自动切换为当前店铺）
  async handleCreateNew() {
    const { canCreateStore, storeLimit } = this.data;
    if (!canCreateStore) {
      toast(`每个店主最多可绑定 ${storeLimit} 个店铺`, 'none');
      return;
    }
    const storeName = await this.promptInput('注册新店铺', '请输入新店铺名称');
    if (!storeName) return;
    try {
      const data = await request({
        url: '/api/store/create',
        method: 'POST',
        data: { storeName }
      });
      toast('新店铺创建成功', 'success');
      this.saveNewToken(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理（重名/数量上限等）
    }
  },

  /** 调用 wx.showModal 做单行文本输入（editable 模式），返回输入内容或 null */
  promptInput(title, placeholder) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        editable: true,
        placeholderText: placeholder,
        success: (res) => resolve(res.confirm ? (res.content || '').trim() : null),
        fail: () => resolve(null)
      });
    });
  },

  // 快捷切换当前店铺（仅限店主名下店铺，切换后商品/订单数据随之切换）
  // 入口：店铺名称旁圆形小图标 -> 弹窗选择名下店铺
  openSwitchPopup() {
    this.setData({ showSwitchPopup: true });
  },

  closeSwitchPopup() {
    this.setData({ showSwitchPopup: false });
  },

  // 阻止弹窗内点击冒泡到遮罩
  noop() {},

  async handleSwitchStore(e) {
    const { id, name } = e.currentTarget.dataset;
    if (Number(id) === this.data.storeId) return;
    const confirmed = await confirm({
      title: '切换店铺',
      content: `确定切换到【${name}】吗？切换后商品与订单将展示该店铺的数据。`
    });
    if (!confirmed) return;
    try {
      const data = await request({
        url: '/api/store/switch',
        method: 'POST',
        data: { storeId: Number(id) }
      });
      this.closeSwitchPopup();
      toast('已切换', 'success');
      this.saveNewToken(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    }
  },

  // 退出店铺（员工自行退出共享，店主不可退出）
  async handleUnbind() {
    const confirmed = await confirm({
      title: '退出店铺',
      content: '退出后将不再看到该店铺的商品与订单，确定退出吗？'
    });
    if (!confirmed) return;
    try {
      const data = await request({ url: '/api/store/unbind', method: 'POST' });
      toast('已退出', 'success');
      this.saveNewToken(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    }
  },

  // 移除店铺成员（仅店主，被移除成员立即失去本店数据权限）
  async handleRemoveMember(e) {
    const { id, name } = e.currentTarget.dataset;
    const confirmed = await confirm({
      title: '移除成员',
      content: `确定将【${name}】移出店铺吗？移除后其将无法查看本店商品与订单。`
    });
    if (!confirmed) return;
    try {
      const data = await request({
        url: '/api/store/member/remove',
        method: 'POST',
        data: { memberId: Number(id) }
      });
      toast(data.message || '已移除', 'none');
      this.loadInfo();
    } catch (err) {
      // 错误提示已由请求封装统一处理
    }
  },

  // 复制店铺码（分享给员工绑定）
  handleCopyCode() {
    wx.setClipboardData({
      data: this.data.store.bind_code,
      success: () => toast('店铺码已复制', 'success')
    });
  },

  // 重置店铺码（仅店主）
  async handleResetCode() {
    const confirmed = await confirm({
      title: '重置店铺码',
      content: '重置后旧店铺码立即失效，已绑定的成员不受影响，确定重置吗？'
    });
    if (!confirmed) return;
    try {
      await request({ url: '/api/store/code', method: 'POST' });
      toast('已重置', 'success');
      this.loadInfo();
    } catch (e) {
      // 错误提示已由请求封装统一处理
    }
  },

  // 平台管理：控制各店铺开单白名单（仅平台管理员可见入口）
  goPlatform() {
    wx.navigateTo({ url: '/pages/platform/stores' });
  },

  // 未绑定店铺引导：进入注册+绑定页（第 2 步）
  goRegister() {
    wx.navigateTo({ url: '/pages/register/register?mode=bind' });
  },

  // 打印设置：跳转配对页
  goPrinter() {
    wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
  },

  // 会员客户：跳转会员列表页
  goCustomers() {
    wx.navigateTo({ url: '/pages/customer/list' });
  },

  // 退出登录
  async handleLogout() {
    const confirmed = await confirm({
      title: '提示',
      content: '确定退出登录吗？'
    });
    if (confirmed) getApp().logout();
  }
});
