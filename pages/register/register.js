// 注册 + 绑定页（三步：注册账号 → 绑定店铺 → 完成）
// 入口：登录页「立即注册」（mode=register）/ 已登录未绑定兜底（mode=bind）
const { request } = require('../../utils/api');
const { confirm, toast } = require('../../utils/dialog');

Page({
  data: {
    mode: 'register', // register 新注册 / bind 老用户补绑定
    step: 1, // 1 / 2 / 3
    resumeHint: '', // 「检测到未完成的注册：xxx」
    canBackStep1: false, // 第 2 步是否显示「上一步」
    bindMethod: 'create', // create 创建 / join 加入
    focusField: '',
    loading: false,

    username: '',
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
    storeName: '',
    code: '',

    usernameError: '',
    passwordError: '',
    confirmError: '',
    registerConflict: false, // 账号已被注册（提供「去登录」）

    adminInfo: {},

    stepTitle: '注册账号'
  },

  onLoad(options) {
    const mode = options && options.mode === 'bind' ? 'bind' : 'register';
    const info = wx.getStorageSync('adminInfo') || {};

    if (mode === 'bind') {
      // 已有账号，仅补绑定：直接进入第 2 步
      this.setData({ mode, step: 2, adminInfo: info });
      this.syncStepText(2);
      return;
    }

    // 新注册：若本地已有 token 且未绑定店铺，视为中途退出，直接进入第 2 步续注册
    const token = wx.getStorageSync('token');
    if (token && info.username && !info.storeId) {
      this.setData({
        mode,
        step: 2,
        adminInfo: info,
        canBackStep1: true,
        resumeHint: `检测到未完成的注册：${info.username}`
      });
      this.syncStepText(2);
    } else {
      this.setData({ mode, step: 1 });
      this.syncStepText(1);
    }
  },

  /** 按当前步骤更新标题 */
  syncStepText(step) {
    const map = { 1: '注册账号', 2: '绑定店铺', 3: '完成' };
    this.setData({ stepTitle: map[step] });
  },

  /** 仅允许在完成过第 1 步时回退 */
  goStep1() {
    if (!this.data.canBackStep1) return;
    this.setData({ step: 1 });
    this.syncStepText(1);
  },

  clearErrors() {
    this.setData({ usernameError: '', passwordError: '', confirmError: '', registerConflict: false });
  },

  onFocus(e) {
    this.setData({ focusField: e.currentTarget.dataset.name });
  },
  onBlur() {
    this.setData({ focusField: '' });
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value, usernameError: '', registerConflict: false });
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value, passwordError: '' });
  },
  onConfirmInput(e) {
    this.setData({ confirmPassword: e.detail.value, confirmError: '' });
  },
  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },
  toggleConfirmPassword() {
    this.setData({ showConfirmPassword: !this.data.showConfirmPassword });
  },
  onStoreNameInput(e) {
    this.setData({ storeName: e.detail.value });
  },
  onCodeInput(e) {
    this.setData({ code: e.detail.value.toUpperCase() });
  },

  switchBindMethod(e) {
    this.setData({ bindMethod: e.currentTarget.dataset.method });
  },

  /** 第 1 步校验（规则与改造前注册模式一致） */
  validateRegister() {
    const { username, password, confirmPassword } = this.data;
    const errors = { usernameError: '', passwordError: '', confirmError: '', registerConflict: false };

    if (!username.trim()) {
      errors.usernameError = '请输入账号';
    } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      errors.usernameError = '账号需为 3-20 位字母、数字或下划线';
    }
    if (!password) {
      errors.passwordError = '请输入密码';
    } else if (password.length < 6 || password.length > 32) {
      errors.passwordError = '密码长度需为 6-32 位';
    }
    if (!confirmPassword) {
      errors.confirmError = '请再次输入密码';
    } else if (confirmPassword !== password) {
      errors.confirmError = '两次输入的密码不一致';
    }

    this.setData(errors);
    return !errors.usernameError && !errors.passwordError && !errors.confirmError;
  },

  /** 保存登录态（后端重签了 Token） */
  saveAuth(data) {
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('adminInfo', data.admin);
    if (data.admin && data.admin.username) {
      wx.setStorageSync('login_username', data.admin.username);
    }
  },

  /** 第 1 步：注册账号 */
  async handleRegister() {
    if (this.data.loading) return;
    if (!this.validateRegister()) return;

    const { username, password } = this.data;
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/auth/register',
        method: 'POST',
        data: { username: username.trim(), password }
      });
      this.saveAuth(data);
      toast('注册成功', 'success');
      this.setData({ step: 2, adminInfo: data.admin, canBackStep1: true });
      this.syncStepText(2);
    } catch (e) {
      const msg = (e && e.message) || '';
      // 账号重复：定位到账号字段并提供「去登录」
      if (/已注册|已存在|已被/.test(msg)) {
        this.setData({ usernameError: msg || '该账号已被注册', registerConflict: true });
      }
      // 其余错误（含 429 频控、网络异常）沿用 request 统一 toast，停留本步
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 第 2 步：创建店铺 */
  async handleCreate() {
    const { storeName, loading } = this.data;
    if (loading) return;
    if (!storeName.trim()) {
      toast('请填写店铺名称', 'none');
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/store/create',
        method: 'POST',
        data: { storeName: storeName.trim() }
      });
      this.saveAuth(data);
      toast('店铺创建成功', 'success');
      this.setData({ step: 3, adminInfo: data.admin });
      this.syncStepText(3);
    } catch (e) {
      // 错误提示已由请求封装统一处理，停留本步
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 第 2 步：凭店铺码加入 */
  async handleJoin() {
    const { code, loading } = this.data;
    if (loading) return;
    if (!code.trim()) {
      toast('请输入店铺码', 'none');
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/store/bind',
        method: 'POST',
        data: { code: code.trim() }
      });
      this.saveAuth(data);
      toast('已加入，数据已同步', 'success');
      this.setData({ step: 3, adminInfo: data.admin });
      this.syncStepText(3);
    } catch (e) {
      // 错误提示已由请求封装统一处理，停留本步
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 第 3 步：新注册进欢迎页；补绑定直接进首页 */
  handleDone() {
    const target = this.data.mode === 'register' ? '/pages/welcome/welcome' : '/pages/index/index';
    wx.reLaunch({ url: target });
  },

  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  },

  /** 放弃续注册：清空登录态与表单，回到第 1 步 */
  resetRegister() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('adminInfo');
    this.setData({
      step: 1,
      canBackStep1: false,
      resumeHint: '',
      username: '',
      password: '',
      confirmPassword: '',
      showPassword: false,
      showConfirmPassword: false,
      storeName: '',
      code: '',
      adminInfo: {}
    });
    this.clearErrors();
    this.syncStepText(1);
  },

  async handleLogout() {
    const confirmed = await confirm({ title: '提示', content: '确定退出登录吗？' });
    if (confirmed) getApp().logout();
  }
});
