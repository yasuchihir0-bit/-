/* 共通ユーティリティ：乱数・分数（有理数）・入力の解釈・表示 */
(function (global) {
  'use strict';

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const gcd = (a, b) => {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  };
  const lcm = (a, b) => (a / gcd(a, b)) * b;

  /* 有理数 {n, d}（d > 0、既約） */
  const R = (n, d = 1) => {
    if (d === 0) throw new Error('division by zero');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  };
  const radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
  const rsub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
  const rmul = (a, b) => R(a.n * b.n, a.d * b.d);
  const rdiv = (a, b) => R(a.n * b.d, a.d * b.n);
  const req = (a, b) => a.n * b.d === b.n * a.d;

  /* 分母が 2 と 5 だけでできている（有限小数になる）か */
  const isFiniteDecimal = (r) => {
    let d = r.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  };

  /* 小数を有理数に（例: 3.14 → 157/50） */
  const fromDecimal = (s) => {
    s = String(s);
    const neg = s.startsWith('-');
    if (neg) s = s.slice(1);
    const [ip, fp = ''] = s.split('.');
    const d = Math.pow(10, fp.length);
    const n = parseInt(ip || '0', 10) * d + (fp ? parseInt(fp, 10) : 0);
    return R(neg ? -n : n, d);
  };

  /* 表示用：整数・有限小数はそのまま、それ以外は {a/b} 記法（帯分数は a{b/c}） */
  const fmt = (r, opt = {}) => {
    if (r.d === 1) return String(r.n);
    if (!opt.fraction && isFiniteDecimal(r)) {
      return String(+(r.n / r.d).toFixed(10));
    }
    const neg = r.n < 0;
    const n = Math.abs(r.n);
    const whole = Math.floor(n / r.d);
    const rest = n % r.d;
    const s = whole && !opt.improper ? `${whole}{${rest}/${r.d}}` : `{${n}/${r.d}}`;
    return (neg ? '-' : '') + s;
  };
  /* 数値（JS の number）を表示用に整形 */
  const num = (x) => String(+x.toFixed(10));

  /* 入力文字列 → 有理数（解釈できなければ null） */
  const toHalf = (s) => String(s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, '.')
    .replace(/[／÷]/g, '/')
    .replace(/[－ー−]/g, '-')
    .replace(/，|,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parseAnswer = (raw) => {
    let s = toHalf(raw);
    // 末尾の単位などをとりのぞく（数字・記号以外）
    s = s.replace(/[^\d./と+\- ]+$/u, '').trim();
    let m;
    if ((m = s.match(/^(-?)(\d+(?:\.\d+)?)$/))) return fromDecimal(m[1] + m[2]);
    if ((m = s.match(/^(-?)\.(\d+)$/))) return fromDecimal(m[1] + '0.' + m[2]);
    if ((m = s.match(/^(-?)(\d+)\/(\d+)$/))) {
      if (+m[3] === 0) return null;
      return R((m[1] ? -1 : 1) * +m[2], +m[3]);
    }
    if ((m = s.match(/^(\d+)\s*(?:と|\+| )\s*(\d+)\/(\d+)$/))) {
      if (+m[3] === 0) return null;
      return R(+m[1] * +m[3] + +m[2], +m[3]);
    }
    return null;
  };

  /* {a/b} 記法 → HTML の分数表示。テキストは先にエスケープする */
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const rich = (s) => esc(s).replace(/\{(-?\d+(?:\.\d+)?|□)\/(\d+(?:\.\d+)?|□)\}/g,
    '<span class="frac"><span class="fn">$1</span><span class="fd">$2</span></span>');

  global.U = {
    ri, pick, shuffle, gcd, lcm,
    R, radd, rsub, rmul, rdiv, req, isFiniteDecimal, fromDecimal,
    fmt, num, toHalf, parseAnswer, esc, rich,
  };
})(typeof window !== 'undefined' ? window : globalThis);
