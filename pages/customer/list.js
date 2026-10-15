// 会员列表页：搜索 + 分页 + CRM 统计（消费次数/累计金额/最近到店）+ 新增会员
const { request } = require('../../utils/api');

const PAGE_SIZE = 20;

Page({
  /** 空处理：配合 wxml 中的 catchtap="noop"，阻止弹窗内点击事件冒泡到遮罩（否则点输入框会关闭弹窗） */
  noop() {},

  data: {
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
    loaded: false,

    // 添加会员弹窗
    addVisible: false,
    formPhone: '',
    formSurname: '',
    formGender: 0,
    saving: false
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    // 每次进入都刷新（开单页添加了新会员后回来能看到）
    this.loadCustomers(true);
  },

  /** 拉取会员列表（reset=true 时回到第 1 页） */
  async loadCustomers(reset = false) {
    if (!reset && (this.data.loading || !this.data.hasMore)) return;
    if (reset && this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    const seq = (this._seq = (this._seq || 0) + 1); // 竞态防护
    this.setData({ loading: true });
    try {
      const data = await request({
        url: '/api/customer/list',
        data: { keyword: this.data.keyword, page, pageSize: PAGE_SIZE }
      });
      if (seq !== this._seq) return; // 已有更新的请求完成，丢弃本次
      const merged = reset ? data.list : this.data.list.concat(data.list);
      this.setData({
        list: merged,
        total: data.total || 0,
        page,
        hasMore: data.list.length >= PAGE_SIZE,
        loaded: true
      });
    } catch (e) {
      // 错误提示已由 request 统一处理
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 搜索输入（400ms 防抖） */
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadCustomers(true), 400);
  },

  clearKeyword() {
    this.setData({ keyword: '' });
    this.loadCustomers(true);
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadCustomers(false);
  },

  onPullDownRefresh() {
    this.loadCustomers(true).then(() => wx.stopPullDownRefresh());
  },

  /** 进入会员详情 */
  goDetail(e) {
    wx.navigateTo({ url: `/pages/customer/detail?id=${e.currentTarget.dataset.id}` });
  },

  // ============ 添加会员弹窗 ============
  openAdd() {
    this.setData({ addVisible: true, formPhone: '', formSurname: '', formGender: 0 });
  },
  closeAdd() {
    this.setData({ addVisible: false });
  },
  onFormPhoneInput(e) {
    this.setData({ formPhone: String(e.detail.value || '').replace(/\D/g, '').slice(0, 11) });
  },
  onFormSurnameInput(e) {
    this.setData({ formSurname: e.detail.value });
  },
  onFormGenderTap(e) {
    this.setData({ formGender: Number(e.currentTarget.dataset.gender) });
  },
  async confirmAdd() {
    const { formPhone, formSurname, formGender, saving } = this.data;
    if (saving) return;
    if (!/^\d{11}$/.test(formPhone)) {
      wx.showToast({ title: '请输入 11 位手机号', icon: 'none' });
      return;
    }
    if (!formSurname.trim()) {
      wx.showToast({ title: '请输入姓氏', icon: 'none' });
      return;
    }
    if (formGender !== 1 && formGender !== 2) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const r = await request({
        url: '/api/customer',
        method: 'POST',
        data: { phone: formPhone, surname: formSurname.trim(), gender: formGender }
      });
      wx.showToast({ title: r.message || '已添加会员', icon: 'success' });
      this.setData({ addVisible: false });
      this.loadCustomers(true);
    } catch (e) {
      // 错误提示已由 request 统一处理
    } finally {
      this.setData({ saving: false });
    }
  }
});
