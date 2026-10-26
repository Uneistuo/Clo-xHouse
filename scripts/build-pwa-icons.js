/**
 * 生成 Web 端 PWA 图标与 favicon
 *
 * 依赖：仅 Node 内置模块（zlib），无需安装图形库
 * 产物：web/assets/icon-192.png、icon-512.png、icon-maskable-512.png、
 *       apple-touch-icon.png、favicon.svg
 *
 * 用法：node scripts/build-pwa-icons.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'web', 'assets');

const SIZE = 512;
const UNIT = SIZE / 2;
const SS = 4;

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 图形 ---------- */
function inRoundedRect(px, py, radiusRatio) {
  const r = radiusRatio;
  const x = Math.min(px, 1 - px);
  const y = Math.min(py, 1 - py);
  if (x >= r || y >= r) return true;
  return (x - r) ** 2 + (y - r) ** 2 <= r * r;
}

function inRoundedBox(nx, ny, cx, cy, hw, hh, r) {
  const dx = Math.abs(nx - cx);
  const dy = Math.abs(ny - cy);
  if (dx > hw || dy > hh) return false;
  const ix = hw - r;
  const iy = hh - r;
  if (dx <= ix || dy <= iy) return true;
  return (dx - ix) ** 2 + (dy - iy) ** 2 <= r * r;
}

function inPolygon(nx, ny, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const TORSO = { cx: 0, cy: 0.16, hw: 0.34, hh: 0.36, r: 0.07 };
const SLEEVE_L = [
  [-0.3, -0.16],
  [-0.62, 0.0],
  [-0.52, 0.18],
  [-0.3, 0.08]
];
const SLEEVE_R = SLEEVE_L.map(([x, y]) => [-x, y]);
const NECK = { cx: 0, cy: -0.2, r: 0.15 };

function insideShirt(nx, ny) {
  const y = ny - 0.02;
  const body =
    inRoundedBox(nx, y, TORSO.cx, TORSO.cy, TORSO.hw, TORSO.hh, TORSO.r) ||
    inPolygon(nx, y, SLEEVE_L) ||
    inPolygon(nx, y, SLEEVE_R);
  if (!body) return false;
  return (nx - NECK.cx) ** 2 + (y - NECK.cy) ** 2 > NECK.r ** 2;
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const GRAD_A = [0x8a, 0x9b, 0xf9];
const GRAD_B = [0xb3, 0xa1, 0xfb];

function render(size, { maskable = false, scale = 0.92 } = {}) {
  const n = size * SS;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x * SS + sx + 0.5) / n;
          const py = (y * SS + sy + 0.5) / n;
          const nx = px * 2 - 1;
          const ny = py * 2 - 1;

          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;

          if (maskable || inRoundedRect(px, py, 0.22)) {
            const t = Math.min(1, Math.max(0, px * 0.6 + py * 0.4));
            [r, g, b] = mix(GRAD_A, GRAD_B, t);

            // 左上柔光
            const hd = Math.hypot(px - 0.26, py - 0.2) / 0.62;
            if (hd < 1) {
              const ha = (1 - hd) ** 2 * 0.22;
              r = r + (255 - r) * ha;
              g = g + (255 - g) * ha;
              b = b + (255 - b) * ha;
            }
            a = 1;

            if (insideShirt(nx / scale, ny / scale)) {
              r = 255;
              g = 255;
              b = 255;
            }
          }

          accR += r * a;
          accG += g * a;
          accB += b * a;
          accA += a;
        }
      }

      const i = (y * size + x) * 4;
      if (accA > 0) {
        out[i] = Math.round(accR / accA);
        out[i + 1] = Math.round(accG / accA);
        out[i + 2] = Math.round(accB / accA);
        out[i + 3] = Math.round((accA / (SS * SS)) * 255);
      }
    }
  }

  return encodePng(size, size, out);
}

/* ---------- favicon.svg ---------- */
function round(v) {
  return Math.round(v * 10) / 10;
}
function shirtPoint(nx, ny, scale) {
  return [round(UNIT + nx * scale * UNIT), round(UNIT + (ny + 0.02) * scale * UNIT)];
}

function buildFaviconSvg() {
  const scale = 0.92;
  const [tx, ty] = shirtPoint(TORSO.cx - TORSO.hw, TORSO.cy - TORSO.hh, scale);
  const torsoW = round(TORSO.hw * 2 * scale * UNIT);
  const torsoH = round(TORSO.hh * 2 * scale * UNIT);
  const torsoR = round(TORSO.r * scale * UNIT);
  const sleeveL = SLEEVE_L.map(([x, y]) => shirtPoint(x, y, scale).join(',')).join(' ');
  const sleeveR = SLEEVE_R.map(([x, y]) => shirtPoint(x, y, scale).join(',')).join(' ');
  const [ncx, ncy] = shirtPoint(NECK.cx, NECK.cy, scale);
  const nr = round(NECK.r * scale * UNIT);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="裁间">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8a9bf9"/>
      <stop offset="1" stop-color="#b3a1fb"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.2" r="0.62">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <mask id="neck">
      <rect width="512" height="512" fill="#fff"/>
      <circle cx="${ncx}" cy="${ncy}" r="${nr}" fill="#000"/>
    </mask>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>
  <g mask="url(#neck)" fill="#ffffff">
    <rect x="${round(tx)}" y="${round(ty)}" width="${torsoW}" height="${torsoH}" rx="${torsoR}"/>
    <polygon points="${sleeveL}"/>
    <polygon points="${sleeveR}"/>
  </g>
</svg>
`;
}

/* ---------- 输出 ---------- */
fs.mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  { file: 'icon-192.png', data: render(192) },
  { file: 'icon-512.png', data: render(512) },
  { file: 'icon-maskable-512.png', data: render(512, { maskable: true, scale: 0.56 }) },
  { file: 'apple-touch-icon.png', data: render(180, { maskable: true, scale: 0.8 }) }
];

for (const { file, data } of outputs) {
  fs.writeFileSync(path.join(OUT_DIR, file), data);
  console.log(`[icons] 已生成 web/assets/${file} (${data.length} bytes)`);
}

fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), buildFaviconSvg());
console.log('[icons] 已生成 web/assets/favicon.svg');
