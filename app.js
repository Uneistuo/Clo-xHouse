// app.js 全局入口：云开发初始化 + 登录态管理
App({
  onLaunch() {
    // 云开发初始化（全局仅需一次；真机上所有云托管请求都依赖它）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-d8gi3gmlw2c70f695',
        traceUser: true
      });
    }
  },

  globalData: {},

  /** 检查登录态；未登录则跳转登录页（各业务页 onShow 中调用） */
  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  /** 退出登录：清空本地登录信息并回到登录页 */
  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('adminInfo');
    wx.removeStorageSync('billing_store_cache');
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
