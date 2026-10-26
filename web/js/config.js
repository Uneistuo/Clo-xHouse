/**
 * 全局配置：后端地址、订单状态字典、侧边导航
 */
/* eslint-env browser */

export const BASE_URL = 'https://express-3how-324239-10-1501349049.sh.run.tcloudbase.com';

export const STATUS = { pending: '待收款', paid: '已收款', done: '待售后', cancelled: '已取消', refunded: '已售后' };
export const STATUS_CLASS = {
  pending: 'pending',
  paid: 'paid',
  done: 'done',
  cancelled: 'cancelled',
  refunded: 'refunded'
};

export const NAV_ITEMS = [
  { hash: '#/dashboard', icon: 'icon-home', label: '首页', group: '工作台' },
  { hash: '#/goods', icon: 'icon-shirt', label: '商品', group: '经营' },
  { hash: '#/billing', icon: 'icon-receipt', label: '开单', group: '经营' },
  { hash: '#/orders', icon: 'icon-package', label: '订单', group: '经营' },
  { hash: '#/customers', icon: 'icon-clipboard', label: '会员', group: '客户' },
  { hash: '#/store', icon: 'icon-store', label: '店铺', group: '系统' },
  { hash: '#/platform', icon: 'icon-shield', label: '平台', platformOnly: true, group: '系统' }
];
