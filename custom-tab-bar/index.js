// custom-tab-bar/index.js —— 自定义底部导航（中间凸起"开单"）
// 各 tab 页在 onShow 中调用 this.getTabBar().setData({ selected: n }) 同步高亮
Component({
  data: {
    selected: 0,
    dock: false, // 页面底部栏与 TabBar 拼接（开单结算栏 / 商品批量栏）
    animated: false, // 首帧同步 dock 时不播放形变，避免进入页面瞬间"自己动一下"
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
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      if (!page || !page.route) return;
      const index = this.data.list.findIndex((it) => it.pagePath === '/' + page.route);
      if (index < 0) return;
      const pageData = page.data || {};
      // 开单页看 restricted（结算栏是否可见），商品页看 manageMode（批量栏是否可见）
      const dock = !!(pageData.manageMode || (this.data.list[index].middle && !pageData.restricted));
      if (this.data.selected === index && this.data.dock === dock) return;
      this.setData({ selected: index, dock });
    },
    ready() {
      // 首帧的 dock 已由 attached 落地，先静默一帧再开启过渡
      this._animTimer = setTimeout(() => this.setData({ animated: true }), 60);
    },
    detached() {
      clearTimeout(this._animTimer);
    }
  },
  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
