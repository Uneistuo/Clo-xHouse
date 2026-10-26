/** 全局事件总线：页面请求重新渲染，避免模块间循环依赖 */
/* eslint-env browser */

export const bus = new EventTarget();

export function requestRender() {
  bus.dispatchEvent(new Event('rerender'));
}
