// utils/api.js 网络请求封装
// 请求地址（自动按运行环境选择，无需手动切换）：
//  - 开发者工具模拟器：请求本地后端 http://127.0.0.1:3000（backend 目录 npm start 启动）
//  - 手机真机 / 线上：  请求云托管公网域名（自动加入小程序合法域名，无需在小程序后台配置）
//
// CLOUD_BASE_URL：云托管服务的公网默认域名（云托管控制台「服务设置-公网访问」可查看）
const CLOUD_BASE_URL = 'https://express-3how-324239-10-1501349049.sh.run.tcloudbase.com';

const DEV_BASE = 'http://127.0.0.1:3000';
const IS_DEVTOOLS = wx.getSystemInfoSync().platform === 'devtools';
// 本地后端已切换为 MySQL：本地未安装 MySQL，开发者工具也直连云托管后端
const FORCE_CLOUD = true;

// BASE_URL：所有请求与商品图片的地址前缀（devtools 用本地后端，其余用云托管域名）
const BASE_URL = IS_DEVTOOLS && !FORCE_CLOUD ? DEV_BASE : CLOUD_BASE_URL;

/** 读取本地登录 Token */
function getToken() {
  return wx.getStorageSync('token') || '';
}

/** 统一处理响应（本地请求与云托管返回结构一致：statusCode + data） */
function handleResponse(res, resolve, reject) {
  // 登录失效：清除本地登录信息并跳转登录页
  if (res.statusCode === 401) {
    wx.removeStorageSync('token');
    wx.removeStorageSync('adminInfo');
    wx.reLaunch({ url: '/pages/login/login' });
    reject(new Error('登录已过期'));
    return;
  }
  const body = res.data;
  // 未绑定店铺（code=1001）：引导到店铺创建/绑定页
  if (body && body.code === 1001) {
    wx.showToast({ title: body.message || '请先绑定店铺', icon: 'none' });
    wx.reLaunch({ url: '/pages/store/store' });
    reject(new Error(body.message || '请先绑定店铺'));
    return;
  }
  if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
    resolve(body.data);
  } else {
    const msg = (body && body.message) || '请求失败';
    wx.showToast({ title: msg, icon: 'none' });
    const err = new Error(msg);
    err.code = body ? body.code : 0; // 业务错误码（如 1002 开单授权失效），供页面区分处理
    reject(err);
  }
}

/**
 * 通用请求（Promise 封装）
 * 自动携带 Token；后端返回 401 时清除登录态并跳转登录页
 */
function request({ url, method = 'GET', data = {}, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: Object.assign(
        { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        header
      ),
      success(res) { handleResponse(res, resolve, reject); },
      fail(err) {
        const inDev = wx.getSystemInfoSync().platform === 'devtools';
        wx.showToast({
          title: inDev ? '网络错误，请确认后端服务已启动' : '云服务请求失败，请稍后重试',
          icon: 'none',
          duration: 2500
        });
        reject(err);
      }
    });
  });
}

/**
 * 图片上传（wx.uploadFile 封装），返回图片相对路径 /uploads/xxx
 */
function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/api/upload',
      filePath,
      name: 'file',
      header: { Authorization: 'Bearer ' + getToken() },
      success(res) {
        try {
          const body = JSON.parse(res.data);
          if (body.code === 0) resolve(body.data.url);
          else {
            wx.showToast({ title: body.message || '上传失败', icon: 'none' });
            reject(new Error(body.message));
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

module.exports = { BASE_URL, getToken, request, uploadFile };
