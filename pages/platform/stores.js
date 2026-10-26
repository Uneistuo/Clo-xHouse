// 平台管理页：小程序平台管理员查看所有店铺，并控制各店铺"开单"白名单的授权时效
// 时效规则：到期时间 > 当前时间 = 可开单；关闭/到期后实时拦截开单请求（后端每次实时校验）
const { request } = require('../../utils/api');
const { confirm, toast } = require('../../utils/dialog');

const QUICK_DAYS = [7, 30, 90, 365];

Page({
  /** 空处理：配合 wxml 中的 catchtap，阻止弹窗内点击事件冒泡到遮罩 */
  noop() {},

  data: {
    list: [], // [{ id, name, owner_name, member_count, order_count, bind_code, created_at, expireAt, enabled, daysLeft }]
    loading: true,

    // 授权弹层
    visible: false,
    store: null, // 当前操作的店铺
    quickDays: QUICK_DAYS,
    selDays: 30, // 已选快捷天数（0=未选，采用自定义天数/日期）
    customDays: '', // 自定义天数
    dateValue: '', // 指定到期日期（YYYY-MM-DD，当日 23:59:59 到期）
    submitting: false
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.loadStores();
  },

  onPullDownRefresh() {
    this.loadStores().finally(() => wx.stopPullDownRefresh());
  },

  /** 拉取店铺列表（含授权状态与剩余天数） */
  async loadStores() {
    this.setData({ loading: true });
    try {
      const data = await request({ url: '/api/platform/stores' });
      this.setData({ list: data.list || [], loading: false });
    } catch (e) {
      // 错误提示由请求封装统一处理
      this.setData({ loading: false });
    }
  },

  /** 单行文本输入（editable modal），返回输入内容或 null（取消） */
  promptInput(title, placeholder, defaultValue) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        editable: true,
        placeholderText: placeholder,
        content: defaultValue || '',
        success: (res) => resolve(res.confirm ? (res.content || '').trim() : null),
        fail: () => resolve(null)
      });
    });
  },

  // ============ 授权 / 续期弹层 ============
  openAuth(e) {
    const store = this.data.list[e.currentTarget.dataset.index];
    if (!store) return;
    this.setData({
      visible: true,
      store,
      selDays: 30,
      customDays: '',
      dateValue: ''
    });
  },
  closeAuth() {
    if (this.data.submitting) return;
    this.setData({ visible: false });
  },

  /** 选择快捷天数（7/30/90/365 天） */
  pickDays(e) {
    this.setData({ selDays: Number(e.currentTarget.dataset.days), customDays: '', dateValue: '' });
  },

  /** 输入自定义天数（输入后快捷天数取消选中） */
  onCustomDays(e) {
    this.setData({ customDays: e.detail.value, selDays: 0, dateValue: '' });
  },

  /** 选择到期日期（选择后天数方式取消选中） */
  onDateChange(e) {
    this.setData({ dateValue: e.detail.value, selDays: 0, customDays: '' });
  },

  /** 确认授权：按天数（从当前时间起算）或指定到期日期 */
  async confirmAuth() {
    if (this.data.submitting) return;
    const { store, selDays, customDays, dateValue } = this.data;
    let payload = {};
    if (selDays > 0) {
      payload = { days: selDays };
    } else if (parseInt(customDays, 10) > 0) {
      payload = { days: parseInt(customDays, 10) };
    } else if (dateValue) {
      payload = { expireAt: dateValue }; // 后端按当日 23:59:59 到期
    } else {
      toast('请选择授权天数或到期日期', 'none');
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await request({
        url: `/api/platform/stores/${store.id}/billing`,
        method: 'POST',
        data: payload
      });
      toast(res.message || '授权成功', 'none');
      this.setData({ visible: false });
      this.loadStores();
    } catch (e) {
      // 失败提示由请求封装统一处理
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 关闭开单授权（立即生效，二次确认） */
  async onCloseAuth(e) {
    const { id, name } = e.currentTarget.dataset;
    const ok = await confirm({
      title: '关闭开单授权',
      content: `确定关闭店铺【${name}】的开单权限？关闭后该店铺立即无法开单。`,
      confirmText: '关闭'
    });
    if (!ok) return;
    try {
      const res = await request({
        url: `/api/platform/stores/${id}/billing`,
        method: 'POST',
        data: {} // days 不传 = 关闭授权
      });
      toast(res.message || '已关闭授权', 'none');
      this.loadStores();
    } catch (e2) {
      // 失败提示由请求封装统一处理
    }
  },

  /** 修改店铺名称（仅平台管理员；无冷却，名称全库唯一） */
  async onRenameStore(e) {
    const { id, name } = e.currentTarget.dataset;
    const storeName = await this.promptInput('修改店铺名称', '请输入新的店铺名称', name);
    if (storeName === null) return; // 用户取消
    if (!storeName) {
      toast('请填写新的店铺名称', 'none');
      return;
    }
    try {
      const r = await request({
        url: `/api/platform/stores/${id}/rename`,
        method: 'POST',
        data: { storeName }
      });
      toast(r.message || '名称已修改', 'none');
      this.loadStores();
    } catch (e2) {
      // 失败提示由请求封装统一处理
    }
  }
});
