// 問題生成のチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('util.js'); load('data/math.js'); load('data/science.js'); load('data/social.js');
const { U, MATH, SCIENCE, SOCIAL } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 30) console.error('NG:', msg, JSON.stringify(q).slice(0, 300)); };

for (const s of [MATH, SCIENCE, SOCIAL]) {
  for (const c of s.cats) {
    const bankN = (s.bank || []).filter((b) => b.cat === c.id).length;
    if (!c.gens && !bankN) bad(`empty category ${s.id}:${c.id}`, {});
    for (const g of c.gens || []) {
      for (let i = 0; i < 3000; i++) {
        let q;
        try { q = g(); } catch (e) { bad(`${g.name} threw ${e.message}`, {}); break; }
        const text = q.q + q.exp;
        if (/undefined|NaN|Infinity|null/.test(text)) bad(`${g.name} bad text`, q);
        if (q.choices) {
          if (!q.choices.includes(q.ans)) bad(`${g.name} answer not in choices`, q);
        } else {
          const a = q.ans;
          if (!a || !Number.isInteger(a.n) || !Number.isInteger(a.d) || a.d <= 0) bad(`${g.name} bad ans`, q);
          else if (a.n <= 0) bad(`${g.name} non-positive ans`, q);
          // 表示した答えをそのまま入力して正解になるか
          const shown = U.fmt(a, { fraction: q.fracAns }).replace(/\{(\d+)\/(\d+)\}/, (m, n, d, off) => (off ? 'と' : '') + n + '/' + d);
          const back = U.parseAnswer(shown);
          if (!back || !U.req(back, a)) bad(`${g.name} roundtrip ${shown}`, q);
        }
      }
    }
  }
  for (const b of s.bank || []) {
    if (new Set(b.c).size !== b.c.length) bad('duplicate choices', b);
    if (!s.cats.some((c) => c.id === b.cat)) bad('unknown cat', b);
  }
}
// 入力の解釈
const cases = [['12', [12, 1]], ['１２', [12, 1]], ['3/4', [3, 4]], ['1と1/2', [3, 2]], ['37.5', [75, 2]], ['12cm', [12, 1]], ['6/8', [3, 4]], ['0.5', [1, 2]]];
for (const [s, [n, d]] of cases) {
  const r = U.parseAnswer(s);
  if (!r || !U.req(r, U.R(n, d))) bad(`parse ${s}`, r);
}
if (U.parseAnswer('abc') !== null) bad('parse abc', {});
console.log(fail ? `${fail} failures` : 'all ok',
  `| bank: 理科 ${SCIENCE.bank.length} 問, 社会 ${SOCIAL.bank.length} 問`);
process.exit(fail ? 1 : 0);
