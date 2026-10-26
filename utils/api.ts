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

// 云托管服务所属环境（云托管控制台右上角「环境」→ 环境 ID，如 prod-d3glxidf70a368a07）
// 注意：与 app.js 中 wx.cloud.init 的云开发环境可能不同，callContainer 需要用服务所在环境
const CLOUD_ENV = 'prod-d3glxidf70a368a07';
// 云托管服务名（云托管控制台「服务列表」页面标题所示，如 express-3how）
const CLOUD_SERVICE = 'express-3how';
// 云托管调用通道开关：服务名/环境未确认前可改为 false，回退到域名直连（需域名已在合法域名列表内）
const USE_CONTAINER = true;

/** 是否可走云托管调用通道（免服务器域名白名单/备案校验） */
function canCallContainer(): boolean {
  const cloud = (wx as any).cloud;
  return !!(USE_CONTAINER && cloud && typeof cloud.callContainer === 'function' && CLOUD_SERVICE);
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
  /** 静默请求：失败不弹 toast（启动预热用，避免后台预取失败打扰用户） */
  silent?: boolean;
}

/** 读取本地登录 Token */
export function getToken(): string {
  return wx.getStorageSync<string>('token') || '';
}

/** 统一处理响应（本地请求与云托管返回结构一致：statusCode + data） */
function handleResponse(
  res: WechatMiniprogram.RequestSuccessCallbackResult,
  resolve: (data: any) => void,
  reject: (err: BizError) => void,
  silent = false
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
    if (!silent) {
      wx.showToast({ title: body.message || '请先绑定店铺', icon: 'none' });
      wx.reLaunch({ url: '/pages/register/register?mode=bind' });
    }
    reject(new Error(body.message || '请先绑定店铺'));
    return;
  }
  if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
    resolve(body.data);
  } else {
    const msg = (body && body.message) || '请求失败';
    if (!silent) wx.showToast({ title: msg, icon: 'none' });
    const err: BizError = new Error(msg);
    err.code = body ? body.code : 0; // 业务错误码（如 1002 开单授权失效），供页面区分处理
    reject(err);
  }
}

/** 把对象序列化为 query string（undefined / null 直接丢弃） */
function toQuery(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((k) => data[k] !== undefined && data[k] !== null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(data[k]))}`)
    .join('&');
}

/** GET 的完整路径：把参数拼到 query 上（path 自带 ? 时改用 & 续接） */
function buildPath(url: string, data: Record<string, unknown>): string {
  const qs = toQuery(data);
  if (!qs) return url;
  return `${url}${url.indexOf('?') >= 0 ? '&' : '?'}${qs}`;
}

/**
 * 通用请求（Promise 封装）
 * 自动携带 Token；后端返回 401 时清除登录态并跳转登录页
 * 遇到 502/503/504（云托管冷启动缩容）或网络失败时自动重试（间隔 1.5s，最多 2 次）
 */
/** 把 wx.request 的 errMsg 翻译成可定位的中文原因 */
function describeFail(errMsg: string, inDev: boolean): string {
  if (errMsg.indexOf('INVALID_HOST') >= 0) return '云托管服务名或环境不匹配';
  if (errMsg.indexOf('url not in domain list') >= 0) return '域名未加入 request 合法域名';
  if (errMsg.indexOf('timeout') >= 0) return '请求超时，请重试';
  if (errMsg.indexOf('ssl') >= 0 || errMsg.indexOf('certificate') >= 0) return 'HTTPS 证书校验失败';
  if (errMsg.indexOf('ERR_NAME_NOT_RESOLVED') >= 0) return '域名解析失败，请检查网络';
  if (errMsg.indexOf('ERR_CONNECTION_REFUSED') >= 0) return '服务拒绝连接（未启动/缩容中）';
  return inDev ? '网络错误，请确认后端服务已启动' : '云服务请求失败，请稍后重试';
}

export function request({ url, method = 'GET', data = {}, header = {}, silent = false }: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    // 云托管空闲会缩容到 0，冷启动常需 10~60s：固定 1.5s×2 覆盖不到，改为指数退避
    const RETRY_DELAYS = [1500, 3000, 6000, 10000];
    let attempt = 0;
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
      header
    );

    const onDone = (statusCode: number, body: any): void => {
      // 云托管临时不可用（冷启动/重启）：延迟后自动重试
      if ((statusCode === 502 || statusCode === 503 || statusCode === 504) && attempt < RETRY_DELAYS.length) {
        setTimeout(doRequest, RETRY_DELAYS[attempt]);
        attempt += 1;
        return;
      }
      handleResponse(
        { statusCode, data: body } as WechatMiniprogram.RequestSuccessCallbackResult,
        resolve,
        reject,
        silent
      );
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
      if (!silent) {
        wx.showToast({
          title: inDev ? reason : reason + '（' + (errMsg || 'unknown') + '）',
          icon: 'none',
          duration: 3000
        });
      }
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
          // 关键：云托管通道不会把 GET 的 data 转成 query，必须自己拼到 path 上。
          // 否则 status / keyword / page 等筛选参数会被静默丢弃，后端只能返回全量数据
          //（典型现象：「已下架」页看到上架中的商品、搜索无效）。
          path: method === 'GET' ? buildPath(url, data) : url,
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

/**
 * 上传前压缩：长边 > 1200px 或文件 > 800KB 时压至质量 80
 * - 尺寸/大小读取失败、低版本基础库、压缩失败时回退原图，保证上传流程不中断
 */
function compressIfNeeded(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof (wx as any).compressImage !== 'function') return resolve(filePath);
    const doCompress = () => {
      (wx as any).compressImage({
        src: filePath,
        quality: 80,
        success: (res: any) => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      });
    };
    let fileSize = 0;
    try {
      fileSize = (wx.getFileSystemManager().statSync(filePath) as any).size || 0;
    } catch (e) {
      fileSize = 0;
    }
    if (typeof (wx as any).getImageInfo !== 'function') {
      if (fileSize > 800 * 1024) doCompress();
      else resolve(filePath);
      return;
    }
    (wx as any).getImageInfo({
      src: filePath,
      success: (info: any) => {
        if (!info || info.width > 1200 || info.height > 1200 || fileSize > 800 * 1024) doCompress();
        else resolve(filePath);
      },
      fail: () => {
        if (fileSize > 800 * 1024) doCompress();
        else resolve(filePath);
      }
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

/** 云开发存储直传（先压缩），返回 fileID（cloud://…，仅小程序内可显示） */
async function uploadViaCloudStorage(filePath: string): Promise<string> {
  const src = await compressIfNeeded(filePath);
  return new Promise((resolve, reject) => {
    const cloud = (wx as any).cloud;
    const extMatch = src.split('?')[0].match(/\.[a-zA-Z0-9]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
    const cloudPath = `goods/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cloud.uploadFile({
      cloudPath,
      filePath: src,
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
