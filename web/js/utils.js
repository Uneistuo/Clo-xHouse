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
/**
 * 图片地址归一化
 * - 已是 http(s) 地址：原样返回
 * - cloud://（云存储 fileID）：浏览器无法直接访问，返回空串 → 由调用方显示占位图
 * - 其余相对路径：拼接后端域名
 */
export const fixImg = (u) => {
  if (!u) return '';
  if (/^https?:\/\//.test(u)) return u;
  if (/^cloud:\/\//.test(u)) {
    console.warn('[fixImg] cloud:// 图片浏览器不可用，请重新上传：', u);
    return '';
  }
  return BASE_URL + u;
};
export const firstImg = (s) => (s || '').split(',')[0];

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
