// utils/receipt.js - 销售小票内容生成器
// 根据订单、商品明细、店铺与收银员信息，生成 ESC/POS 小票字节流
// 数据来源：订单详情（order + items）+ 店铺信息（store）+ 当前登录账号（admin）
//
// 版式参考门店"销售单"：标题 -> 单据信息 -> 商品明细 -> 合计 -> 收款/打印时间 -> 条款 -> 致谢

const { EscPosBuilder, LINE_WIDTH_NORMAL } = require('./escpos');

// 收款方式中文映射
const PAY_METHOD_TEXT = {
  offline: '线下收款',
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
  other: '其他'
};

// 底部条款说明（每行不超过 32 个半角列宽，避免折行错乱）
const TERMS = [
  '温馨提示：',
  '1、商品有质量问题，未洗未穿、吊牌完好，',
  '七天内凭此单可更换同等价格商品；',
  '2、特价商品不予退换。'
];

// 商品明细：每项商品分两行（twoColumn 左右对齐，无需固定列宽表）
//   第一行：商品（货号+名称，左）+ 单价（右）
//   第二行：颜色尺码*数量（左）+ 小计（右）

/** 数字自适应列宽：整数直接显示；超宽时逐级减少小数位，最后退为整数 */
function fitNum(n, maxW) {
  const num = Number(n) || 0;
  if (Number.isInteger(num) && String(num).length <= maxW) return String(num);
  if (num.toFixed(2).length <= maxW) return num.toFixed(2);
  if (num.toFixed(1).length <= maxW) return num.toFixed(1);
  return String(Math.round(num));
}

/** 当前时间字符串 YYYY-MM-DD HH:mm:ss */
function nowText() {
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * 生成销售小票字节流
 * @param {Object} opts
 * @param {Object} opts.store 店铺信息 { name }
 * @param {Object} opts.admin 当前登录账号 { username }（作为销售员）
 * @param {Object} opts.order 订单 { orderNo, created_at, totalAmount, customerPhone?, remark?, payMethod? }
 * @param {Array}  opts.items 订单商品 [{ goodsNo, name, color, size, price, quantity }]
 * @returns {Uint8Array}
 */
function buildReceipt({ store, admin, order, items }) {
  const b = new EscPosBuilder();
  const lineWidth = LINE_WIDTH_NORMAL * 2;      // 正常字号行宽（GBK 字节数）
  const dwLineWidth = Math.floor(lineWidth / 2); // 倍宽字号行宽（占两倍宽度，列数减半）

  b.init();
  // 标题：店名（大字加粗居中）+ 销售单
  b.size(0x11).bold(true).align(1).line((store && store.name) || '服装店');
  b.size(0x00).bold(false).align(1).line('销 售 单');
  b.blank(1);

  // 单据信息
  if (order.orderNo) b.twoColumn('单号', order.orderNo, lineWidth);
  const bizTime = (order.created_at || nowText()).slice(0, 19).replace('T', ' ');
  b.twoColumn('业务日期', bizTime, lineWidth);
  b.twoColumn('客户', order.customerPhone || '零售', lineWidth);
  if (admin && admin.username) b.twoColumn('销售员', admin.username, lineWidth);
  // 付款状态：两个空选框，由店员在小票上手工勾选
  b.twoColumn('付款状态', '□待付款  □已付款', lineWidth);

  // 商品明细（每项商品分两行：商品+单价 / 颜色尺码*数量+小计）
  b.divider();
  b.align(0).line('商品明细');
  b.divider('-');

  let totalQty = 0;
  for (const it of items || []) {
    totalQty += Number(it.quantity || 0);
    const spec = [it.color, it.size].filter(Boolean).join('/') || '-';
    const price = Number(it.price || 0);
    const qty = Number(it.quantity || 0);
    // 第一行：商品（货号+名称，加粗） + 单价（不加粗）
    const name = it.goodsNo ? `${it.goodsNo}${it.name || ''}` : (it.name || '');
    b.bold(true).text(name).bold(false);
    b.twoColumnRight(`单价￥${fitNum(price, 10)}`, lineWidth);
    // 第二行：颜色尺码*数量 + 小计
    b.twoColumn(`${spec}*${qty}`, `小计￥${fitNum(price * qty, 10)}`, lineWidth);
  }
  b.divider('-');

  // 合计
  b.divider();
  b.twoColumn('合计件数', `${totalQty} 件`, lineWidth);
  const total = Number(order.totalAmount || 0).toFixed(2);
  b.size(0x10).bold(true).twoColumn('合计金额', `￥${total}`, dwLineWidth);
  b.size(0x00).bold(false);

  // 收款方式 / 打印时间 / 备注
  b.divider('-');
  b.twoColumn('收款方式', PAY_METHOD_TEXT[order.payMethod] || order.payMethod || '线下收款', lineWidth);
  b.twoColumn('打印时间', nowText(), lineWidth);
  if (order.remark) b.twoColumn('备注', order.remark, lineWidth);

  // 底部条款（左对齐）
  b.blank(1);
  b.align(0);
  for (const t of TERMS) b.line(t);

  // 致谢
  b.blank(1);
  b.align(1).line('感谢惠顾，欢迎再次光临');
  b.feed(3);
  b.cut();

  return b.toBytes();
}

/**
 * 生成测试小票字节流（用于配对时测试打印）
 */
function buildTestReceipt() {
  const b = new EscPosBuilder();
  b.init();
  b.size(0x11).bold(true).align(1).line('测试打印');
  b.size(0x00).bold(false);
  b.blank(1);
  b.align(1).line('打印机连接成功');
  b.blank(1);
  b.align(1).line('佳博 PT261 蓝牙小票机');
  b.blank(1);
  b.align(1).line(nowText());
  b.feed(3);
  b.cut();
  return b.toBytes();
}

module.exports = {
  buildReceipt,
  buildTestReceipt
};
