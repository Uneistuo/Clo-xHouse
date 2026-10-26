// custom-tab-bar/switch.js —— 底部栏「拼接态 / 普通态」切换状态机
//
// 状态 State：{ tab: 0..4, mode: 'dock' | 'normal' }
//   dock   页面底部面板（开单结算栏 / 商品批量栏）与 TabBar 拼成同一块面板
//   normal 悬浮玻璃胶囊，中间「开单」凸起
// 事件 Event：页面 onShow 同步、页内 dock 变化（进入批量管理 / 结算栏消失）
// 转移 Transition：来源 × 去向 查表得动画编号
//
//        to →   dock    normal
//   from ↓
//   dock           a        b
//   normal         c        d
//
//   a 拼接→拼接：栏体与面板连续，不位移，只做高亮过渡
//   b 拼接→普通：从面板脱离（方角收圆）
//   c 普通→拼接：落位贴合（圆角收方）
//   d 普通→普通：没有面板可拼，按键轻微落位
//
// 本文件是纯逻辑（无组件、无 DOM）：custom-tab-bar 每个 tab 页各有一份组件实例，
// 只有把「上一页的状态」记在模块作用域里，下一个页面才知道自己从哪来。

const MODE = { DOCK: 'dock', NORMAL: 'normal' };

/** 动画编号，对应 index.wxss 的 .tabbar-switch-a/b/c/d */
const ANIMATION = { A: 'a', B: 'b', C: 'c', D: 'd' };

/** 转移表：TABLE[from][to] → 动画编号 */
const TABLE = {
  dock: { dock: ANIMATION.A, normal: ANIMATION.B },
  normal: { dock: ANIMATION.C, normal: ANIMATION.D }
};

/** 由页面上报的 { tab, dock } 归一化成状态 */
function toState(tab, dock) {
  return { tab, mode: dock ? MODE.DOCK : MODE.NORMAL };
}

/**
 * 中间「开单」键是否平铺。
 * 与拼接态解耦：开单页即使不拼接，凸起也会被结算栏压住，同样平铺。
 */
function isFlat(state) {
  return !!state && (state.mode === MODE.DOCK || state.tab === 2);
}

/**
 * 计算一次转移的计划。
 * @returns {{ switching: ''|'a'|'b'|'c'|'d', middle: ''|'flatten'|'raise', changed: boolean }}
 *   changed=false：同一页重复 onShow，模式没变，不播动画也不该重绘
 */
function plan(prev, next) {
  // 冷启动 / 缺一侧状态：直接落位
  if (!prev || !next) return { switching: '', middle: '', changed: true };
  if (prev.tab === next.tab && prev.mode === next.mode) {
    return { switching: '', middle: '', changed: false };
  }
  const fromFlat = isFlat(prev);
  const toFlat = isFlat(next);
  return {
    switching: TABLE[prev.mode][next.mode],
    // 中间键形变与栏体动画分开判定：开单页不拼接时也要收平
    middle: fromFlat === toFlat ? '' : toFlat ? 'flatten' : 'raise',
    changed: true
  };
}

let lastState = null;

/** 记录「当前已落地的状态」，供下一个页面读取 */
function remember(state) {
  lastState = state ? { tab: state.tab, mode: state.mode } : null;
}

/** 读取上一页落地的状态 */
function recall() {
  return lastState;
}

module.exports = { MODE, ANIMATION, TABLE, toState, isFlat, plan, remember, recall };
