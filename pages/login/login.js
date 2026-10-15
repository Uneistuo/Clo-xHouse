// 裁间 · 登录 / 注册页
const { request } = require('../../utils/api');
const { confirm, toast } = require('../../utils/dialog');

Page({
  data: {
    mode: 'login', // login 登录 / register 注册
    loading: false,
    focusField: '',

    username: '',
    password: '',
    confirmPassword: '',

    usernameError: '',
    passwordError: '',
    confirmError: ''
  },

  onLoad() {
    const saved = wx.getStorageSync('login_username');
    if (saved) this.setData({ username: saved });
  },

  // 切换 登录 / 注册
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this.setData({ mode, confirmPassword: '' });
    this.clearErrors();
  },

  clearErrors() {
    this.setData({ usernameError: '', passwordError: '', confirmError: '' });
  },

  onFocus(e) {
    this.setData({ focusField: e.currentTarget.dataset.name });
  },
  onBlur() {
    this.setData({ focusField: '' });
  },

  onUsernameInput(e) {
    const v = e.detail.value;
    this.setData({ username: v, usernameError: '' });
  },
  onPasswordInput(e) {
    const v = e.detail.value;
    this.setData({ password: v, passwordError: '' });
  },
  onConfirmInput(e) {
    const v = e.detail.value;
    this.setData({ confirmPassword: v, confirmError: '' });
  },

  validate() {
    const { mode, username, password, confirmPassword } = this.data;
    const errors = { usernameError: '', passwordError: '', confirmError: '' };

    if (!username.trim()) {
      errors.usernameError = '请输入账号';
    } else if (mode === 'register' && !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      errors.usernameError = '账号需为 3-20 位字母、数字或下划线';
    }

    if (!password) {
      errors.passwordError = '请输入密码';
    } else if (mode === 'register' && (password.length < 6 || password.length > 32)) {
      errors.passwordError = '密码长度需为 6-32 位';
    }

    if (mode === 'register') {
      if (!confirmPassword) {
        errors.confirmError = '请再次输入密码';
      } else if (confirmPassword !== password) {
        errors.confirmError = '两次输入的密码不一致';
      }
    }

    this.setData(errors);
    return !errors.usernameError && !errors.passwordError && !errors.confirmError;
  },

  // 保存登录态：已绑定店铺进首页，未绑定进店铺页
  saveLoginState(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    if (data.admin && data.admin.username) {
      wx.setStorageSync('login_username', data.admin.username);
    }
    toast(this.data.mode === 'login' ? '登录成功' : '注册成功', 'success');
    setTimeout(() => {
      const target = data.admin && data.admin.storeId
        ? '/pages/index/index'
        : '/pages/store/store';
      wx.reLaunch({ url: target });
    }, 600);
  },

  async handleSubmit() {
    if (this.data.loading) return;
    if (!this.validate()) return;

    const { mode, username, password } = this.data;
    this.setData({ loading: true });
    try {
      if (mode === 'register') {
        const confirmed = await confirm({
          title: '确认注册',
          content: `确定使用账号「${username.trim()}」注册吗？`
        });
        if (!confirmed) return;
      }
      const data = await request({
        url: mode === 'login' ? '/api/auth/login' : '/api/auth/register',
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
