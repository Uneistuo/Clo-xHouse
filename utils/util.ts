// utils/util.ts 通用工具函数（TypeScript 版，从 util.js 迁移，行为保持一致）

/**
 * 金额格式化：保留两位小数
 */
export function fmtMoney(n: number | string): string {
  const num = Number(n) || 0;
  return num.toFixed(2);
}

/**
 * 图片地址解析：数据库存相对路径 /uploads/xxx 时拼接后端地址；
 * 若是完整 http(s) 地址则原样返回；空值返回空串
 */
export function resolveImg(path: string | null | undefined, baseUrl?: string): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return (baseUrl || '') + path;
}

/** 订单状态 -> 中文文案 */
export const STATUS_TEXT: Record<string, string> = {
  pending: '待收款',
  paid: '已收款',
  done: '待售后',
  cancelled: '已取消',
  refunded: '已售后'
};

/** 订单状态 -> 标签样式类名 */
export const STATUS_CLASS: Record<string, string> = {
  pending: 'tag-orange',
  paid: 'tag-blue',
  done: 'tag-green',
  cancelled: 'tag-gray',
  refunded: 'tag-red'
};

/** 收款方式文案 */
export const PAY_METHOD_TEXT: Record<string, string> = { offline: '线下收款' };
