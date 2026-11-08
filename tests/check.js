// 問題データのチェック: node tests/check.js
const path = require('path');
const load = (f) => require(path.join(__dirname, '..', 'js', f));
load('util.js');
load('data/kokugo.js'); load('data/kokugo2.js'); load('data/kokugo3.js'); load('data/kokugo4.js'); load('data/filter.js');
load('data/shakai.js'); load('data/shakai2.js'); load('data/shakai3.js');
const { KOKUGO, SHAKAI } = globalThis;
let fail = 0;
const bad = (msg, q) => { fail++; if (fail < 40) console.error('NG:', msg, JSON.stringify(q).slice(0, 160)); };

// 対義語・類義語：同じ言葉が二度出てこないか
for (const list of [KOKUGO.ANTONYMS, KOKUGO.SYNONYMS]) {
  if (list.some((p) => (p[2] || 1) < 2)) bad('★ の対義語・類義語が残っている', {});
  const words = list.flatMap((p) => [p[0], p[1]]);
  const dup = words.filter((w, i) => words.indexOf(w) !== i);
  if (dup.length) bad('duplicate pair words', dup);
}
// 年代の並べかえ：年が重ならないか
{
  const ys = SHAKAI.EVENTS.map((e) => e[0]);
  const dup = ys.filter((y, i) => ys.indexOf(y) !== i);
  if (dup.length) bad('duplicate event years', dup);
  const ts = SHAKAI.EVENTS.map((e) => e[1]);
  if (new Set(ts).size !== ts.length) bad('duplicate event text', {});
}

function checkSubject(S) {
  const filters = [null, (lv) => lv >= 3];
  if (new Set(S.cats.map((c) => c.id)).size !== S.cats.length) bad(`${S.id}: duplicate cat id`, {});
  for (const c of S.cats) {
    if (!/^[a-z]+$/.test(c.id)) bad(`${S.id}: cat id must be a-z`, c.id);
    const n = S.bank.filter((b) => b.cat === c.id).length;
    if (!c.gens && n < 8) bad(`${S.id}: too few questions in ${c.id} (${n})`, {});
    for (const g of c.gens || []) {
      for (const f of filters) {
        for (let i = 0; i < 1500; i++) {
          const q = g(f);
          if (!q) { bad(`${g.name} returned null`, {}); break; }
          if (f && !f(q.lv)) bad(`${g.name} level filter`, q);
          if (![2, 3].includes(q.lv)) bad(`${g.name} level`, q);
          if (!q.choices.includes(q.ans)) bad(`${g.name} answer not in choices`, q);
          if (new Set(q.choices).size !== 4) bad(`${g.name} choices`, q);
        }
      }
    }
  }
  const seen = new Set();
  for (const b of S.bank) {
    if (![2, 3].includes(b.lv)) bad(`${S.id}: level (★ は出題しない)`, b);
    if (!b.q || typeof b.exp !== 'string') bad(`${S.id}: question/exp`, b);
    if (b.a) {
      if (!Array.isArray(b.a) || !b.a.length || b.c || b.a.some((x) => !String(x).trim())) bad('text answer', b);
    } else if (b.ok) {
      if (!b.c || b.c.length < 4 || new Set(b.c).size !== b.c.length) bad('multi choices', b);
      if (!b.ok.length || !b.ok.every((x) => b.c.includes(x)) || b.ok.length === b.c.length) bad('multi answers', b);
      if (!/すべて選びなさい。$/.test(b.q)) bad('multi question should end with すべて選びなさい。', b);
    } else {
      if (!b.c || b.c.length !== 4) bad('choice count', b);
      else if (new Set(b.c).size !== 4) bad('duplicate choices', b);
    }
    if (!S.cats.some((c) => c.id === b.cat)) bad('unknown cat', b);
    const key = b.q + '|' + (b.a ? b.a[0] : b.ok ? b.ok.join('／') : b.c[0]);
    if (seen.has(key)) bad('duplicate question', b);
    seen.add(key);
  }
  if (S.app) {
    for (const cid of S.app.topFocus || []) if (!S.cats.some((c) => c.id === cid)) bad(`${S.id}: unknown topFocus ${cid}`, {});
  }
  const lv = [2, 3].map((l) => S.bank.filter((b) => b.lv === l).length);
  const text = S.bank.filter((b) => b.a).length;
  const multi = S.bank.filter((b) => b.ok).length;
  const counts = S.cats.map((c) => `${c.name} ${c.gens ? `自動(${c.size ? c.size() : KOKUGO.ANTONYMS.length + KOKUGO.SYNONYMS.length}組)` : S.bank.filter((b) => b.cat === c.id).length}`);
  console.log(`【${S.name}】合計 ${S.bank.length} 問（★★${lv[0]} ★★★${lv[1]}・記述 ${text}・すべて選ぶ ${multi}）\n${counts.join(' / ')}`);
}

checkSubject(KOKUGO);
checkSubject(SHAKAI);
console.log(fail ? `${fail} failures` : 'all ok');
process.exit(fail ? 1 : 0);
