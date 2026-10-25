// utils/api.ts 网络请求封装（TypeScript 版，从 api.js 迁移，行为保持一致）
// 请求通道（自动选择，无需手动切换）：
//  - 业务请求：优先走 wx.cloud.callContainer（云开发 → 云托管），不受服务器域名白名单与备案校验限制
//  - 兜底：无云开发时走 wx.request + CLOUD_BASE_URL
//  - 图片上传：wx.uploadFile 只能走域名，需在云托管绑定自定义已备案域名并加入 uploadFile 合法域名
//
// CLOUD_BASE_URL：云托管服务的公网默认域名（仅供测试，微信不允许配置为正式环境的服务器域名）
const CLOUD_BASE_URL = 'https://express-3how-324239-10-1501349049.sh.run.tcloudbase.com';

const DEV_BASE = 'http://127.0.0.1:3000';
const IS_DEVTOOLS = wx.getSystemInfoSync().platform === 'devtools';
// 本地后端已切换为 MySQL：本地未安装 MySQL，开发者工具也直连云托管后端
const FORCE_CLOUD = true;

// BASE_URL：所有请求与商品图片的地址前缀（devtools 用本地后端，其余用云托管域名）
export const BASE_URL: string = IS_DEVTOOLS && !FORCE_CLOUD ? DEV_BASE : CLOUD_BASE_URL;

// 云开发环境（与 app.js 中 wx.cloud.init 的 env 保持一致）
const CLOUD_ENV = 'cloudbase-d8gi3gmlw2c70f695';
// 云托管服务名（云托管控制台「服务列表」查看；从默认域名 express-xxx 推断为 express，如不符请改这里）
const CLOUD_SERVICE = 'express';

/** 是否可走云托管调用通道（免服务器域名白名单/备案校验） */
function canCallContainer(): boolean {
  const cloud = (wx as any).cloud;
  return !!(cloud && typeof cloud.callContainer === 'function' && CLOUD_SERVICE);
}

/** 业务错误：携带后端返回的 code（如 1002 开单授权失效），供页面区分处理 */
export interface BizError extends Error {
  code?: number;
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
}

/** 读取本地登录 Token */
export function getToken(): string {
  return wx.getStorageSync<string>('token') || '';
}

/** 统一处理响应（本地请求与云托管返回结构一致：statusCode + data） */
function handleResponse(
  res: WechatMiniprogram.RequestSuccessCallbackResult,
  resolve: (data: any) => void,
  reject: (err: BizError) => void
): void {
  // 登录失效：清除本地登录信息并跳转登录页
  if (res.statusCode === 401) {
    wx.removeStorageSync('token');
    wx.removeStorageSync('adminInfo');
    wx.reLaunch({ url: '/pages/login/login' });
    reject(new Error('登录已过期'));
    return;
  }
  const body = res.data as { code?: number; message?: string; data?: any } | undefined;
  // 未绑定店铺（code=1001）：引导到注册+绑定页（第 2 步）
  if (body && body.code === 1001) {
    wx.showToast({ title: body.message || '请先绑定店铺', icon: 'none' });
    wx.reLaunch({ url: '/pages/register/register?mode=bind' });
    reject(new Error(body.message || '请先绑定店铺'));
    return;
  }
  if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
    resolve(body.data);
  } else {
    const msg = (body && body.message) || '请求失败';
    wx.showToast({ title: msg, icon: 'none' });
    const err: BizError = new Error(msg);
    err.code = body ? body.code : 0; // 业务错误码（如 1002 开单授权失效），供页面区分处理
    reject(err);
  }
}

/**
 * 通用请求（Promise 封装）
 * 自动携带 Token；后端返回 401 时清除登录态并跳转登录页
 * 遇到 502/503/504（云托管冷启动缩容）或网络失败时自动重试（间隔 1.5s，最多 2 次）
 */
/** 把 wx.request 的 errMsg 翻译成可定位的中文原因 */
function describeFail(errMsg: string, inDev: boolean): string {
  if (errMsg.indexOf('url not in domain list') >= 0) return '域名未加入 request 合法域名';
  if (errMsg.indexOf('timeout') >= 0) return '请求超时，请重试';
  if (errMsg.indexOf('ssl') >= 0 || errMsg.indexOf('certificate') >= 0) return 'HTTPS 证书校验失败';
  if (errMsg.indexOf('ERR_NAME_NOT_RESOLVED') >= 0) return '域名解析失败，请检查网络';
  if (errMsg.indexOf('ERR_CONNECTION_REFUSED') >= 0) return '服务拒绝连接（未启动/缩容中）';
  return inDev ? '网络错误，请确认后端服务已启动' : '云服务请求失败，请稍后重试';
}

export function request({ url, method = 'GET', data = {}, header = {} }: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    // 云托管空闲会缩容到 0，冷启动常需 10~60s：固定 1.5s×2 覆盖不到，改为指数退避
    const RETRY_DELAYS = [1500, 3000, 6000, 10000];
    let attempt = 0;
    const headers = Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }, header);

    const onDone = (statusCode: number, body: any): void => {
      // 云托管临时不可用（冷启动/重启）：延迟后自动重试
      if ((statusCode === 502 || statusCode === 503 || statusCode === 504) && attempt < RETRY_DELAYS.length) {
        setTimeout(doRequest, RETRY_DELAYS[attempt]);
        attempt += 1;
        return;
      }
      handleResponse({ statusCode, data: body } as WechatMiniprogram.RequestSuccessCallbackResult, resolve, reject);
    };

    const onFail = (errMsg: string, raw: unknown): void => {
      if (attempt < RETRY_DELAYS.length) {
        setTimeout(doRequest, RETRY_DELAYS[attempt]);
        attempt += 1;
        return;
      }
      const inDev = wx.getSystemInfoSync().platform === 'devtools';
      // 真机看不到控制台时，靠这条 toast 判断原因（也可在「真机调试」里看完整日志）
      console.error('[api] request fail', url, errMsg);
      const reason = describeFail(errMsg, inDev);
      wx.showToast({ title: inDev ? reason : reason + '（' + (errMsg || 'unknown') + '）', icon: 'none', duration: 3000 });
      reject(raw instanceof Error ? raw : new Error(errMsg));
    };

    /** 解析响应体：云托管调用返回的 data 可能是字符串 */
    const parseBody = (d: any): any => {
      if (typeof d !== 'string') return d;
      try {
        return JSON.parse(d);
      } catch (e) {
        return d;
      }
    };

    const doRequest = (): void => {
      // 云开发通道：不受小程序服务器域名白名单与备案限制（云托管默认域名仅供测试）
      if (canCallContainer()) {
        (wx as any).cloud.callContainer({
          config: { env: CLOUD_ENV },
          path: url,
          method,
          header: Object.assign({ 'X-WX-SERVICE': CLOUD_SERVICE }, headers),
          data: method === 'GET' ? undefined : data,
          success(res: any) {
            onDone(res.statusCode, parseBody(res.data));
          },
          fail(err: any) {
            onFail((err && err.errMsg) || '', err);
          }
        });
        return;
      }
      wx.request({
        url: BASE_URL + url,
        method,
        data,
        header: headers,
        success(res) {
          onDone(res.statusCode, res.data);
        },
        fail(err) {
          onFail((err && err.errMsg) || '', err);
        }
      });
    };
    doRequest();
  });
}

/**
 * 图片上传
 * - 默认走后端 /api/upload/base64（云托管调用通道，无域名白名单要求），返回 https / /uploads 地址，Web 后台同样可显示
 * - 后端通道失败且有云开发时，回退云开发存储直传（fileID，仅小程序内可显示）
 */
export function uploadFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 优先走后端（云托管调用通道 / wx.uploadFile）：得到 https 或 /uploads 地址，Web 后台也能显示
    uploadViaBackend(filePath).then(resolve, (err) => {
      // 后端通道不可用时，回退云开发存储（仅小程序内可见）
      if (canCallContainer()) {
        uploadViaCloudStorage(filePath).then(resolve, reject);
        return;
      }
      reject(err);
    });
  });
}

/** 压缩图片（减小 base64 体积）；不支持或失败时返回原图 */
function compressIfNeeded(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof (wx as any).compressImage !== 'function') return resolve(filePath);
    (wx as any).compressImage({
      src: filePath,
      quality: 80,
      success: (res: any) => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath)
    });
  });
}

/** 经后端保存图片（callContainer 通道，无域名白名单要求），返回 https / /uploads 地址 */
async function uploadViaBackend(filePath: string): Promise<string> {
  const src = await compressIfNeeded(filePath);
  const b64 = wx.getFileSystemManager().readFileSync(src, 'base64') as string;
  const extMatch = src.split('?')[0].match(/\.(png|webp|jpe?g)$/i);
  const mime = extMatch ? 'image/' + extMatch[1].toLowerCase().replace('jpg', 'jpeg') : 'image/jpeg';
  const data = await request({
    url: '/api/upload/base64',
    method: 'POST',
    data: { data: b64, mime }
  });
  if (!data || !data.url) throw new Error('上传返回异常');
  return data.url as string;
}

/** 云开发存储直传，返回 fileID（cloud://…，仅小程序内可显示） */
function uploadViaCloudStorage(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloud = (wx as any).cloud;
    const extMatch = filePath.split('?')[0].match(/\.[a-zA-Z0-9]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
    const cloudPath = `goods/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cloud.uploadFile({
      cloudPath,
      filePath,
      success(res: any) {
        resolve(res.fileID);
      },
      fail(err: any) {
        const errMsg = (err && err.errMsg) || '';
        console.error('[api] cloud uploadFile fail', errMsg);
        wx.showToast({ title: '图片上传失败（' + (errMsg || 'unknown') + '）', icon: 'none', duration: 3000 });
        reject(err instanceof Error ? err : new Error(errMsg));
      }
    });
  });
}
