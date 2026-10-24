// utils/print-service.js - 打印设置与小票打印统一入口
// 职责：
//   1. 打印设置读写（模板 / 纸张宽度），本地持久化（Storage）
//   2. 按设置构建小票字节流（转发到 receipt.js）
//   3. 打印记录（最近 10 条，含失败状态）读写
// 开单页 / 订单详情 / 配对页统一从这里读取设置，避免各处散落
const { buildReceipt, buildTestReceipt, TEMPLATES, PAPER_WIDTHS } = require('./receipt');
const { printer } = require('./printer');

const SETTINGS_KEY = 'print_settings';
const LOGS_KEY = 'print_logs';
const LOGS_MAX = 10;

/** 默认打印设置：经典模板 + 58mm，与旧行为一致 */
const DEFAULT_SETTINGS = {
  template: 'classic',
  paperWidth: 58
};

/** 读取打印设置（带默认值与容错） */
function loadSettings() {
  try {
    const raw = wx.getStorageSync(SETTINGS_KEY) || {};
    return {
      template: TEMPLATES.some((t) => t.key === raw.template) ? raw.template : DEFAULT_SETTINGS.template,
      paperWidth: PAPER_WIDTHS.some((p) => p.value === raw.paperWidth) ? raw.paperWidth : DEFAULT_SETTINGS.paperWidth
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 保存打印设置（增量合并） */
function saveSettings(patch) {
  try {
    const next = { ...loadSettings(), ...(patch || {}) };
    wx.setStorageSync(SETTINGS_KEY, next);
    return next;
  } catch (e) {
    return loadSettings();
  }
}

/** 按当前打印设置构建订单小票字节流 */
function buildReceiptWithSettings(opts) {
  const settings = loadSettings();
  return buildReceipt({
    ...opts,
    template: opts.template || settings.template,
    paperWidth: opts.paperWidth || settings.paperWidth
  });
}

/** 按当前设置构建测试小票 */
function buildTestReceiptWithSettings() {
  return buildTestReceipt(loadSettings());
}

// ============ 打印记录（最近 10 条） ============

/** 读取打印记录（最新在前） */
function loadPrintLogs() {
  try {
    const list = wx.getStorageSync(LOGS_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/** 追加一条打印记录（自动截断为最近 10 条） */
function recordPrint(entry) {
  try {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const time = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const list = loadPrintLogs();
    list.unshift({
      orderNo: (entry && entry.orderNo) || '',
      ok: !!(entry && entry.ok),
      template: (entry && entry.template) || loadSettings().template,
      paperWidth: (entry && entry.paperWidth) || loadSettings().paperWidth,
      time
    });
    wx.setStorageSync(LOGS_KEY, list.slice(0, LOGS_MAX));
  } catch (e) {}
}

/** 清空打印记录 */
function clearPrintLogs() {
  try {
    wx.removeStorageSync(LOGS_KEY);
  } catch (e) {}
}

/** 确保打印机连接（已连接直接返回；有配对设备则尝试静默重连） */
async function ensureConnected() {
  if (printer.connected) return true;
  const saved = printer.loadSavedDevice();
  if (!saved) return false;
  return printer.quickConnect(saved.deviceId);
}

module.exports = {
  TEMPLATES,
  PAPER_WIDTHS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  buildReceiptWithSettings,
  buildTestReceiptWithSettings,
  loadPrintLogs,
  recordPrint,
  clearPrintLogs,
  ensureConnected
};
