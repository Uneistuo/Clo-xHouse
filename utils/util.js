// utils/util.js 通用工具函数

/**
 * 金额格式化：保留两位小数
 */
function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toFixed(2);
}

/**
 * 图片地址解析：数据库存相对路径 /uploads/xxx 时拼接后端地址；
 * 若是完整 http(s) 地址则原样返回；空值返回空串
 */
function resolveImg(path, BASE_URL) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return (BASE_URL || '') + path;
}

/** 订单状态 -> 中文文案 */
const STATUS_TEXT = {
  pending: '待收款',
  paid: '已收款',
  done: '待售后',
  cancelled: '已取消',
  refunded: '已售后'
};

/** 订单状态 -> 标签样式类名 */
const STATUS_CLASS = {
  pending: 'tag-orange',
  paid: 'tag-blue',
  done: 'tag-green',
  cancelled: 'tag-gray',
  refunded: 'tag-red'
};

/** 收款方式文案 */
const PAY_METHOD_TEXT = { offline: '线下收款' };

module.exports = { fmtMoney, resolveImg, STATUS_TEXT, STATUS_CLASS, PAY_METHOD_TEXT };
