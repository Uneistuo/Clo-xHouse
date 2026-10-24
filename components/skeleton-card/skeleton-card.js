// components/skeleton-card/skeleton-card.js
// 通用骨架屏（加载占位）：统一各页面的占位样式，避免每页各写一套
// 用法：<skeleton-card rows="{{3}}" heights="28,24,24" widths="50%,80%,35%" gap="{{24}}" />
//   - heights / widths：逗号分隔（rpx / 百分比），留空则按默认比例生成
//   - avatar：是否显示左侧缩略块（列表类页面用）
// 说明：使用 virtualHost，组件不产生额外节点，可直接作为 flex 子项参与父容器布局
Component({
  options: {
    virtualHost: true
  },

  properties: {
    rows: { type: Number, value: 3 }, // 占位行数（1~8）
    heights: { type: String, value: '' }, // 各行高度（rpx，逗号分隔）
    widths: { type: String, value: '' }, // 各行宽度（%, 逗号分隔）
    avatar: { type: Boolean, value: false }, // 是否显示左侧缩略块
    avatarSize: { type: Number, value: 160 }, // 缩略块边长（rpx）
    gap: { type: Number, value: 20 }, // 行间距（rpx）
    radius: { type: Number, value: 12 } // 圆角（rpx）
  },

  data: {
    lines: []
  },

  observers: {
    'rows, heights, widths, gap': function (rows, heights, widths, gap) {
      const n = Math.max(1, Math.min(8, parseInt(rows, 10) || 3));
      const hs = String(heights || '')
        .split(',')
        .map((s) => parseFloat(s));
      const ws = String(widths || '')
        .split(',')
        .map((s) => (s || '').trim());
      const lines = [];
      for (let i = 0; i < n; i++) {
        lines.push({
          h: hs[i] > 0 ? hs[i] : i === 0 ? 28 : 24,
          w: ws[i] || (i === 0 ? '55%' : i === n - 1 ? '60%' : '85%'),
          mt: i === 0 ? 0 : gap
        });
      }
      this.setData({ lines });
    }
  }
});
