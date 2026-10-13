// utils/theme.js —— 设计变量（Design Tokens）单一来源（JS 侧）
// 与 app.wxss 中的 CSS 变量、web/style.css 的 :root 保持一致。
// 需要 JS 读取颜色时（如 canvas 绘制、图表、动态样式）统一从这里取。

const TOKENS = {
  // 中性
  bgApp: '#F4F5F7',
  bgCard: '#FFFFFF',
  bgSubtle: '#F0F1F4',
  border: '#E6E8EC',
  borderStrong: '#D3D7DE',
  divider: '#ECEEF1',

  // 文字
  text1: '#14161A',
  text2: '#5B616E',
  text3: '#9AA0AC',
  textPlaceholder: '#B9BFC9',

  // 品牌主色（时尚红）
  primary: '#E1483C',
  primaryDark: '#C5362C',
  primaryTint: '#FDECEA',

  // 语义
  success: '#16A34A',
  successTint: '#E7F6EC',
  warning: '#B45309',
  warningTint: '#FEF3E2',
  danger: '#DC2626',
  dangerTint: '#FDECEA',
  info: '#2563EB',
  infoTint: '#E6EFFF'
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
