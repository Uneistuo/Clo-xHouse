/**
 * 全局键盘快捷键
 * · Ctrl / Cmd + K：聚焦当前页搜索框
 * · S：聚焦搜索框（列表页）
 * · N：新增商品（商品页）
 * · Alt + 1~7：快速切换左侧导航
 * · ?：快捷键帮助
 * · Esc：关闭弹窗
 */
/* eslint-env browser */

import { $ } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { NAV_ITEMS } from './config.js';
import { admin } from './store.js';

const SEARCH_SELECTOR = '#g-keyword, #o-keyword, #c-keyword';

function isTyping(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function currentSearch() {
  const input = $(SEARCH_SELECTOR);
  if (input) input.focus();
  return !!input;
}

function openShortcutHelp() {
  const rows = [
    ['Ctrl / Cmd + K', '聚焦搜索框'],
    ['S', '聚焦搜索框'],
    ['N', '新增商品（商品页）'],
    ['Alt + 1 ~ 7', '切换左侧导航'],
    ['?', '打开本帮助'],
    ['Esc', '关闭弹窗']
  ];
  openModal(`
    <h3>键盘快捷键</h3>
    <table class="shortcut-table"><tbody>
      ${rows
        .map(([key, desc]) => `<tr><td class="t-right"><kbd>${key}</kbd></td><td class="muted">${desc}</td></tr>`)
        .join('')}
    </tbody></table>
    <div class="modal-actions"><button class="btn" id="modal-cancel" type="button">知道了</button></div>`);
  $('#modal-cancel').addEventListener('click', closeModal);
}

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const typing = isTyping(document.activeElement);

    // 全局搜索
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!currentSearch()) toast('当前页面没有搜索框');
      return;
    }

    // 快捷键帮助（避免与输入冲突）
    if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openShortcutHelp();
      return;
    }

    // Alt + 数字：跳转导航
    if (e.altKey && /^[1-9]$/.test(e.key) && !typing) {
      const items = NAV_ITEMS.filter((n) => !n.platformOnly || (admin && admin.isPlatform));
      const target = items[Number(e.key) - 1];
      if (target) {
        e.preventDefault();
        location.hash = target.hash;
      }
      return;
    }

    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    // S：聚焦搜索
    if (e.key === 's' || e.key === 'S') {
      if (currentSearch()) e.preventDefault();
      return;
    }

    // N：新增商品
    if ((e.key === 'n' || e.key === 'N') && location.hash === '#/goods') {
      const btn = $('#btn-add');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });
}
