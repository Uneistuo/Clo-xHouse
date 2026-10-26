/**
 * 图标构建脚本（两端共享同一份图标源）
 *
 * 数据源：styles/icons.source.json
 * 产物：
 *   - web/icons.css             Web 管理后台（独立样式文件）
 *   - styles/icons.wxss         小程序基础图标
 *   - styles/icons-extra.wxss   小程序补充图标（含 Web 端新增的 moon/sun 等）
 *
 * 用法：
 *   node scripts/build-icons.js           # 生成产物
 *   node scripts/build-icons.js --check   # 仅校验产物是否与源一致（CI 用）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'styles', 'icons.source.json');
const CHECK = process.argv.includes('--check');

const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const base = source.base || [];
const extra = source.extra || [];

const encode = (svg) => Buffer.from(svg, 'utf8').toString('base64');
const dataUri = (svg, quote) => `url(${quote}data:image/svg+xml;base64,${encode(svg)}${quote})`;

const WEB_HEADER = `/* ============================================================
   web/icons.css —— 矢量图标（由 scripts/build-icons.js 生成，勿手改）
   数据源：styles/icons.source.json（与小程序共享同一套图标）
   用法：<span class="icon icon-search"></span>，颜色随 currentColor，大小随 font-size
   ============================================================ */
`;

const WXSS_HEADER = `/* ============================================================
   styles/icons.wxss —— 矢量图标（由 scripts/build-icons.js 生成，勿手改）
   数据源：styles/icons.source.json（与 Web 端共享同一套图标）
   用法：<view class="icon icon-search"></view>，颜色随 currentColor，大小随 font-size
   ============================================================ */
`;

const WXSS_EXTRA_HEADER = `/* ============================================================
   styles/icons-extra.wxss —— 补充矢量图标（由 scripts/build-icons.js 生成，勿手改）
   数据源：styles/icons.source.json；新增图标请改源文件后重新执行 npm run icons:build
   ============================================================ */
`;

const ICON_BASE = `.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  vertical-align: -0.125em;
}
`;

function buildWebCss() {
  const rules = [...base, ...extra]
    .map(
      ({ name, svg }) => `.icon-${name} {
  -webkit-mask-image: ${dataUri(svg, "'")};
  mask-image: ${dataUri(svg, "'")};
}
`
    )
    .join('\n');
  return WEB_HEADER + '\n' + ICON_BASE + '\n' + rules;
}

function buildWxss(list) {
  return list
    .map(
      ({ name, svg }) =>
        `.icon-${name} { -webkit-mask-image: ${dataUri(svg, '"')}; mask-image: ${dataUri(svg, '"')}; }\n`
    )
    .join('');
}

const outputs = [
  { file: 'web/icons.css', content: buildWebCss() },
  { file: 'styles/icons.wxss', content: WXSS_HEADER + '\n' + ICON_BASE + '\n' + buildWxss(base) },
  {
    file: 'styles/icons-extra.wxss',
    content: WXSS_EXTRA_HEADER + '\n' + buildWxss(extra)
  }
];

let failed = false;
for (const { file, content } of outputs) {
  const abs = path.join(ROOT, file);
  if (CHECK) {
    const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    // 跨平台校验：忽略 Git 检出时的 CRLF 差异
    const normalize = (text) => text.replace(/\r\n/g, '\n');
    if (normalize(current) !== normalize(content)) {
      console.error(`[icons] 产物不同步：${file}（请执行 npm run icons:build）`);
      failed = true;
    } else {
      console.log(`[icons] OK ${file}`);
    }
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    console.log(`[icons] 已生成 ${file}`);
  }
}

if (failed) process.exit(1);
