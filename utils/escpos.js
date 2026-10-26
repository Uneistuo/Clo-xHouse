// utils/escpos.js - ESC/POS 指令构造器
// 用于将小票内容拼装成字节流（Uint8Array）
// 适用于佳博 PT261 等支持 ESC/POS 标准的 58mm 小票机

const { gbkEncode } = require('./gbk');

// 58mm 小票纸：每行 32 个汉字（按 16 字符宽度算）
// 大字号时为 16 个汉字；正常字号 32 个汉字
const LINE_WIDTH_NORMAL = 32; // 正常字号（每行 32 汉字宽度）
const LINE_WIDTH_LARGE = 16; // 大字号（每行 16 汉字宽度）

class EscPosBuilder {
  constructor() {
    this.buffer = [];
  }

  // ESC @ - 初始化打印机
  init() {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  // ESC a n - 对齐（0=左 1=居中 2=右）
  align(n) {
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  // ESC E n - 加粗
  bold(on) {
    this.buffer.push(0x1b, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  // ESC ! n - 字号选择（位 0-3 宽、4-7 高）
  // 0x00 正常；0x10 倍宽；0x01 倍高；0x11 倍宽倍高
  size(n) {
    this.buffer.push(0x1b, 0x21, n);
    return this;
  }

  // ESC - n - 下划线
  underline(on) {
    this.buffer.push(0x1b, 0x2d, on ? 0x01 : 0x00);
    return this;
  }

  // ESC d n - 走纸 n 行
  feed(n) {
    this.buffer.push(0x1b, 0x64, n);
    return this;
  }

  // GS V m - 切纸（m=1 半切）
  cut() {
    this.buffer.push(0x1d, 0x56, 0x01);
    return this;
  }

  // 写入 UTF-16 字符串（自动 GBK 编码）
  text(str) {
    if (str == null) return this;
    const bytes = gbkEncode(String(str));
    for (let i = 0; i < bytes.length; i++) this.buffer.push(bytes[i]);
    return this;
  }

  // 写入一行（末尾自动换行 0x0A）
  line(str = '') {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  // 空行
  blank(n = 1) {
    for (let i = 0; i < n; i++) this.buffer.push(0x0a);
    return this;
  }

  // 分割线
  divider(char = '-') {
    return this.line(char.repeat(LINE_WIDTH_NORMAL));
  }

  // 按列打印一行表格：cols = [{ text, width, align }]
  // width 为该列占用的半角字符宽度（汉字占 2）；align: 'left'(默认)/'right'
  // 内容超出列宽自动截断，保证各列对齐
  columns(cols) {
    for (const c of cols) {
      const w = c.width || 0;
      const txt = String(c.text == null ? '' : c.text);
      const parts = [];
      let used = 0;
      for (const ch of txt) {
        const b = gbkEncode(ch);
        if (used + b.length > w) break;
        parts.push(b);
        used += b.length;
      }
      const pad = Math.max(0, w - used);
      const pushSpaces = (n) => {
        for (let i = 0; i < n; i++) this.buffer.push(0x20);
      };
      if (c.align === 'right') pushSpaces(pad);
      for (const b of parts) for (let i = 0; i < b.length; i++) this.buffer.push(b[i]);
      if (c.align !== 'right') pushSpaces(pad);
    }
    this.buffer.push(0x0a);
    return this;
  }

  // 行内右对齐：字符串靠行尾（用于左半段与右半段样式不同的场景）
  twoColumnRight(right, lineWidth = LINE_WIDTH_NORMAL * 2) {
    const rightBytes = gbkEncode(right);
    const spaceCount = Math.max(0, lineWidth - rightBytes.length);
    for (let i = 0; i < spaceCount; i++) this.buffer.push(0x20);
    for (let i = 0; i < rightBytes.length; i++) this.buffer.push(rightBytes[i]);
    this.buffer.push(0x0a);
    return this;
  }

  // 双列对齐：左 + 空格 + 右
  // left/right 为字符串；lineWidth 为 GBK 字节宽度（每个汉字占 2 字节）
  twoColumn(left, right, lineWidth = LINE_WIDTH_NORMAL * 2) {
    const leftBytes = gbkEncode(left);
    const rightBytes = gbkEncode(right);
    const spaceCount = Math.max(1, lineWidth - leftBytes.length - rightBytes.length);
    for (let i = 0; i < leftBytes.length; i++) this.buffer.push(leftBytes[i]);
    for (let i = 0; i < spaceCount; i++) this.buffer.push(0x20);
    for (let i = 0; i < rightBytes.length; i++) this.buffer.push(rightBytes[i]);
    this.buffer.push(0x0a);
    return this;
  }

  // 输出最终字节数组
  toBytes() {
    return new Uint8Array(this.buffer);
  }

  // 字节长度
  get length() {
    return this.buffer.length;
  }
}

module.exports = { EscPosBuilder, LINE_WIDTH_NORMAL, LINE_WIDTH_LARGE };
