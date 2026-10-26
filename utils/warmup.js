// utils/warmup.js —— tab 页首屏数据预热
//
// 小程序不会预创建 tab 页：页面 JS 要等到第一次点进该 tab 才执行，
// 页面里「onShow → 发请求 → 渲染」这条链路也就只能等到那一刻才开始。
//
// 能做的是把「取数」提前：启动后台静默预取各 tab 的首屏数据，
// 页面第一次打开时直接命中快照渲染（骨架屏都不出现），随后再静默补拉一次最新数据。
// 之后该页面就和原来完全一样了。
//
// 用法（页面侧）：
//   const warm = warmup.take('goods', params);           // 同步取快照，命中则跳过骨架屏
//   const data = warm || await warmup.fetch('goods', { url: '/api/goods', data: params });
//   if (warm) this.loadGoods(true, true);                // 渲染完静默刷新
//
// 约定：params 必须与 prefetch 时一致（键顺序无关），否则不命中，退回正常请求。

const { request } = require('./api');

const TTL = 5 * 60 * 1000; // 快照有效期：太久之前的数据不如让页面重新加载

const snapshots = {}; // key -> { at, token, params, data }
const inflight = {}; // key -> { token, params, promise }
const touched = {}; // 已被页面真正用过的 key：不再重复预取

let startedFor = ''; // 已经为哪个 token 预热过（换账号登录后要重新预热）

/** 参数指纹：避免对象键顺序影响比较 */
function fingerprint(params) {
  if (!params) return '';
  return Object.keys(params)
    .sort()
    .map((k) => k + '=' + String(params[k]))
    .join('&');
}

function currentToken() {
  return wx.getStorageSync('token') || '';
}

/**
 * 取预热快照（同步、只消费一次）。
 * 命中后该 key 的后续加载一律走网络，保证「首次最快，之后越用越新」。
 * 换账号登录后 token 对不上，旧快照直接作废。
 */
function take(key, params) {
  touched[key] = true;
  const rec = snapshots[key];
  if (!rec) return null;
  delete snapshots[key];
  if (rec.token !== currentToken()) return null;
  if (Date.now() - rec.at > TTL) return null;
  if (fingerprint(rec.params) !== fingerprint(params)) return null;
  return rec.data;
}

/**
 * 页面取数：若同一 key 的预热请求还在路上，就复用它（不重复发请求）；
 * 否则自己发一次。失败照常抛给调用方（页面原有兜底逻辑不变）。
 */
async function fetch(key, options) {
  touched[key] = true;
  const running = inflight[key];
  if (running && running.token === currentToken() && fingerprint(running.params) === fingerprint(options.data)) {
    const data = await running.promise;
    if (data !== undefined) return data;
  }
  return request(options);
}

/** 后台预取：失败静默（页面第一次打开时会自己再请求一次） */
function prefetch(key, options) {
  if (touched[key] || snapshots[key] || inflight[key]) return;
  const params = options.data || {};
  const token = currentToken();
  const promise = request(Object.assign({}, options, { silent: true }))
    .then((data) => {
      // 页面在预取返回前已经自己取过数（fetch 复用了这个请求）：不再留快照
      if (!touched[key]) snapshots[key] = { at: Date.now(), token, params, data };
      return data;
    })
    .catch(() => undefined);
  inflight[key] = { token, params, promise };
  promise.then(() => {
    if (inflight[key] && inflight[key].promise === promise) delete inflight[key];
  });
}

function runPrefetch() {
  prefetch('goods', {
    url: '/api/goods',
    data: { keyword: '', status: '', page: 1, pageSize: 20 }
  });
  prefetch('orders', {
    url: '/api/orders',
    data: { status: '', range: 'all', keyword: '', page: 1, pageSize: 20 }
  });
  prefetch('billing-goods', {
    url: '/api/goods',
    data: { keyword: '', status: 'on', page: 1, pageSize: 20 }
  });
  prefetch('store', { url: '/api/store/info' });
}

/**
 * 启动预热入口。参数必须与页面首次加载时一致（即各页 data 的默认值）。
 * delay 默认 1.2s：先让首屏自己的请求发出去，再补其余 tab，避免抢带宽。
 */
function start(delay = 1200) {
  const token = currentToken();
  if (!token || startedFor === token) return;
  startedFor = token;
  setTimeout(runPrefetch, delay);
}

/** 退出登录时清空，避免下一个账号读到上一个账号的数据 */
function reset() {
  Object.keys(snapshots).forEach((k) => delete snapshots[k]);
  Object.keys(inflight).forEach((k) => delete inflight[k]);
  Object.keys(touched).forEach((k) => delete touched[k]);
  startedFor = '';
}

module.exports = { take, fetch, prefetch, start, reset };
