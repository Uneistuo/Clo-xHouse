// 店铺页（tab 页）：未绑定时可"创建店铺"或"凭店铺码加入"；已绑定时展示店铺信息与成员
// 店主可绑定多个店铺（上限 3 个）：在我的店铺卡片中注册新店铺 / 快捷切换当前店铺
// 平台管理员在本页另有"平台管理"入口（控制各店铺开单白名单）
const { request } = require('../../utils/api');
const { printer } = require('../../utils/printer');

Page({
  data: {
    loading: true,
    storeId: 0,          // 0 = 未绑定店铺
    role: '',            // owner 店主 / staff 员工
    store: null,         // { name, bind_code, created_at }
    members: [],          // [{ id, username, role, created_at }]
    canRename: false,     // 平台管理员本月是否可修改店铺名称
    nextRenameAt: '',     // 下次可改名时间（本月已改过时展示）
    isPlatform: false,   // 平台管理员标记（显示"平台管理"入口）
    printerHint: '未连接打印机', // 打印设置卡片副标题
    action: 'create',    // 未绑定时选择：create 创建 / join 加入
    storeName: '',
    code: '',
    myStores: [],         // 店主名下店铺列表 [{ id, name, created_at }]
    storeLimit: 3,        // 店主最多可绑定店铺数
    canCreateStore: false, // 是否还能创建新店铺（名下店铺数 < 上限）
    showSwitchPopup: false // 切换店铺弹窗显示标记
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.setData({ isPlatform: !!(wx.getStorageSync('adminInfo') || {}).isPlatform });
    this.loadInfo();
    this.refreshPrinterHint();
  },

  /** 下拉刷新：重新拉取店铺信息 */
  onPullDownRefresh() {
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
      this.setData({
        loading: false,
        storeId: data.storeId || 0,
        role: data.role || '',
        store: data.store,
        members: data.members || [],
        canRename: !!data.canRename,
        nextRenameAt: data.nextRenameAt || '',
        myStores: data.myStores || [],
        storeLimit: data.storeLimit || 3,
        canCreateStore: !!data.canCreateStore
      });
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

  // 切换 创建 / 加入
  switchAction(e) {
    this.setData({ action: e.currentTarget.dataset.action });
  },

  onStoreNameInput(e) {
    this.setData({ storeName: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.toUpperCase() });
  },

  /** 绑定/创建成功后更新本地登录态（后端重签了携带店铺身份的 Token） */
  saveNewToken(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    this.loadInfo();
  },

  // 创建店铺（创建者即店主，获得唯一店铺码）
  async handleCreate() {
    const { storeName, loading } = this.data;
    if (loading) return;
    if (!storeName.trim()) {
      wx.showToast({ title: '请填写店铺名称', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/store/create',
        method: 'POST',
        data: { storeName: storeName.trim() }
      });
      wx.showToast({ title: '店铺创建成功', icon: 'success' });
      this.saveNewToken(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  // 注册新店铺（仅店主；已有店铺后仍可继续创建，上限 3 个，创建后自动切换为当前店铺）
  handleCreateNew() {
    const { canCreateStore, storeLimit } = this.data;
    if (!canCreateStore) {
      wx.showToast({ title: `每个店主最多可绑定 ${storeLimit} 个店铺`, icon: 'none' });
      return;
    }
    wx.showModal({
      title: '注册新店铺',
      editable: true,
      placeholderText: '请输入新店铺名称',
      success: async (res) => {
        if (!res.confirm) return;
        const storeName = (res.content || '').trim();
        if (!storeName) {
          wx.showToast({ title: '请填写店铺名称', icon: 'none' });
          return;
        }
        try {
          const data = await request({
            url: '/api/store/create',
            method: 'POST',
            data: { storeName }
          });
          wx.showToast({ title: '新店铺创建成功', icon: 'success' });
          this.saveNewToken(data);
        } catch (e) {
          // 错误提示已由请求封装统一处理（重名/数量上限等）
        }
      }
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

  handleSwitchStore(e) {
    const { id, name } = e.currentTarget.dataset;
    if (Number(id) === this.data.storeId) return;
    wx.showModal({
      title: '切换店铺',
      content: `确定切换到【${name}】吗？切换后商品与订单将展示该店铺的数据。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const data = await request({
            url: '/api/store/switch',
            method: 'POST',
            data: { storeId: Number(id) }
          });
          this.closeSwitchPopup();
          wx.showToast({ title: '已切换', icon: 'success' });
          this.saveNewToken(data);
        } catch (e) {
          // 错误提示已由请求封装统一处理
        }
      }
    });
  },

  // 凭店铺码加入店铺（商品/订单数据自动同步）
  async handleJoin() {
    const { code, loading } = this.data;
    if (loading) return;
    if (!code.trim()) {
      wx.showToast({ title: '请输入店铺码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/store/bind',
        method: 'POST',
        data: { code: code.trim() }
      });
      wx.showToast({ title: '已加入，数据已同步', icon: 'success' });
      this.saveNewToken(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  // 退出店铺（员工自行退出共享，店主不可退出）
  handleUnbind() {
    wx.showModal({
      title: '退出店铺',
      content: '退出后将不再看到该店铺的商品与订单，确定退出吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const data = await request({ url: '/api/store/unbind', method: 'POST' });
          wx.showToast({ title: '已退出', icon: 'success' });
          this.saveNewToken(data);
        } catch (e) {
          // 错误提示已由请求封装统一处理
        }
      }
    });
  },

  // 修改店铺名称（仅平台管理员，每月限一次，全小程序名称唯一）
  handleRename() {
    const { canRename, nextRenameAt, store } = this.data;
    if (!canRename) {
      wx.showModal({
        title: '暂不能修改名称',
        content: `每月仅可修改一次店铺名称，${(nextRenameAt || '').slice(0, 10)} 后可再次修改。`,
        showCancel: false
      });
      return;
    }
    wx.showModal({
      title: '修改店铺名称',
      editable: true,
      placeholderText: '请输入新的店铺名称',
      content: store.name,
      success: async (res) => {
        if (!res.confirm) return;
        const storeName = (res.content || '').trim();
        if (!storeName) {
          wx.showToast({ title: '请填写新的店铺名称', icon: 'none' });
          return;
        }
        try {
          const data = await request({
            url: '/api/store/rename',
            method: 'POST',
            data: { storeName }
          });
          wx.showToast({ title: '名称已修改', icon: 'success' });
          // 同步本地缓存的店铺名
          const adminInfo = wx.getStorageSync('adminInfo') || {};
          wx.setStorageSync('adminInfo', { ...adminInfo, storeName });
          this.loadInfo();
        } catch (e) {
          // 错误提示已由请求封装统一处理（重名/频率限制等）
        }
      }
    });
  },

  // 移除店铺成员（仅店主，被移除成员立即失去本店数据权限）
  handleRemoveMember(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '移除成员',
      content: `确定将【${name}】移出店铺吗？移除后其将无法查看本店商品与订单。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const data = await request({
            url: '/api/store/member/remove',
            method: 'POST',
            data: { memberId: Number(id) }
          });
          wx.showToast({ title: data.message || '已移除', icon: 'none' });
          this.loadInfo();
        } catch (err) {
          // 错误提示已由请求封装统一处理
        }
      }
    });
  },

  // 复制店铺码（分享给员工绑定）
  handleCopyCode() {
    wx.setClipboardData({
      data: this.data.store.bind_code,
      success: () => wx.showToast({ title: '店铺码已复制', icon: 'success' })
    });
  },

  // 重置店铺码（仅店主）
  handleResetCode() {
    wx.showModal({
      title: '重置店铺码',
      content: '重置后旧店铺码立即失效，已绑定的成员不受影响，确定重置吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({ url: '/api/store/code', method: 'POST' });
          wx.showToast({ title: '已重置', icon: 'success' });
          this.loadInfo();
        } catch (e) {
          // 错误提示已由请求封装统一处理
        }
      }
    });
  },

  // 平台管理：控制各店铺开单白名单（仅平台管理员可见入口）
  goPlatform() {
    wx.navigateTo({ url: '/pages/platform/stores' });
  },

  // 打印设置：跳转配对页
  goPrinter() {
    wx.navigateTo({ url: '/pages/printer-pair/printer-pair' });
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => { if (res.confirm) getApp().logout(); }
    });
  }
});
