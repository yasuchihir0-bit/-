// 問題データのチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('util.js'); load('data/kokugo.js');
const { U, KOKUGO } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 30) console.error('NG:', msg, JSON.stringify(q).slice(0, 200)); };

const seen = new Set();
for (const c of KOKUGO.cats) {
  const n = KOKUGO.bank.filter((b) => b.cat === c.id).length;
  if (!c.gens && n < 5) bad(`too few questions in ${c.id} (${n})`, {});
  for (const g of c.gens || []) {
    for (let i = 0; i < 3000; i++) {
      const q = g();
      if (!q.choices.includes(q.ans)) bad(`${g.name} answer not in choices`, q);
      if (new Set(q.choices).size !== q.choices.length) bad(`${g.name} duplicate choices`, q);
      if (q.choices.length !== 4) bad(`${g.name} choice count`, q);
      if (/undefined|NaN/.test(q.q + q.exp)) bad(`${g.name} bad text`, q);
    }
  }
}
for (const b of KOKUGO.bank) {
  if (b.c.length !== 4) bad('choice count', b);
  if (new Set(b.c).size !== b.c.length) bad('duplicate choices', b);
  if (!KOKUGO.cats.some((c) => c.id === b.cat)) bad('unknown cat', b);
  if (seen.has(b.q)) bad('duplicate question', b);
  seen.add(b.q);
}
const counts = KOKUGO.cats.map((c) => `${c.name} ${c.gens ? '自動' : KOKUGO.bank.filter((b) => b.cat === c.id).length}`);
console.log(fail ? `${fail} failures` : 'all ok', `| 合計 ${KOKUGO.bank.length} 問 + 自動生成\n${counts.join(' / ')}`);
process.exit(fail ? 1 : 0);
