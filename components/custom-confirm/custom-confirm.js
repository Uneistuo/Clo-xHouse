Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '提示' },
    content: { type: String, value: '' },
    cancelText: { type: String, value: '取消' },
    confirmText: { type: String, value: '确定' }
  },
  methods: {
    noop() {},
    onMaskTap() {
      // 点击遮罩不关闭，保持与 wx.showModal 一致的行为（需点按钮）
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    }
  }
});
