// utils/printer.js - 蓝牙打印服务
// 封装微信小程序蓝牙 API + ESC/POS 发送 + 状态管理
// 适用于佳博 PT261 等标准 ESC/POS 小票机

const STORAGE_KEY = 'printer_device';

// 佳博 PT261 常用 UUID（多数国产小票机也使用这些）
const PRINT_SERVICE_UUID = '49535343-FE7D-4AE5-8E1A-6F5B3E8A3C8D';
const WRITE_CHAR_UUID = '49535343-8841-43F4-A8D4-ECBE34729BB9';
const NOTIFY_CHAR_UUID = '49535343-1E4D-4BD9-BA61-23C647249616';

// 分包大小（蓝牙单包安全 20 字节；多数设备 MTU≥20）
const PACKET_SIZE = 20;
// 包间间隔（毫秒；避免打印机来不及处理）
const PACKET_INTERVAL = 20;

class BluetoothPrinter {
  constructor() {
    this.deviceId = null;
    this.serviceId = null;
    this.writeCharId = null;
    this.connected = false;
  }

  // ============== 蓝牙生命周期 ==============

  /** 初始化蓝牙适配器 */
  async initAdapter() {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: resolve,
        fail: (e) => reject(new Error(this._errMsg(e, '请检查手机蓝牙是否开启')))
      });
    });
  }

  /** 检查蓝牙适配器状态 */
  async getAdapterState() {
    return new Promise((resolve) => {
      wx.getBluetoothAdapterState({
        success: (res) => resolve(res),
        fail: () => resolve({ available: false })
      });
    });
  }

  /** 开始扫描 */
  async startDiscovery() {
    return new Promise((resolve, reject) => {
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        interval: 0,
        success: resolve,
        fail: reject
      });
    });
  }

  /** 停止扫描 */
  async stopDiscovery() {
    return new Promise((resolve) => {
      wx.stopBluetoothDevicesDiscovery({
        success: resolve,
        fail: resolve
      });
    });
  }

  /** 监听设备发现事件（回调签名：devices => void） */
  onDeviceFound(callback) {
    wx.onBluetoothDeviceFound((res) => {
      if (callback) callback(res.devices || []);
    });
  }

  /** 移除设备发现监听 */
  offDeviceFound() {
    wx.offBluetoothDeviceFound();
  }

  /** 连接设备（不读 services/characteristics，仅连） */
  async connectDevice(deviceId) {
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        timeout: 10000,
        success: resolve,
        fail: (e) => reject(new Error(this._errMsg(e, '连接失败')))
      });
    });
  }

  /** 断开连接 */
  async disconnect(deviceId) {
    if (!deviceId) return;
    return new Promise((resolve) => {
      wx.closeBLEConnection({
        deviceId,
        success: resolve,
        fail: resolve
      });
    });
  }

  /** 读取 services */
  async getServices(deviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId,
        success: (res) => resolve(res.services || []),
        fail: (e) => reject(new Error(this._errMsg(e, '读取服务失败')))
      });
    });
  }

  /** 读取 characteristics */
  async getCharacteristics(deviceId, serviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res) => resolve(res.characteristics || []),
        fail: (e) => reject(new Error(this._errMsg(e, '读取特征失败')))
      });
    });
  }

  /** 启用 notify（部分打印机需要） */
  async enableNotify(deviceId, serviceId, characteristicId) {
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId,
        state: true,
        success: resolve,
        fail: reject
      });
    });
  }

  // ============== 完整连接流程 ==============

  /**
   * 完整连接流程：连接 + 发现写特征 + 启用 notify
   * 兼容多种 service UUID（佳博 / 通用）
   */
  async fullConnect(deviceId) {
    await this.connectDevice(deviceId);
    // 给设备一点时间建立链路
    await this._sleep(150);

    const services = await this.getServices(deviceId);
    if (!services.length) throw new Error('未发现可用服务');

    // 候选 service（优先佳博专用，再退到任何含写特征的服务）
    const candidates = [];
    if (services.find((s) => this._uuidEq(s.uuid, PRINT_SERVICE_UUID))) {
      candidates.push(PRINT_SERVICE_UUID);
    }
    for (const s of services) candidates.push(s.uuid);

    let chosenService = null;
    let writeChar = null;
    for (const svcUuid of candidates) {
      try {
        const chars = await this.getCharacteristics(deviceId, svcUuid);
        // 找写特征（write 或 writeNoResponse）
        const wc = chars.find((c) => c.properties.write || c.properties.writeNoResponse);
        if (wc) {
          chosenService = svcUuid;
          writeChar = wc.uuid;
          // 如果有 notify 一并启用
          const nc = chars.find((c) => c.properties.notify || c.properties.indicate);
          if (nc) {
            try {
              await this.enableNotify(deviceId, svcUuid, nc.uuid);
            } catch (e) { /* 非关键 */ }
          }
          break;
        }
      } catch (e) { /* 跳过这个 service */ }
    }

    if (!writeChar) throw new Error('未找到可写特征（设备不兼容？）');

    this.deviceId = deviceId;
    this.serviceId = chosenService;
    this.writeCharId = writeChar;
    this.connected = true;
  }

  /**
   * 快速连接已配对设备（用于开单前静默重连）
   */
  async quickConnect(deviceId) {
    try {
      await this.fullConnect(deviceId);
      return true;
    } catch (e) {
      this.connected = false;
      return false;
    }
  }

  /** 断开并清理 */
  async close() {
    const id = this.deviceId;
    this.deviceId = null;
    this.serviceId = null;
    this.writeCharId = null;
    this.connected = false;
    if (id) await this.disconnect(id);
  }

  // ============== 数据发送 ==============

  /** 发送字节流（自动分包） */
  async writeBytes(buffer) {
    if (!this.connected) throw new Error('未连接打印机');
    if (!(buffer instanceof Uint8Array)) buffer = new Uint8Array(buffer);

    for (let offset = 0; offset < buffer.byteLength; offset += PACKET_SIZE) {
      const end = Math.min(offset + PACKET_SIZE, buffer.byteLength);
      const chunk = buffer.slice(offset, end);
      await this._writeChunk(chunk);
      await this._sleep(PACKET_INTERVAL);
    }
  }

  /** 发送单个 chunk */
  _writeChunk(chunk) {
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: this.writeCharId,
        value: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
        success: resolve,
        fail: (e) => reject(new Error(this._errMsg(e, '写入失败')))
      });
    });
  }

  /** 发送 ESC/POS 构造器（小票内容） */
  async printBuilder(builder) {
    await this.writeBytes(builder.toBytes());
  }

  // ============== 设备持久化 ==============

  /** 读取本地保存的设备配置 */
  loadSavedDevice() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  /** 保存设备配置 */
  saveDevice(device) {
    wx.setStorageSync(STORAGE_KEY, device);
  }

  /** 清除设备配置 */
  clearDevice() {
    wx.removeStorageSync(STORAGE_KEY);
  }

  // ============== 工具 ==============

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _uuidEq(a, b) {
    if (!a || !b) return false;
    return a.toUpperCase() === b.toUpperCase();
  }

  _errMsg(e, fallback) {
    if (e && e.errMsg) {
      // 微信 errMsg 形如 "openBluetoothAdapter:fail xxx"
      const m = e.errMsg.match(/fail\s+(.+)$/);
      if (m) return m[1];
    }
    return fallback || '操作失败';
  }
}

// 单例
const printer = new BluetoothPrinter();

module.exports = {
  printer,
  PRINT_SERVICE_UUID,
  WRITE_CHAR_UUID,
  PACKET_SIZE
};
