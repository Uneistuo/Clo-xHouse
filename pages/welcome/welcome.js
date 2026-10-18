// 欢迎页：注册流程完成后展示一次，点击「开始使用」进入首页
Page({
  data: {
    username: '',
    storeName: ''
  },

  onLoad() {
    // 守卫：无登录态回登录页；未绑定店铺回注册页补绑定
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const info = wx.getStorageSync('adminInfo') || {};
    if (!info.storeId) {
      wx.reLaunch({ url: '/pages/register/register?mode=bind' });
      return;
    }
    this.setData({
      username: info.username || '',
      storeName: info.storeName || '你的店铺'
    });
  },

  handleStart() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
