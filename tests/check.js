// 問題データのチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('util.js'); load('data/kokugo.js'); load('data/kokugo2.js'); load('data/kokugo3.js'); load('data/kokugo4.js');
const { KOKUGO } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 40) console.error('NG:', msg, JSON.stringify(q).slice(0, 160)); };

// 対義語・類義語：同じ言葉が二度出てこないか
for (const list of [KOKUGO.ANTONYMS, KOKUGO.SYNONYMS]) {
  const words = list.flatMap((p) => [p[0], p[1]]);
  const dup = words.filter((w, i) => words.indexOf(w) !== i);
  if (dup.length) bad('duplicate pair words', dup);
}
const filters = [null, (lv) => lv <= 2, (lv) => lv >= 2, (lv) => lv >= 3];
for (const c of KOKUGO.cats) {
  const n = KOKUGO.bank.filter((b) => b.cat === c.id).length;
  if (!c.gens && n < 8) bad(`too few questions in ${c.id} (${n})`, {});
  for (const g of c.gens || []) {
    for (const f of filters) {
      for (let i = 0; i < 1500; i++) {
        const q = g(f);
        if (!q) { bad(`${g.name} returned null`, {}); break; }
        if (f && !f(q.lv)) bad(`${g.name} level filter`, q);
        if (!q.choices.includes(q.ans)) bad(`${g.name} answer not in choices`, q);
        if (new Set(q.choices).size !== 4) bad(`${g.name} choices`, q);
      }
    }
  }
}
const seen = new Set();
for (const b of KOKUGO.bank) {
  if (![1, 2, 3].includes(b.lv)) bad('level', b);
  if (b.a) {
    if (!Array.isArray(b.a) || !b.a.length || b.c) bad('text answer', b);
  } else if (b.ok) {
    if (!b.c || b.c.length < 4 || new Set(b.c).size !== b.c.length) bad('multi choices', b);
    if (!b.ok.length || !b.ok.every((x) => b.c.includes(x)) || b.ok.length === b.c.length) bad('multi answers', b);
  } else {
    if (!b.c || b.c.length !== 4) bad('choice count', b);
    else if (new Set(b.c).size !== 4) bad('duplicate choices', b);
  }
  if (!KOKUGO.cats.some((c) => c.id === b.cat)) bad('unknown cat', b);
  const key = b.q + '|' + (b.a ? b.a[0] : b.ok ? b.ok.join('／') : b.c[0]);
  if (seen.has(key)) bad('duplicate question', b);
  seen.add(key);
}
const lv = [1, 2, 3].map((l) => KOKUGO.bank.filter((b) => b.lv === l).length);
const text = KOKUGO.bank.filter((b) => b.a).length;
const multi = KOKUGO.bank.filter((b) => b.ok).length;
const counts = KOKUGO.cats.map((c) => `${c.name} ${c.gens ? `自動(${KOKUGO.ANTONYMS.length + KOKUGO.SYNONYMS.length}組)` : KOKUGO.bank.filter((b) => b.cat === c.id).length}`);
console.log(fail ? `${fail} failures` : 'all ok',
  `| 合計 ${KOKUGO.bank.length} 問（★${lv[0]} ★★${lv[1]} ★★★${lv[2]}・記述 ${text}・すべて選ぶ ${multi}）\n${counts.join(' / ')}`);
process.exit(fail ? 1 : 0);
