// utils/dialog.ts —— 对话框与提示工具（TypeScript 版，从 dialog.js 迁移，Promise 化，页面可 await）
// 用法：const { confirm } = require('../../utils/dialog');
//       if (await confirm({ content: '确定删除该商品吗？' })) { ... }

export interface ConfirmOptions {
  title?: string;
  content?: string;
  cancelText?: string;
  confirmText?: string;
}

export interface AlertOptions {
  title?: string;
  content?: string;
  showCancel?: boolean;
  confirmText?: string;
}

export function confirm({
  title = '提示',
  content,
  cancelText = '取消',
  confirmText = '确定'
}: ConfirmOptions = {}): Promise<boolean> {
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

export function alert({
  title = '提示',
  content,
  showCancel = false,
  confirmText = '知道了'
}: AlertOptions = {}): Promise<void> {
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

export function toast(msg: string, icon: 'none' | 'success' | 'error' | 'loading' = 'none', duration = 2000): void {
  wx.showToast({ title: msg, icon, duration });
}

export function loading(title = '加载中'): void {
  wx.showLoading({ title, mask: true });
}

export function hideLoading(): void {
  wx.hideLoading();
}
