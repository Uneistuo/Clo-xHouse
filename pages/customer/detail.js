// 会员详情页：CRM 统计 + 等级/标签/生日/备注 + 编辑/删除 + 消费记录（按会员关联的订单）
const { request } = require('../../utils/api');
const { STATUS_TEXT, getMemberLevel, daysToBirthday, fmtBirthday } = require('../../utils/util');
const { confirm, toast } = require('../../utils/dialog');

const PAGE_SIZE = 20;

/** 快捷标签 / 备注预设（点选即录入，降低输入成本） */
const TAG_PRESETS = ['常客', '高价值', '价格敏感', '企业采购', '待唤醒'];
const REMARK_PRESETS = ['喜欢新款', '偏爱基础款', '对折扣敏感', '生日到店', '请勿短信打扰'];

/** 标签字符串 -> 数组（支持中英文逗号 / 顿号） */
function splitTags(s) {
  return String(s || '')
    .split(/[,，、]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

Page({
  /** 空处理：配合 wxml 中的 catchtap，阻止弹窗内点击事件冒泡到遮罩（否则点输入框会关闭弹窗） */
  noop() {},

  data: {
    id: 0,
    customer: null, // 会员信息（含 CRM 统计）
    loaded: false,

    // 消费记录
    orders: [],
    orderTotal: 0,
    orderPage: 1,
    orderHasMore: false,
    orderLoading: false,
    orderLoaded: false,

    // 编辑弹窗（姓氏/性别/标签/生日/备注）
    editVisible: false,
    editSurname: '',
    editGender: 0,
    editTags: '',
    editBirthday: '',
    editRemark: '',
    tagPresets: TAG_PRESETS,
    remarkPresets: REMARK_PRESETS,
    saving: false
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id, 10) || 0 });
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.loadDetail();
    this.loadOrders(true);
  },

  /** 加载会员详情（含 CRM 统计），并派生等级 / 生日提醒字段 */
  async loadDetail() {
    try {
      const data = await request({ url: `/api/customer/${this.data.id}` });
      const days = daysToBirthday(data.birthday);
      const customer = {
        ...data,
        level: getMemberLevel(data.totalAmount),
        birthdayText: fmtBirthday(data.birthday),
        daysLeft: days,
        birthdaySoon: days >= 0 && days <= 7
      };
      this.setData({ customer, loaded: true });
    } catch (e) {
      // 错误提示已由 request 统一处理
    }
  },

  /** 加载消费记录 */
  async loadOrders(reset = false) {
    if (!reset && (this.data.orderLoading || !this.data.orderHasMore)) return;
    const page = reset ? 1 : this.data.orderPage + 1;
    const seq = (this._seq = (this._seq || 0) + 1);
    this.setData({ orderLoading: true });
    try {
      const data = await request({
        url: `/api/customer/${this.data.id}/orders`,
        data: { page, pageSize: PAGE_SIZE }
      });
      if (seq !== this._seq) return;
      const merged = reset ? data.list : this.data.orders.concat(data.list);
      this.setData({
        orders: merged,
        orderTotal: data.total || 0,
        orderPage: page,
        orderHasMore: data.list.length >= PAGE_SIZE,
        orderLoaded: true
      });
    } catch (e) {
      this.setData({ orderLoaded: true });
    } finally {
      this.setData({ orderLoading: false });
    }
  },

  onReachBottom() {
    if (this.data.orderHasMore) this.loadOrders(false);
  },

  /** 订单状态文案 */
  statusText(status) {
    return STATUS_TEXT[status] || status;
  },

  /** 跳转订单详情 */
  goOrder(e) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  // ============ 编辑会员（姓氏 / 性别 / 标签 / 生日 / 备注） ============
  openEdit() {
    const c = this.data.customer;
    this.setData({
      editVisible: true,
      editSurname: c.surname,
      editGender: c.gender,
      editTags: (c.tags || []).join('、'),
      editBirthday: c.birthday || '',
      editRemark: c.remark || ''
    });
  },
  closeEdit() {
    this.setData({ editVisible: false });
  },
  onEditSurnameInput(e) {
    this.setData({ editSurname: e.detail.value });
  },
  onEditTagsInput(e) {
    this.setData({ editTags: e.detail.value });
  },
  onEditRemarkInput(e) {
    this.setData({ editRemark: e.detail.value });
  },
  onEditGenderTap(e) {
    this.setData({ editGender: Number(e.currentTarget.dataset.gender) });
  },

  /** 快捷标签：点击切换选中状态（写入/移除） */
  onEditTagPreset(e) {
    const tag = e.currentTarget.dataset.tag;
    const list = splitTags(this.data.editTags);
    const idx = list.indexOf(tag);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(tag);
    this.setData({ editTags: list.join('、') });
  },

  /** 快捷备注：点击追加到备注尾部（去重） */
  onRemarkPreset(e) {
    const text = e.currentTarget.dataset.text;
    const cur = this.data.editRemark;
    if (cur.includes(text)) return;
    const next = cur ? `${cur}；${text}` : text;
    this.setData({ editRemark: next.slice(0, 200) });
  },

  onEditBirthdayChange(e) {
    this.setData({ editBirthday: e.detail.value });
  },
  clearEditBirthday() {
    this.setData({ editBirthday: '' });
  },

  async confirmEdit() {
    const { id, editSurname, editGender, editTags, editBirthday, editRemark, saving } = this.data;
    if (saving) return;
    if (!editSurname.trim()) {
      toast('请输入姓氏', 'none');
      return;
    }
    if (editGender !== 1 && editGender !== 2) {
      toast('请选择性别', 'none');
      return;
    }
    this.setData({ saving: true });
    try {
      await request({
        url: `/api/customer/${id}`,
        method: 'PUT',
        data: {
          surname: editSurname.trim(),
          gender: editGender,
          tags: splitTags(editTags),
          birthday: editBirthday || '',
          remark: editRemark.trim()
        }
      });
      toast('已保存', 'success');
      this.setData({ editVisible: false });
      this.loadDetail(); // 刷新显示名与统计
    } catch (e) {
      // 错误提示已由 request 统一处理
    } finally {
      this.setData({ saving: false });
    }
  },

  // ============ 删除会员 ============
  async onDelete() {
    const { id, displayName } = this.data.customer;
    const ok = await confirm({
      title: '删除会员',
      content: `确定删除会员【${displayName}】？该操作不可恢复，历史订单中的姓名快照将保留。`,
      confirmText: '删除'
    });
    if (!ok) return;
    try {
      await request({ url: `/api/customer/${id}`, method: 'DELETE' });
      toast('会员已删除', 'success');
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      // 错误提示已由 request 统一处理
    }
  }
});
