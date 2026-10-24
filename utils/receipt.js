// utils/receipt.js - 销售小票内容生成器
// 根据订单、商品明细、店铺与收银员信息，生成 ESC/POS 小票字节流
// 数据来源：订单详情（order + items）+ 店铺信息（store）+ 当前登录账号（admin）
//
// 支持三种打印模板（print-service 读取本地设置后传入）：
//   classic  经典：完整单据信息 + 双行商品明细 + 条款（默认，与历史版式一致）
//   simple   简约：仅商品与合计，出票快、耗纸少
//   detailed 详细：商品小计/单价分行 + 均价统计，便于对账
// 支持 58mm / 80mm 两种纸张宽度（行宽随纸张自适应）
//
// 版式参考门店"销售单"：标题 -> 单据信息 -> 商品明细 -> 合计 -> 收款/打印时间 -> 条款 -> 致谢

const { EscPosBuilder } = require('./escpos');

// 收款方式中文映射
const PAY_METHOD_TEXT = {
  offline: '线下收款',
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
  other: '其他'
};

// 可选模板（配对页设置项展示用）
const TEMPLATES = [
  { key: 'classic', name: '经典模板', desc: '信息完整，含条款' },
  { key: 'simple', name: '简约模板', desc: '仅商品与金额，出票快' },
  { key: 'detailed', name: '详细模板', desc: '含单价明细与均价' }
];

// 可选纸张宽度（配对页设置项展示用）
const PAPER_WIDTHS = [
  { value: 58, name: '58mm', desc: '常规小票机' },
  { value: 80, name: '80mm', desc: '宽幅小票机' }
];

// 底部条款说明（每行不超过 32 个半角列宽，避免折行错乱）
const TERMS = [
  '温馨提示：',
  '1、商品有质量问题，未洗未穿、吊牌完好，',
  '七天内凭此单可更换同等价格商品；',
  '2、特价商品不予退换。'
];

// 商品明细：每项商品分两行（twoColumn 左右对齐，无需固定列宽表）

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
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/**
 * 生成销售小票字节流
 * @param {Object} opts
 * @param {Object} opts.store 店铺信息 { name }
 * @param {Object} opts.admin 当前登录账号 { username }（作为销售员）
 * @param {Object} opts.order 订单 { orderNo, created_at, totalAmount, customerPhone?, remark?, payMethod? }
 * @param {Array}  opts.items 订单商品 [{ goodsNo, name, color, size, price, quantity }]
 * @param {string} [opts.template] 模板：classic / simple / detailed
 * @param {number} [opts.paperWidth] 纸张宽度：58 / 80
 * @returns {Uint8Array}
 */
function buildReceipt({ store, admin, order, items, template = 'classic', paperWidth = 58 }) {
  const b = new EscPosBuilder();
  const wide = Number(paperWidth) === 80;
  const lineWidth = wide ? 96 : 64; // 正常字号行宽（GBK 字节数）
  const dwLineWidth = Math.floor(lineWidth / 2); // 倍宽字号行宽（占两倍宽度，列数减半）
  const dividerCount = wide ? 48 : 32; // 分割线字符数
  const divider = (char = '-') => b.line(char.repeat(dividerCount));
  const storeName = (store && store.name) || '服装店';
  const list = items || [];
  const bizTime = (order.created_at || nowText()).slice(0, 19).replace('T', ' ');
  const total = Number(order.totalAmount || 0).toFixed(2);
  let totalQty = 0;
  for (const it of list) totalQty += Number(it.quantity || 0);

  // 标题：店名（大字加粗居中）+ 销售单
  b.init();
  b.size(0x11).bold(true).align(1).line(storeName);
  b.size(0x00).bold(false).align(1).line('销 售 单');
  b.blank(1);

  // ============ 简约模板：仅单号/时间 + 单行商品 + 合计 ============
  if (template === 'simple') {
    if (order.orderNo) b.twoColumn('单号', order.orderNo, lineWidth);
    b.twoColumn('时间', bizTime, lineWidth);
    divider();
    for (const it of list) {
      const name = it.goodsNo ? `${it.goodsNo}${it.name || ''}` : it.name || '';
      const qty = Number(it.quantity || 0);
      const amount = `￥${fitNum(Number(it.price || 0) * qty, 10)}`;
      b.bold(true).twoColumn(`${name} x${qty}`, amount, lineWidth).bold(false);
    }
    divider();
    b.size(0x10).bold(true).twoColumn('合计金额', `￥${total}`, dwLineWidth);
    b.size(0x00).bold(false);
    b.blank(1);
    b.align(1).line('感谢惠顾，欢迎再次光临');
    b.feed(3);
    b.cut();
    return b.toBytes();
  }

  // ============ 经典 / 详细模板：完整单据信息 ============
  if (order.orderNo) b.twoColumn('单号', order.orderNo, lineWidth);
  b.twoColumn('业务日期', bizTime, lineWidth);
  b.twoColumn('客户', order.customerPhone || '零售', lineWidth);
  if (admin && admin.username) b.twoColumn('销售员', admin.username, lineWidth);
  // 付款状态：两个空选框，由店员在小票上手工勾选（详细模板省略以精简）
  if (template !== 'detailed') b.twoColumn('付款状态', '□待付款  □已付款', lineWidth);

  // 商品明细（经典：商品+单价 / 规格*数量+小计；详细：商品+小计 / 规格×数量+单价）
  divider();
  b.align(0).line('商品明细');
  divider('-');

  for (const it of list) {
    const spec = [it.color, it.size].filter(Boolean).join('/') || '-';
    const price = Number(it.price || 0);
    const qty = Number(it.quantity || 0);
    const name = it.goodsNo ? `${it.goodsNo}${it.name || ''}` : it.name || '';
    if (template === 'detailed') {
      b.bold(true).text(name).bold(false);
      b.twoColumnRight(`小计￥${fitNum(price * qty, 10)}`, lineWidth);
      b.twoColumn(`${spec} × ${qty}`, `单价￥${fitNum(price, 10)}`, lineWidth);
    } else {
      b.bold(true).text(name).bold(false);
      b.twoColumnRight(`单价￥${fitNum(price, 10)}`, lineWidth);
      b.twoColumn(`${spec}*${qty}`, `小计￥${fitNum(price * qty, 10)}`, lineWidth);
    }
  }
  divider('-');

  // 合计
  divider();
  b.twoColumn('合计件数', `${totalQty} 件`, lineWidth);
  if (template === 'detailed' && totalQty > 0) {
    b.twoColumn('平均单价', `￥${fitNum(Number(order.totalAmount || 0) / totalQty, 10)}`, lineWidth);
  }
  b.size(0x10).bold(true).twoColumn('合计金额', `￥${total}`, dwLineWidth);
  b.size(0x00).bold(false);

  // 收款方式 / 打印时间 / 备注
  divider('-');
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
 * @param {Object} [opts] { template, paperWidth } 当前打印设置（可选，仅用于展示）
 */
function buildTestReceipt(opts = {}) {
  const b = new EscPosBuilder();
  b.init();
  b.size(0x11).bold(true).align(1).line('测试打印');
  b.size(0x00).bold(false);
  b.blank(1);
  b.align(1).line('打印机连接成功');
  b.blank(1);
  b.align(1).line('佳博 PT261 蓝牙小票机');
  b.blank(1);
  const tpl = TEMPLATES.find((t) => t.key === opts.template);
  if (tpl) b.align(1).line(`模板：${tpl.name}`);
  b.align(1).line(`纸张：${Number(opts.paperWidth) === 80 ? '80mm' : '58mm'}`);
  b.blank(1);
  b.align(1).line(nowText());
  b.feed(3);
  b.cut();
  return b.toBytes();
}

module.exports = {
  buildReceipt,
  buildTestReceipt,
  TEMPLATES,
  PAPER_WIDTHS
};
