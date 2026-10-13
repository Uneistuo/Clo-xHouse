// pages/printer-pair/printer-pair.js - 蓝牙打印机配对页
const { printer } = require('../../utils/printer');
const { buildTestReceipt } = require('../../utils/receipt');

Page({
  data: {
    scanning: false,
    devices: [],
    savedDevice: null,
    connected: false,
    stateIconClass: 'icon-printer',
    stateTitle: '尚未连接打印机',
    stateSub: '点击下方按钮开始扫描',
    stateClass: 'status-disconnected'
  },

  onLoad() {
    const saved = printer.loadSavedDevice();
    if (saved) {
      this.setData({ savedDevice: saved });
      this._setState('saved');
    }
  },

  onUnload() {
    // 离开页面时停止扫描（保留连接，方便后续使用）
    if (this.data.scanning) {
      printer.stopDiscovery().catch(() => {});
      printer.offDeviceFound();
    }
  },

  _setState(kind) {
    // kind: 'saved' | 'scanning' | 'connected' | 'failed'
    const map = {
      saved: { icon: 'icon-clipboard', title: '已配对打印机', sub: '点击"重新连接"以连接', cls: 'status-disconnected' },
      scanning: { icon: 'icon-search', title: '正在扫描...', sub: '请确保打印机已开机并处于配对模式', cls: 'status-disconnected' },
      connected: { icon: 'icon-check-circle', title: '打印机已连接', sub: '可以正常打印小票', cls: 'status-connected' },
      failed: { icon: 'icon-x-circle', title: '操作失败', sub: '请重试或检查打印机状态', cls: 'status-disconnected' }
    };
    const s = map[kind] || map.saved;
    this.setData({
      stateIconClass: s.icon,
      stateTitle: s.title,
      stateSub: s.sub,
      stateClass: s.cls,
      connected: kind === 'connected'
    });
  },

  async onScan() {
    if (this.data.scanning) return;
    try {
      // 1. 检查蓝牙适配器
      const state = await printer.getAdapterState();
      if (!state.available) {
        await printer.initAdapter();
      }
      // 2. 清空旧列表 + 开始扫描
      this.setData({ devices: [], scanning: true });
      this._setState('scanning');

      await printer.startDiscovery();
      printer.onDeviceFound((devices) => {
        // 过滤：去重 + 排除明显不是打印机的设备
        const seen = new Set(this.data.devices.map((d) => d.deviceId));
        const fresh = devices.filter((d) => !seen.has(d.deviceId));
        if (fresh.length) {
          this.setData({ devices: this.data.devices.concat(fresh) });
        }
      });
    } catch (e) {
      this.setData({ scanning: false });
      this._setState('failed');
      wx.showModal({
        title: '扫描失败',
        content: e.message || '请检查蓝牙权限',
        showCancel: false
      });
    }
  },

  async onStopScan() {
    this.setData({ scanning: false });
    await printer.stopDiscovery().catch(() => {});
    printer.offDeviceFound();
    this._setState(this.data.savedDevice ? 'saved' : 'disconnected');
  },

  async onSelectDevice(e) {
    const { id, name } = e.currentTarget.dataset;
    // 停止扫描（避免干扰）
    if (this.data.scanning) {
      await printer.stopDiscovery().catch(() => {});
      printer.offDeviceFound();
      this.setData({ scanning: false });
    }

    wx.showLoading({ title: '连接中...', mask: true });
    try {
      await printer.fullConnect(id);
      const saved = {
        deviceId: id,
        name: name || '未知设备',
        pairedAt: Date.now()
      };
      printer.saveDevice(saved);
      this.setData({ savedDevice: saved });
      this._setState('connected');
      wx.hideLoading();
      wx.showToast({ title: '配对成功', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      this._setState('failed');
      wx.showModal({
        title: '配对失败',
        content: e.message || '连接失败，请重试',
        showCancel: false
      });
    }
  },

  async onReconnect() {
    const saved = this.data.savedDevice;
    if (!saved) return;
    wx.showLoading({ title: '连接中...', mask: true });
    const ok = await printer.quickConnect(saved.deviceId);
    wx.hideLoading();
    if (ok) {
      this._setState('connected');
      wx.showToast({ title: '已连接', icon: 'success' });
    } else {
      this._setState('failed');
      wx.showModal({
        title: '连接失败',
        content: '无法连接已配对设备，请检查打印机是否开机或重新配对',
        showCancel: false
      });
    }
  },

  async onTestPrint() {
    if (!printer.connected) {
      wx.showToast({ title: '请先连接打印机', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '打印中...', mask: true });
    try {
      const bytes = buildTestReceipt();
      await printer.writeBytes(bytes);
      wx.hideLoading();
      wx.showToast({ title: '打印成功', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showModal({
        title: '打印失败',
        content: e.message || '请检查打印机连接',
        showCancel: false
      });
    }
  },

  onUnpair() {
    wx.showModal({
      title: '解除配对',
      content: '解除后开单将无法打印小票，确定解除吗？',
      success: (res) => {
        if (!res.confirm) return;
        printer.close();
        printer.clearDevice();
        this.setData({ savedDevice: null, connected: false });
        this._setState('disconnected');
        wx.showToast({ title: '已解除配对', icon: 'success' });
      }
    });
  }
});
