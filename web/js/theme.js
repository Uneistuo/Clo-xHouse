/**
 * 主题与侧边栏偏好：深色模式、折叠态、跨标签页同步
 */
/* eslint-env browser */

import { $, $$ } from './utils.js';

/* ================= 主题与侧边栏偏好 ================= */
const THEME_KEY = 'cj-theme';
const SIDEBAR_KEY = 'cj-sidebar-collapsed';

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {
    /* 隐私模式下 localStorage 可能不可用 */
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeButtons() {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const label = theme === 'dark' ? '切换为浅色模式' : '切换为深色模式';
  $$('[data-theme-toggle]').forEach((btn) => {
    btn.innerHTML = `<span class="icon icon-${theme === 'dark' ? 'sun' : 'moon'}"></span>`;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  });
  const meta = $('#meta-theme-color');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#121722' : '#F3F5FA');
}

function applyTheme(theme, persist) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* 忽略存储失败 */
    }
  }
  syncThemeButtons();
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function applySidebarCollapsed(collapsed) {
  const layout = $('.layout');
  if (layout) layout.classList.toggle('sidebar-collapsed', !!collapsed);
  const btn = $('#btn-sidebar-toggle');
  if (btn) {
    const label = collapsed ? '展开侧边栏' : '收起侧边栏';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }
}

function toggleSidebar() {
  const layout = $('.layout');
  if (!layout) return;
  const collapsed = !layout.classList.contains('sidebar-collapsed');
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch (e) {
    /* 忽略存储失败 */
  }
  applySidebarCollapsed(collapsed);
}

function initSystemThemeListener() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = (e) => {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (err) {
      /* ignore */
    }
    if (saved !== 'dark' && saved !== 'light') applyTheme(e.matches ? 'dark' : 'light', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
  else if (mq.addListener) mq.addListener(onSchemeChange);
}

function initGlobalControls() {
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : e.target && e.target.parentElement;
    if (!el) return;
    if (el.closest('[data-theme-toggle]')) {
      toggleTheme();
      return;
    }
    if (el.closest('#btn-sidebar-toggle')) toggleSidebar();
  });

  // 多标签页同步：其他标签页切换主题 / 折叠态时跟随
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) applyTheme(e.newValue, false);
    if (e.key === SIDEBAR_KEY) applySidebarCollapsed(e.newValue === '1');
  });
}

/** 启动主题：应用已保存 / 系统偏好，并挂载全局交互 */
export function initTheme() {
  applyTheme(readTheme(), false);
  initSystemThemeListener();
  initGlobalControls();
}

export { THEME_KEY, SIDEBAR_KEY, readTheme, syncThemeButtons, applyTheme, toggleTheme };
export { readSidebarCollapsed, applySidebarCollapsed, toggleSidebar };
