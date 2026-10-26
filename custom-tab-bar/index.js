// custom-tab-bar/index.js —— 自定义底部导航（中间凸起"开单"）
// 各 tab 页在 onShow 中调用 this.getTabBar().applyBarState({ selected, dock }) 同步高亮与拼接态；
// 拼接态与普通态之间的切换动画由 switch.js 的状态机判定（a/b/c/d）。
const { MODE, toState, plan, remember, recall } = require('./switch');

// 动画最长 280ms（见 index.wxss），清理类名留一点排版余量
const SWITCH_CLEAR_MS = 420;

Component({
  data: {
    selected: 0,
    dock: false, // 页面底部栏与 TabBar 拼接（开单结算栏 / 商品批量栏）
    animated: false, // 首帧同步 dock 时不播放形变，避免进入页面瞬间"自己动一下"
    switching: '', // 跨页切换动画：a / b / c / d
    middle: '', // 中间键形变：flatten / raise
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'icon-home' },
      { pagePath: '/pages/goods/goods', text: '商品', icon: 'icon-shirt' },
      { pagePath: '/pages/billing/billing', text: '开单', icon: 'icon-receipt', middle: true },
      { pagePath: '/pages/orders/orders', text: '订单', icon: 'icon-package' },
      { pagePath: '/pages/store/store', text: '我的', icon: 'icon-store' }
    ]
  },
  lifetimes: {
    attached() {
      // TabBar 组件实例随页面创建，初始 data 永远是 selected:0 / dock:false。
      // 如果等到页面 onShow 再纠正，就会先渲染成「高亮 + 凸起圆钮」再跳成拼形态，
      // 形成一次可见的跳动。这里在首帧渲染前直接从当前页面状态推导。
      //
      // onShow / attached 的先后顺序并不由我们决定：
      //   · onShow 先跑 → applyBarState 已经算过并落地，这里不能再算一次（会覆盖动画）
      //   · attached 先跑 → 由这里算，结果挂到 _pending 上等 onShow 取走
      if (this._landed) return;
      const next = this._deriveState();
      if (!next) return;
      const prev = recall();
      remember(next);
      // 从上一页的状态过渡到本页：动画类直接进首帧，不会先闪一下再播
      this._pending = Object.assign(this._transition(prev, next, true), { state: next });
    },
    ready() {
      // 本实例已经画出第一帧：之后再同步状态时，DOM 里留的是「上一次的外观」
      this._hasRendered = true;
      // 首帧的 dock 已由 attached 落地，先静默一帧再开启过渡
      this._animTimer = setTimeout(() => this.setData({ animated: true }), 60);
    },
    detached() {
      clearTimeout(this._animTimer);
      clearTimeout(this._switchTimer);
    }
  },
  methods: {
    /**
     * 页面 onShow 时同步底部栏状态（唯一入口）。
     * @param {{ selected: number, dock?: boolean }} state dock 省略时沿用当前值
     * @returns {{ switching: string, middle: string, changed: boolean }}
     *   本次转移的动画编号；页面据此决定自己那块拼接面板要不要跟着动（如 switching === 'c'）
     */
    applyBarState(state) {
      const next = toState(state.selected, state.dock === undefined ? this.data.dock : state.dock);
      // attached 已经为首帧算过一次：同一状态就把结果交给页面，绝不重复播动画
      if (this._pending) {
        const pending = this._pending;
        this._pending = null;
        if (pending.state.tab === next.tab && pending.state.mode === next.mode) {
          return { switching: pending.switching, middle: pending.middle, changed: pending.changed };
        }
      }
      const prev = recall();
      remember(next);
      // 同一页重复 onShow（状态没变）由 _transition 直接拦下：不下发 setData，
      // 固定定位的栏重绘会让页面抖一帧
      return this._transition(prev, next);
    },

    /** 从当前页面 data 推导状态（首帧用，此时页面还没机会调用 applyBarState） */
    _deriveState() {
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      if (!page || !page.route) return null;
      const index = this.data.list.findIndex((it) => it.pagePath === '/' + page.route);
      if (index < 0) return null;
      return this._readState(index, page.data);
    },

    /** 从页面 data 推导状态（index + page.data） */
    _readState(index, pageData = {}) {
      // 开单页看 restricted（结算栏是否可见），商品页看 manageMode（批量栏是否可见）
      const dock = !!(pageData.manageMode || (this.data.list[index].middle && !pageData.restricted));
      return toState(index, dock);
    },

    /**
     * 落状态 + 按转移表播动画。
     * @param {boolean} force 冷启动首帧：即使 plan 判定「没变化」也要落地初始高亮/拼接态
     * @returns {{ switching: string, middle: string, changed: boolean }} 本次转移的动画编号
     */
    _transition(prev, next, force = false) {
      const info = plan(prev, next);
      const { switching, middle, changed } = info;
      // 走到这里说明状态已经算过：attached 之后不必再重算
      this._landed = true;
      if (!changed && !force) return info;
      // Tab 页会被缓存复用，复用页的 DOM 停在上一次显示的样式上。
      // 如果本实例当前画出来的外观已经就是目标态（开单页来回切时必然如此），
      // 再挂一次 a/b/c/d 只会先把元素拽回「起手态」再播一遍，
      // 看到的就是「先闪一下原样，再动一次」——所谓弹两下。
      // 没有可形变的余地就别下发类名；页面仍可按返回值播自己的入场动画。
      if (this._hasRendered && this.data.selected === next.tab && this.data.dock === (next.mode === MODE.DOCK)) {
        return info;
      }
      const patch = {
        selected: next.tab,
        dock: next.mode === MODE.DOCK,
        switching,
        middle
      };
      // 同一个动画类还在场上（未被清理）时 CSS 不会重播：先摘一帧再加回去
      if (switching && switching === this.data.switching) {
        this.setData({ switching: '' });
        wx.nextTick(() => this.setData(patch));
      } else {
        this.setData(patch);
      }
      this._scheduleClear(switching, middle);
      return info;
    },

    /** 动画播完清掉类名，避免后续重渲染时重播同一段 */
    _scheduleClear(switching, middle) {
      // 没有动画可播：保留上一次的清理任务（它会把旧类名清掉），不要打断
      if (!switching && !middle) return;
      clearTimeout(this._switchTimer);
      const gen = (this._switchGen = (this._switchGen || 0) + 1);
      this._switchTimer = setTimeout(() => {
        if (gen !== this._switchGen) return; // 期间又发生了新的转移
        this.setData({ switching: '', middle: '' });
      }, SWITCH_CLEAR_MS);
    },

    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
