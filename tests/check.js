// 問題データのチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['util.js', 'data/rika.js', 'data/seibutsu.js', 'data/chigaku.js', 'data/butsuri.js', 'data/kagaku.js', 'data/jissen.js'].forEach(load);
const { RIKA, U } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 40) console.error('NG:', msg, JSON.stringify(q).slice(0, 200)); };

for (const c of RIKA.cats) {
  const n = RIKA.bank.filter((b) => b.cat === c.id).length;
  if (n < 15) bad(`too few questions in ${c.id} (${n})`, {});
}
const c_gens = () => RIKA.cats.some((c) => c.gens);
const seen = new Set();
for (const b of RIKA.bank) {
  if (![2, 3].includes(b.lv)) bad('level (★ は出題しない)', b);
  if (b.n !== undefined || c_gens()) bad('計算問題が残っている', b);
  if (b.a) {
    if (!Array.isArray(b.a) || !b.a.length || b.c) bad('text answer', b);
  } else if (b.ok) {
    if (!b.c || b.c.length < 4 || new Set(b.c).size !== b.c.length) bad('multi choices', b);
    if (!b.ok.length || !b.ok.every((x) => b.c.includes(x)) || b.ok.length === b.c.length) bad('multi answers', b);
  } else {
    if (!b.c || b.c.length !== 4) bad('choice count', b);
    else if (new Set(b.c).size !== 4) bad('duplicate choices', b);
  }
  if (!RIKA.cats.some((c) => c.id === b.cat)) bad('unknown cat', b);
  if (seen.has(b.q)) bad('duplicate question', b);
  seen.add(b.q);
}
const lv = [2, 3].map((l) => RIKA.bank.filter((b) => b.lv === l).length);
const text = RIKA.bank.filter((b) => b.a).length;
const multi = RIKA.bank.filter((b) => b.ok).length;
const counts = RIKA.cats.map((c) => `${c.name} ${RIKA.bank.filter((b) => b.cat === c.id).length}`);
console.log(fail ? `${fail} failures` : 'all ok',
  `| 合計 ${RIKA.bank.length} 問（★★${lv[0]} ★★★${lv[1]}・記述 ${text}・すべて選ぶ ${multi}）\n${counts.join(' / ')}`);
process.exit(fail ? 1 : 0);
