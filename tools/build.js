#!/usr/bin/env node
/* 公開用のファイル一式をつくる
 *
 *   node tools/build.js site [出力先]       … 置き場所（Netlify など）に置く一式。出力先の省略時は dist/
 *   node tools/build.js artifact <出力先>   … claude.ai の公開ページ用の一式（ページは start.html）
 *   node tools/build.js worker <出力先>     … Cloudflare Workers 用：site の一式を 1 つのプログラム（worker.js）に入れたもの
 *                                            （npx wrangler deploy <出力先>/worker.js --name <名前> で置く）
 *
 *   site：アプリ本体 ＋ 受け口のプログラム（tools/apps-script/Code.gs。保護者画面の案内がここから読む）
 *   artifact：アプリ本体だけ。claude.ai がページの外枠をつけるので、教科えらびの画面の先頭の
 *             doctype などを外し、各ページの manifest の行も外す（claude.ai では使わないため）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mode = process.argv[2];
if (!['site', 'artifact', 'worker'].includes(mode)) {
  console.error('使い方: node tools/build.js site [出力先] ／ artifact <出力先> ／ worker <出力先>');
  process.exit(1);
}
const out = path.resolve(process.argv[3] || (mode === 'site' ? path.join(ROOT, 'dist') : ''));
if (!process.argv[3] && mode !== 'site') { console.error(`${mode} には出力先が必要です`); process.exit(1); }
if (mode === 'worker') { buildWorker(out); process.exit(0); }
if (out === ROOT || ROOT.startsWith(out + path.sep)) { console.error('出力先が、リポジトリそのものか、その上のフォルダになっています'); process.exit(1); }

const PAGES = ['index.html', 'kokugo.html', 'shakai.html', 'rika.html'];
const DIRS = ['css', 'js'];
const ROOT_FILES = fs.readdirSync(ROOT).filter((f) => /\.(svg|webmanifest)$/.test(f));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.mkdirSync(out, { recursive: true });
DIRS.forEach((d) => copyDir(path.join(ROOT, d), path.join(out, d)));
const written = [];

for (const page of PAGES) {
  let html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  let name = page;
  if (mode === 'artifact') {
    html = html.replace(/^\s*<link rel="manifest"[^>]*>\n/m, '');
    if (page === 'index.html') {
      // claude.ai がつける外枠と重ならないよう、先頭の doctype・html・meta を外す
      html = html.replace(/^<!doctype html>\n<html lang="ja">\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n/, '');
      if (/^<!doctype/i.test(html)) { console.error('index.html の先頭の形が想定とちがいます'); process.exit(1); }
      name = 'start.html';
    }
  }
  fs.writeFileSync(path.join(out, name), html);
  written.push(name);
}
if (mode === 'site') {
  ROOT_FILES.forEach((f) => { fs.copyFileSync(path.join(ROOT, f), path.join(out, f)); written.push(f); });
  fs.mkdirSync(path.join(out, 'tools', 'apps-script'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', 'apps-script', 'Code.gs'), path.join(out, 'tools', 'apps-script', 'Code.gs'));
  written.push('tools/apps-script/Code.gs');
} else {
  ROOT_FILES.filter((f) => f.endsWith('.svg')).forEach((f) => { fs.copyFileSync(path.join(ROOT, f), path.join(out, f)); written.push(f); });
}
console.log(`${mode}: ${out}\n  ${written.join(' ')} ＋ ${DIRS.join('/ ')}/`);

/* ───────── Cloudflare Workers 用：site の一式を、1 つのプログラムに入れる ─────────
 * 置き場所（静的ファイル）と同じように配る：
 *   /・/index.html → 教科えらび、/kokugo・/kokugo.html → 国語（拡張子なしでも開ける）、ない場所は 404
 *   HTML は毎回たしかめる（no-cache）、ほかは 5 分間ブラウザに置く。ETag で、変わっていなければ 304 */
function buildWorker(dir) {
  const crypto = require('crypto');
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tokai-site-'));
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [__filename, 'site', tmp], { stdio: 'ignore' });
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8', '.gs': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
  const files = {};
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), r = `${rel}/${e.name}`;
      if (e.isDirectory()) { walk(p, r); continue; }
      const ext = path.extname(e.name).toLowerCase();
      if (!TYPES[ext]) { console.error(`配り方の決まっていない種類のファイルです: ${r}`); process.exit(1); }
      const body = fs.readFileSync(p, 'utf8');
      files[r] = { t: TYPES[ext], e: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`, b: body };
    }
  })(tmp, '');
  fs.rmSync(tmp, { recursive: true, force: true });
  const code = `// 東海中トレーニング：アプリのファイル一式を配るプログラム（tools/build.js worker で自動で作ったもの。直接は書きかえない）
const FILES = ${JSON.stringify(files)};
const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
function find(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return null; }
  if (p.endsWith('/')) p += 'index.html';
  if (FILES[p]) return p;
  if (!/\\.[a-z0-9]+$/i.test(p) && FILES[p + '.html']) return p + '.html';
  return null;
}
export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...HEADERS } });
    const url = new URL(request.url);
    const key = find(url.pathname);
    if (!key) return new Response('ページが見つかりません。', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...HEADERS } });
    const f = FILES[key];
    const h = { 'Content-Type': f.t, ETag: f.e, 'Cache-Control': f.t.startsWith('text/html') ? 'no-cache' : 'public, max-age=300', ...HEADERS };
    if (request.headers.get('If-None-Match') === f.e) return new Response(null, { status: 304, headers: h });
    return new Response(request.method === 'HEAD' ? null : f.b, { status: 200, headers: h });
  },
};
`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'worker.js'), code);
  console.log(`worker: ${path.join(dir, 'worker.js')}（${Object.keys(files).length} ファイル、${Math.round(code.length / 1024)} KB）`);
}
