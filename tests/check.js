// 問題データのチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['util.js', 'data/rika.js', 'data/seibutsu.js', 'data/chigaku.js', 'data/butsuri.js', 'data/kagaku.js', 'data/calc.js'].forEach(load);
const { RIKA, U } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 40) console.error('NG:', msg, JSON.stringify(q).slice(0, 200)); };

// 自動生成の計算問題：答えが有限小数・数として読める・難易度のしぼりこみが効く
const filters = [null, (lv) => lv >= 3, (lv) => lv <= 2];
let genKinds = 0;
for (const c of RIKA.cats) {
  const n = RIKA.bank.filter((b) => b.cat === c.id).length;
  if (n < 15) bad(`too few questions in ${c.id} (${n})`, {});
  for (const g of c.gens || []) {
    genKinds += g.size;
    for (const f of filters) {
      for (let i = 0; i < 800; i++) {
        let q;
        try { q = g(f); } catch (e) { bad(`${g.name} threw ${e.message}`, {}); break; }
        if (!q) break; // その難易度の問題がない
        if (f && !f(q.lv)) bad(`${g.name} level filter`, q);
        if (![2, 3].includes(q.lv)) bad(`${g.name} level`, q);
        if (q.type !== 'num' || !q.val || !q.q || !q.exp) bad(`${g.name} shape`, q);
        if (!U.isFiniteDecimal(q.val) || q.val.n <= 0) bad(`${g.name} answer not finite decimal / positive`, q);
        const back = U.parseAnswer(q.ans);
        if (!back || !U.req(back, q.val)) bad(`${g.name} ans text does not parse back`, q);
        if (/NaN|undefined|Infinity/.test(q.q + q.exp + q.ans)) bad(`${g.name} bad text`, q);
      }
    }
  }
}
// 単位つき・全角・分数の答えが読めるか
const ok = (s, n, d = 1) => { const r = U.parseAnswer(s); if (!r || !U.req(r, U.R(n, d))) bad(`parse ${s}`, {}); };
ok('120g', 120); ok('１２０', 120); ok('0.25g', 1, 4); ok('1/4', 1, 4); ok('42.5cm³', 85, 2); ok('78.4度', 392, 5);

const seen = new Set();
for (const b of RIKA.bank) {
  if (![2, 3].includes(b.lv)) bad('level (★ は出題しない)', b);
  if (b.n !== undefined) {
    if (typeof b.n !== 'number' || b.c || b.a || !U.parseAnswer(String(b.n))) bad('number answer', b);
  } else if (b.a) {
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
const nums = RIKA.bank.filter((b) => b.n !== undefined).length;
const counts = RIKA.cats.map((c) => `${c.name} ${RIKA.bank.filter((b) => b.cat === c.id).length}${c.gens ? `＋計算${c.gens.reduce((s, g) => s + g.size, 0)}種` : ''}`);
console.log(fail ? `${fail} failures` : 'all ok',
  `| 合計 ${RIKA.bank.length} 問（★★${lv[0]} ★★★${lv[1]}・記述 ${text}・すべて選ぶ ${multi}・数値 ${nums}）＋ 自動の計算問題 ${genKinds} 種\n${counts.join(' / ')}`);
process.exit(fail ? 1 : 0);
