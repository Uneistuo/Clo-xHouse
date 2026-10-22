// custom-tab-bar/index.js —— 自定义底部导航（中间凸起"开单"）
// 各 tab 页在 onShow 中调用 this.getTabBar().setData({ selected: n }) 同步高亮
Component({
  data: {
    selected: 0,
    billingDock: false, // 开单页结算栏可见时，TabBar 与结算栏拼接
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'icon-home' },
      { pagePath: '/pages/goods/goods', text: '商品', icon: 'icon-shirt' },
      { pagePath: '/pages/billing/billing', text: '开单', icon: 'icon-receipt', middle: true },
      { pagePath: '/pages/orders/orders', text: '订单', icon: 'icon-package' },
      { pagePath: '/pages/store/store', text: '我的', icon: 'icon-store' }
    ]
  },
  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
