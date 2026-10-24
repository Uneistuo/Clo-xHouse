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

/** 订单状态 -> 标签样式类名（与 Web 端 badge 语义保持一致） */
export const STATUS_CLASS: Record<string, string> = {
  pending: 'tag-orange',
  paid: 'tag-green',
  done: 'tag-blue',
  cancelled: 'tag-gray',
  refunded: 'tag-red'
};

/** 收款方式文案 */
export const PAY_METHOD_TEXT: Record<string, string> = { offline: '线下收款' };

/** 会员等级（按累计消费金额派生，前端统一口径） */
export interface MemberLevel {
  key: string;
  name: string;
  cls: string;
}

export const MEMBER_LEVELS: MemberLevel[] = [
  { key: 'diamond', name: '钻石会员', cls: 'level-diamond' },
  { key: 'gold', name: '金卡会员', cls: 'level-gold' },
  { key: 'silver', name: '银卡会员', cls: 'level-silver' },
  { key: 'normal', name: '普通会员', cls: 'level-normal' }
];

/** 累计金额 -> 会员等级（阈值：1000 / 3000 / 8000） */
export function getMemberLevel(totalAmount: number | string): MemberLevel {
  const n = Number(totalAmount) || 0;
  if (n >= 8000) return MEMBER_LEVELS[0];
  if (n >= 3000) return MEMBER_LEVELS[1];
  if (n >= 1000) return MEMBER_LEVELS[2];
  return MEMBER_LEVELS[3];
}

/** 距下次生日的天数（含今天；生日为空/非法返回 -1） */
export function daysToBirthday(birthday: string | null | undefined): number {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return -1;
  const m = Number(birthday.slice(5, 7));
  const d = Number(birthday.slice(8, 10));
  if (!m || !d) return -1;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), m - 1, d);
  if (target < today) target = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** 生日展示：YYYY-MM-DD -> MM-DD（非法输入原样返回） */
export function fmtBirthday(birthday: string | null | undefined): string {
  if (!birthday) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday.slice(5) : birthday;
}
