#!/usr/bin/env node
/* 公開用のファイル一式をつくる
 *
 *   node tools/build.js site [出力先]       … 置き場所（Netlify など）に置く一式。出力先の省略時は dist/
 *   node tools/build.js artifact <出力先>   … claude.ai の公開ページ用の一式（ページは start.html）
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
if (!['site', 'artifact'].includes(mode)) {
  console.error('使い方: node tools/build.js site [出力先] ／ node tools/build.js artifact <出力先>');
  process.exit(1);
}
const out = path.resolve(process.argv[3] || (mode === 'site' ? path.join(ROOT, 'dist') : ''));
if (!process.argv[3] && mode === 'artifact') { console.error('artifact には出力先が必要です'); process.exit(1); }
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
