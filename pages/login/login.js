// 登录/注册页：账号密码自由注册；登录态持久化（Token 存入本地 Storage）
const { request } = require('../../utils/api');

Page({
  data: {
    mode: 'login', // login 登录 / register 注册
    username: '',
    password: '',
    confirmPassword: '',
    loading: false
  },

  // 进入页面：回填上次登录的账号
  onLoad() {
    const saved = wx.getStorageSync('login_username');
    if (saved) this.setData({ username: saved });
  },

  // 切换 登录 / 注册
  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  // 保存登录态：已绑定店铺进首页，未绑定进店铺创建/绑定页
  saveLoginState(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    // 记住账号，下次登录自动回填
    if (data.admin && data.admin.username) {
      wx.setStorageSync('login_username', data.admin.username);
    }
    wx.showToast({
      title: this.data.mode === 'login' ? '登录成功' : '注册成功',
      icon: 'success'
    });
    setTimeout(() => {
      const target = data.admin && data.admin.storeId
        ? '/pages/index/index'
        : '/pages/store/store';
      wx.reLaunch({ url: target });
    }, 500);
  },

  // 提交登录
  async handleLogin() {
    const { username, password, loading } = this.data;
    if (loading) return;
    if (!username.trim() || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/auth/login',
        method: 'POST',
        data: { username: username.trim(), password }
      });
      this.saveLoginState(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  // 提交注册（自由注册，不建店；注册后可创建店铺或凭店铺码加入）
  async handleRegister() {
    const { username, password, confirmPassword, loading } = this.data;
    if (loading) return;
    if (!username.trim() || !password) {
      wx.showToast({ title: '请填写账号和密码', icon: 'none' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      wx.showToast({ title: '账号需为 3-20 位字母、数字或下划线', icon: 'none' });
      return;
    }
    if (password.length < 6 || password.length > 32) {
      wx.showToast({ title: '密码长度需为 6-32 位', icon: 'none' });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/auth/register',
        method: 'POST',
        data: { username: username.trim(), password }
      });
      this.saveLoginState(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理
    } finally {
      this.setData({ loading: false });
    }
  }
});
