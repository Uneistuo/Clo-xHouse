/**
 * 轻量 UI 原语：Toast、弹窗、确认框、输入框、按钮 loading
 */
/* eslint-env browser */

import { $, esc } from './utils.js';

/* ================= Toast / Modal ================= */
let toastTimer = null;
function toast(msg, isErr = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 2400);
}
let modalEscHandler = null;
function openModal(html) {
  $('#modal-root').innerHTML = `<div class="modal-mask"><div class="modal">${html}</div></div>`;
  const mask = $('.modal-mask', $('#modal-root'));
  mask.addEventListener('click', (e) => {
    if (e.target === mask) closeModal();
  });
  // 同一时间只保留一个 Esc 监听，关闭弹窗时移除，避免重复绑定
  if (modalEscHandler) document.removeEventListener('keydown', modalEscHandler);
  modalEscHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', modalEscHandler);
}
let activeDialogResolver = null; // 未决对话框的 resolve（ESC 取消时使用）

function closeModal() {
  if (modalEscHandler) {
    document.removeEventListener('keydown', modalEscHandler);
    modalEscHandler = null;
  }
  if (activeDialogResolver) {
    const resolver = activeDialogResolver;
    activeDialogResolver = null;
    resolver(false);
  }
  $('#modal-root').innerHTML = '';
}

/* ================= 交互增强工具 ================= */
// 按钮加载状态
function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// 字段错误提示
function showFieldError(input, msg) {
  input.classList.add('error');
  let err = input.parentElement.querySelector('.form-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'form-error';
    input.parentElement.appendChild(err);
  }
  err.textContent = msg;
}
function clearFieldError(input) {
  input.classList.remove('error');
  const err = input.parentElement.querySelector('.form-error');
  if (err) err.remove();
}

// 自定义确认对话框（替代原生 confirm，返回 Promise<boolean>）
function confirm(msg) {
  return new Promise((resolve) => {
    activeDialogResolver = resolve;
    openModal(`
      <div class="confirm-dialog">
        <div style="color:var(--text-2);font-size:14px;line-height:1.5;margin-bottom:22px">${esc(msg)}</div>
        <div class="dialog-actions">
          <button class="btn btn-cancel" data-act="cancel">取消</button>
          <button class="btn btn-confirm" data-act="ok">确定</button>
        </div>
      </div>`);
    const dlg = $('#modal-root .confirm-dialog');
    const finish = (ok) => {
      activeDialogResolver = null;
      resolve(ok);
      closeModal();
    };
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
    dlg.querySelector('[data-act="ok"]').addEventListener('click', () => finish(true));
  });
}

// 自定义提示输入对话框（替代原生 prompt，返回 Promise<string|null>）
function prompt(msg, defaultValue = '') {
  return new Promise((resolve) => {
    activeDialogResolver = resolve;
    openModal(`
      <div class="prompt-dialog">
        <div style="color:var(--text-2);font-size:14px;margin-bottom:14px">${esc(msg)}</div>
        <input type="text" id="prompt-input" value="${esc(defaultValue || '')}" style="width:100%;padding:10px 14px;border:1px solid var(--border-strong);border-radius:8px;font-size:14px;box-sizing:border-box">
        <div class="dialog-actions" style="margin-top:16px">
          <button class="btn btn-cancel" data-act="cancel">取消</button>
          <button class="btn btn-confirm" data-act="ok">确定</button>
        </div>
      </div>`);
    const dlg = $('#modal-root .prompt-dialog');
    const input = $('#prompt-input');
    input.focus();
    const finish = (ok, val) => {
      activeDialogResolver = null;
      resolve(ok ? val : null);
      closeModal();
    };
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
    dlg.querySelector('[data-act="ok"]').addEventListener('click', () => finish(true, input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true, input.value);
      if (e.key === 'Escape') finish(false);
    });
  });
}

export { toast, openModal, closeModal, confirm, prompt, setBtnLoading, showFieldError, clearFieldError };
