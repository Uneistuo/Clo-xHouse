// utils/theme.js —— 设计变量（Design Tokens）单一来源（JS 侧）
// 与 app.wxss 中的 CSS 变量、web/style.css 的 :root 保持一致。
// 需要 JS 读取颜色时（如 canvas 绘制、图表、动态样式）统一从这里取。

const TOKENS = {
  // 基底
  bgApp: '#F3F5FA',
  bgCard: 'rgba(255,255,255,0.68)',
  bgCardStrong: 'rgba(255,255,255,0.86)',
  bgSubtle: 'rgba(255,255,255,0.46)',
  bgOverlay: 'rgba(255,255,255,0.82)',

  // 描边
  glassBorder: 'rgba(255,255,255,0.72)',
  hairline: 'rgba(29,34,43,0.06)',
  border: 'rgba(29,34,43,0.08)',
  borderStrong: 'rgba(29,34,43,0.16)',
  divider: 'rgba(29,34,43,0.06)',

  // 文字
  text1: '#1D222B',
  text2: '#5A6270',
  text3: '#97A0AE',
  textPlaceholder: '#B6BDC9',

  // 品牌主色（蓝紫）
  primary: '#7B8CF7',
  primaryDark: '#6675E8',
  primaryTint: 'rgba(123,140,247,0.12)',

  // 点缀（暖橙）
  warm: '#F2A57C',
  warmTint: 'rgba(242,165,124,0.16)',

  // 语义
  success: '#3BAE76',
  successTint: 'rgba(59,174,118,0.12)',
  warning: '#D69A3C',
  warningTint: 'rgba(214,154,60,0.12)',
  danger: '#E05D57',
  dangerTint: 'rgba(224,93,87,0.12)',
  info: '#4C8FE8',
  infoTint: 'rgba(76,143,232,0.12)'
};

/** 订单状态 -> 语义色（与徽标一致） */
const STATUS_COLOR = {
  pending: TOKENS.warning,
  paid: TOKENS.success,
  done: TOKENS.info,
  cancelled: TOKENS.text3,
  refunded: TOKENS.danger
};

module.exports = { TOKENS, STATUS_COLOR };
