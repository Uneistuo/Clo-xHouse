/**
 * 裁间 Clo-xHouse · 项目展示页交互
 * 零依赖原生 ES Module：主题、导航、滚动进场、Tabs、复制与回到顶部
 */
/* eslint-env browser */

const root = document.documentElement;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const THEME_KEY = 'cj-site-theme';

/* ================= 主题 ================= */
const themeToggle = document.querySelector('[data-theme-toggle]');
const themeIcon = themeToggle ? themeToggle.querySelector('.icon') : null;
const themeMeta = document.querySelector('meta[name="theme-color"]');

function syncThemeUI(theme) {
  if (themeIcon) {
    themeIcon.className = `icon icon-${theme === 'dark' ? 'sun' : 'moon'}`;
  }
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
  }
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#0b0e16' : '#f6f7fb');
  }
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  syncThemeUI(theme);
}

function initTheme() {
  const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  syncThemeUI(current);

  if (!themeToggle) return;

  themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* 隐私模式下忽略持久化失败 */
    }
  });
}

/* ================= 顶部导航 ================= */
const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const navLinks = document.getElementById('site-nav');
const navAnchors = navLinks ? Array.from(navLinks.querySelectorAll('a')) : [];

function closeMenu() {
  if (!navLinks || !menuToggle) return;
  navLinks.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '打开菜单');
}

function toggleMenu() {
  if (!navLinks || !menuToggle) return;
  const open = navLinks.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
}

function initNav() {
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMenu);
  }

  navAnchors.forEach((anchor) => anchor.addEventListener('click', closeMenu));

  document.addEventListener('click', (event) => {
    if (!navLinks || !menuToggle) return;
    if (!navLinks.classList.contains('is-open')) return;
    if (navLinks.contains(event.target) || menuToggle.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMenu();
  });

  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ================= 当前区块高亮 ================= */
function initActiveSection() {
  if (!('IntersectionObserver' in window) || !navAnchors.length) return;

  const linkMap = new Map();
  navAnchors.forEach((anchor) => {
    const id = anchor.getAttribute('href');
    if (id && id.startsWith('#')) linkMap.set(id.slice(1), anchor);
  });

  const sections = Array.from(document.querySelectorAll('main section[id]')).filter((section) =>
    linkMap.has(section.id)
  );
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navAnchors.forEach((anchor) => anchor.classList.remove('is-active'));
        const active = linkMap.get(entry.target.id);
        if (active) active.classList.add('is-active');
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* ================= 滚动进场 ================= */
function initReveal() {
  const items = Array.from(document.querySelectorAll('.reveal'));
  if (!items.length) return;

  document.querySelectorAll('[data-stagger]').forEach((group) => {
    Array.from(group.querySelectorAll('.reveal')).forEach((item, index) => {
      item.style.setProperty('--reveal-delay', `${Math.min(index * 70, 350)}ms`);
    });
  });

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
  );

  items.forEach((item) => observer.observe(item));
}

/* ================= Tabs ================= */
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((tabs) => {
    const buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const panels = Array.from(tabs.querySelectorAll('[role="tabpanel"]'));
    if (!buttons.length || !panels.length) return;

    const activate = (button, focus = false) => {
      const panelId = button.getAttribute('aria-controls');

      buttons.forEach((item) => {
        const selected = item === button;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });

      panels.forEach((panel) => {
        const selected = panel.id === panelId;
        panel.classList.toggle('is-active', selected);
        panel.hidden = !selected;
      });

      if (focus) button.focus();
    };

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => activate(button));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;

        activate(buttons[next], true);
      });
    });

    const initial = buttons.find((button) => button.getAttribute('aria-selected') === 'true') || buttons[0];
    activate(initial);
  });
}

/* ================= 复制代码 ================= */
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (error) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('.code-card');
      const code = card ? card.querySelector('code') : null;
      if (!code) return;

      const text = code.innerText;
      let copied = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (error) {
          copied = false;
        }
      }
      if (!copied) copied = fallbackCopy(text);

      const original = button.textContent;
      button.textContent = copied ? '已复制' : '复制失败';
      button.classList.toggle('is-copied', copied);
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('is-copied');
      }, 1600);
    });
  });
}

/* ================= 回到顶部 ================= */
function initToTop() {
  const button = document.querySelector('[data-to-top]');
  if (!button) return;

  const onScroll = () => {
    button.classList.toggle('is-visible', window.scrollY > 600);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
}

/* ================= 年份 ================= */
function initYear() {
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

/* ================= PWA ================= */
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* 离线能力为增强项，注册失败不影响主流程 */
    });
  });
}

/* ================= 启动 ================= */
initTheme();
initNav();
initActiveSection();
initReveal();
initTabs();
initCopy();
initToTop();
initYear();
