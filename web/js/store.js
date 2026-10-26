/**
 * 登录态与 API 封装（含 502/503/504 自动重试，应对云托管冷启动）
 */
/* eslint-env browser */

import { BASE_URL } from './config.js';
import { sleep } from './utils.js';
import { toast } from './ui.js';
import { requestRender } from './bus.js';

/* ================= 登录态 ================= */
let token = localStorage.getItem('token') || '';
let admin = null;
try {
  admin = JSON.parse(localStorage.getItem('admin') || 'null');
} catch (e) {
  admin = null;
}

function saveAuth(t, a) {
  token = t;
  admin = a;
  localStorage.setItem('token', t);
  localStorage.setItem('admin', JSON.stringify(a || null));
}
function clearAuth() {
  token = '';
  admin = null;
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  localStorage.removeItem('platFlagToken');
}

/**
 * 平台权限探测：登录接口若未返回 isPlatform（旧版后端），用 /api/platform/stores 探测一次
 * 结果缓存到 localStorage（按 token 失效，换号/重登自动重新探测）
 */
async function ensurePlatformFlag() {
  if (!admin) return false;
  if (localStorage.getItem('platFlagToken') === token) return !!admin.isPlatform;
  let isPlat = false;
  try {
    const res = await fetch(BASE_URL + '/api/platform/stores', { headers: { Authorization: 'Bearer ' + token } });
    isPlat = res.status === 200; // 200=平台管理员；401/403=普通账号
  } catch (e) {
    isPlat = false;
  }
  admin = Object.assign({}, admin, { isPlatform: isPlat });
  localStorage.setItem('admin', JSON.stringify(admin));
  localStorage.setItem('platFlagToken', token);
  return isPlat;
}

/* ================= API 封装（含 502/503/504 自动重试，应对云托管冷启动） ================= */
async function api(path, { method = 'GET', data, form } = {}) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (form) opts.body = form;
  else if (data !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(BASE_URL + path, opts);
    } catch (e) {
      if (attempt < 2) {
        await sleep(1500);
        continue;
      }
      toast('网络错误，请稍后重试', true);
      throw e;
    }
    if ([502, 503, 504].includes(res.status) && attempt < 2) {
      await sleep(1500);
      continue;
    }
    if (res.status === 401) {
      clearAuth();
      requestRender();
      toast('登录已过期，请重新登录', true);
      throw new Error('登录已过期');
    }
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      /* 非 JSON 响应 */
    }
    if (body && body.code === 1001) {
      location.hash = '#/setup';
      requestRender();
      throw new Error(body.message || '请先绑定店铺');
    }
    if (body && body.code === 0) return body.data;
    const msg = (body && body.message) || '请求失败';
    toast(msg, true);
    const err = new Error(msg);
    err.code = body ? body.code : 0;
    throw err;
  }
}

export { token, admin, saveAuth, clearAuth, ensurePlatformFlag, api };
