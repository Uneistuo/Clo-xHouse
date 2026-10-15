// utils/dialog.js —— 对话框与提示工具（Promise 化，页面可 await）
// 用法：const { confirm } = require('../../utils/dialog');
//       if (await confirm('确定删除该商品吗？')) { ... }

function confirm({ title = '提示', content, cancelText = '取消', confirmText = '确定' } = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      showCancel: true,
      cancelText,
      confirmText,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    });
  });
}

function alert({ title = '提示', content, showCancel = false, confirmText = '知道了' } = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      showCancel,
      confirmText,
      success: () => resolve(),
      fail: () => resolve()
    });
  });
}

function toast(msg, icon = 'none', duration = 2000) {
  wx.showToast({ title: msg, icon, duration });
}

function loading(title = '加载中') {
  wx.showLoading({ title, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

module.exports = { confirm, alert, toast, loading, hideLoading };
