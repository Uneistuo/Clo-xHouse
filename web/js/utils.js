/**
 * 通用工具：DOM 选择、转义、图片地址、防抖
 */
/* eslint-env browser */

import { BASE_URL } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export const fixImg = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : BASE_URL + u);
export const firstImg = (s) => (s || '').split(',')[0];

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
