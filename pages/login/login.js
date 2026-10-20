// 裁间 · 登录页（注册已拆分到独立的 pages/register 页）
const { request } = require('../../utils/api');

Page({
  data: {
    loading: false,
    focusField: '',

    username: '',
    password: '',
    showPassword: false,

    usernameError: '',
    passwordError: ''
  },

  onLoad() {
    const saved = wx.getStorageSync('login_username');
    if (saved) this.setData({ username: saved });
  },

  clearErrors() {
    this.setData({ usernameError: '', passwordError: '' });
  },

  onFocus(e) {
    this.setData({ focusField: e.currentTarget.dataset.name });
  },
  onBlur() {
    this.setData({ focusField: '' });
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value, usernameError: '' });
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value, passwordError: '' });
  },
  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  validate() {
    const { username, password } = this.data;
    const errors = { usernameError: '', passwordError: '' };

    if (!username.trim()) errors.usernameError = '请输入账号';
    if (!password) errors.passwordError = '请输入密码';

    this.setData(errors);
    return !errors.usernameError && !errors.passwordError;
  },

  /** 保存登录态：已绑定店铺进首页；未绑定进注册+绑定页（第 2 步） */
  saveLoginState(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    if (data.admin && data.admin.username) {
      wx.setStorageSync('login_username', data.admin.username);
    }
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      const target = data.admin && data.admin.storeId ? '/pages/index/index' : '/pages/register/register?mode=bind';
      wx.reLaunch({ url: target });
    }, 600);
  },

  async handleSubmit() {
    if (this.data.loading) return;
    if (!this.validate()) return;

    const { username, password } = this.data;
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/auth/login',
        method: 'POST',
        data: { username: username.trim(), password }
      });
      this.saveLoginState(data);
    } catch (e) {
      // 错误提示已由请求封装统一处理（账号或密码错误等）
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 跳转独立的注册 + 绑定页 */
  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
