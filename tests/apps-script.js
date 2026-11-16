// 保護者の端末で見るための「受け口」（tools/apps-script/Code.gs）のテスト：node tests/apps-script.js
// Google の部品は tests/gas-mock.js で、メモリ上の簡単なものに置きかえています。
const { makeEnv } = require('./gas-mock.js');

const vm = require('vm');
let fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.error('NG:', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } };
const SEC = 'test-secret-1234';
const row = (n, o = {}) => ({ n, d: '2026-11-16', t: '10:0' + (n % 10), cat: 'tokai', catName: '東海地方', m: 'quiz', g: 'ng', q: `問題${n}`, ans: `正解${n}`, given: `答え${n}`, ...o });

// 1) 合言葉
{
  const E = makeEnv(SEC);
  eq('wrong secret', E.post({ secret: 'x', ping: true }), { ok: false, err: 'secret', ver: 1 });
  eq('ping', E.post({ secret: SEC, ping: true }), { ok: true, ping: true, can: { write: true, read: true }, ver: 1 });
  eq('bad json', E.post('{oops'), { ok: false, err: 'format', ver: 1 });
  const D = makeEnv(null); // 合言葉を書きかえていない（初期のまま）
  eq('placeholder refused', D.post({ secret: 'ここを合言葉に書きかえる', ping: true }), { ok: false, err: 'secret', ver: 1 });
  const S = makeEnv('short');
  eq('short refused', S.post({ secret: 'short', ping: true }), { ok: false, err: 'secret', ver: 1 });
  eq('doGet reveals nothing', vm.runInContext('doGet', E.ctx)().s.includes('動いています'), true);
}

// 2) 書く：二重に書かない／順番／わからない／計算式にならない
{
  const E = makeEnv(SEC);
  const base = { secret: SEC, dev: 'devchild1', subj: 'shakai', subjName: '社会' };
  let r = E.post({ ...base, rows: [row(0), row(1, { given: null }), row(2, { g: 'hard', m: 'essay', q: '=HYPERLINK("http://x")' })], days: { '2026-11-16': { n: 10, ok: 7, cards: 0 } } });
  eq('first write', { ok: r.ok, acked: r.acked, added: r.added }, { ok: true, acked: 2, added: 3 });
  const sh = E.sheets['まちがい'];
  eq('rows+header', sh.getLastRow(), 4);
  eq('no-answer flag', [sh.data[2][14], sh.data[2][8]], ['1', '（わからないを選んだ）']);
  eq('hard label', sh.data[3][9], '△ おしい');
  eq('essay mode label', sh.data[3][5], '記述');
  const textFmt = E.formats.filter((f) => f.sheet === 'まちがい' && f.f === '@');
  eq('text format covers question column of new rows', textFmt.some((f) => f.c <= 7 && f.c + f.nc - 1 >= 7 && f.r <= 4 && f.r + f.nr - 1 >= 4), true);
  r = E.post({ ...base, rows: [row(0), row(1), row(2), row(3)] });
  eq('resend is idempotent', { acked: r.acked, added: r.added, rows: sh.getLastRow() }, { acked: 3, added: 1, rows: 5 });
  r = E.post({ ...base, rows: [row(3)] });
  eq('again nothing', { acked: r.acked, added: r.added, rows: sh.getLastRow() }, { acked: 3, added: 0, rows: 5 });
  // 学習量は上書き
  E.post({ ...base, rows: [], days: { '2026-11-16': { n: 12, ok: 9, cards: 1 }, '2026-11-17': { n: 5, ok: 5, cards: 0 } } });
  const dsh = E.sheets['学習量'];
  eq('days upsert', [dsh.getLastRow(), dsh.data[1].slice(3), dsh.data[2].slice(2)], [3, [12, 9, 1, ''], ['2026-11-17', 5, 5, 0, '']]);
  // 別の端末は、番号が重なっても別あつかい
  r = E.post({ secret: SEC, dev: 'devchild2', subj: 'shakai', subjName: '社会', rows: [row(0, { q: '別の端末の問題' })] });
  eq('other device same n', { added: r.added, rows: sh.getLastRow() }, { added: 1, rows: 6 });
  eq('bad dev refused', E.post({ secret: SEC, dev: '../x', subj: 'shakai', rows: [] }), { ok: false, err: 'format', ver: 1 });
}

// 3) 読む：教科・端末のしぼりこみ、わからない、学習量の合計
{
  const E = makeEnv(SEC);
  const w = (dev, subj, rows, days) => E.post({ secret: SEC, dev, subj, subjName: subj, rows, days });
  w('devchild1', 'shakai', [row(0), row(1, { given: null }), row(2, { g: 'hard', m: 'essay' })], { '2026-11-16': { n: 10, ok: 7, cards: 0 } });
  w('devchild2', 'shakai', [row(0, { q: '二台目の問題' })], { '2026-11-16': { n: 4, ok: 1, cards: 2 } });
  w('devchild1', 'rika', [row(0, { q: '理科の問題', cat: 'denki' })]);
  let r = E.post({ secret: SEC, read: true, subj: 'shakai', exclude: 'parentdev' });
  eq('read count', [r.ok, r.rows.length, r.devs], [true, 4, 2]);
  eq('read excludes other subject', r.rows.some((x) => x.q === '理科の問題'), false);
  const noGiven = r.rows.find((x) => x.n === 1);
  eq('null given restored', [noGiven.given, noGiven.cat, noGiven.m, noGiven.g, noGiven.dev], [null, 'tokai', 'quiz', 'ng', 'devchild1']);
  const hard = r.rows.find((x) => x.n === 2);
  eq('hard/essay restored', [hard.g, hard.m, hard.given], ['hard', 'essay', '答え2']);
  eq('days summed across devices', r.days['2026-11-16'], { n: 14, ok: 8, cards: 2 });
  eq('at is ISO', /^\d{4}-\d{2}-\d{2}T/.test(r.at), true);
  r = E.post({ secret: SEC, read: true, subj: 'shakai', exclude: 'devchild1' });
  eq('exclude own device', [r.rows.length, r.rows[0].q, r.devs], [1, '二台目の問題', 1]);
  eq('read needs secret', E.post({ secret: 'nope', read: true, subj: 'shakai' }), { ok: false, err: 'secret', ver: 1 });
  eq('read empty', E.post({ secret: SEC, read: true, subj: 'kokugo' }), { ok: true, rows: [], days: {}, daysBy: {}, kids: [], devs: 0, at: '', ver: 1 });
  // 件数の上限
  const many = Array.from({ length: 200 }, (_, i) => row(100 + i));
  for (let k = 0; k < 4; k++) w('devbig001', 'rika', many.map((x, i) => ({ ...x, n: 1000 + k * 200 + i })));
  r = E.post({ secret: SEC, read: true, subj: 'rika', exclude: 'parentdev' });
  eq('read limit 600, newest kept', [r.rows.length, r.rows[r.rows.length - 1].n], [600, 1799]);
}

// 4) 書く用と読む用の合言葉を分ける
{
  const W = 'write-secret-12345', RD = 'read-secret-67890';
  const E = makeEnv(W, RD);
  const base = { dev: 'devchild1', subj: 'shakai', subjName: '社会' };
  eq('write secret can write only', E.post({ secret: W, ping: true }).can, { write: true, read: false });
  eq('read secret can read only', E.post({ secret: RD, ping: true }).can, { write: false, read: true });
  eq('write ok', E.post({ secret: W, ...base, rows: [row(0)] }).added, 1);
  eq('write secret cannot read', E.post({ secret: W, read: true, subj: 'shakai' }), { ok: false, err: 'secret', ver: 1 });
  eq('read secret cannot write', E.post({ secret: RD, ...base, rows: [row(1)] }), { ok: false, err: 'readonly', ver: 1 });
  eq('read secret reads', E.post({ secret: RD, read: true, subj: 'shakai' }).rows.length, 1);
  eq('nothing written by read secret', E.sheets['まちがい'].getLastRow(), 2);
  // 読む用が短い・書く用と同じ：設定まちがいとして、すべて断る
  eq('short read secret = config error', makeEnv(W, 'short').post({ secret: W, ping: true }), { ok: false, err: 'config', ver: 1 });
  eq('same read secret = config error', makeEnv(W, W).post({ secret: W, ping: true }), { ok: false, err: 'config', ver: 1 });
}

// 5) お子さんの呼び名と、お子さんごとの学習量
{
  const E = makeEnv(SEC);
  const w = (dev, label, rows, days) => E.post({ secret: SEC, dev, subj: 'shakai', subjName: '社会', label, rows, days });
  w('devaaaa1', 'たろう', [row(0)], { '2026-11-16': { n: 10, ok: 8, cards: 0 } });
  w('devbbbb2', 'はなこ', [row(0, { q: 'はなこの問題' })], { '2026-11-16': { n: 6, ok: 2, cards: 1 } });
  w('devcccc3', '', [], { '2026-11-17': { n: 3, ok: 3, cards: 0 } }); // 呼び名なし・まちがいなし
  const r = E.post({ secret: SEC, read: true, subj: 'shakai', exclude: 'parentdev' });
  eq('kids', r.kids, [{ dev: 'devaaaa1', label: 'たろう' }, { dev: 'devbbbb2', label: 'はなこ' }, { dev: 'devcccc3', label: '' }]);
  eq('daysBy', r.daysBy, { devaaaa1: { '2026-11-16': { n: 10, ok: 8, cards: 0 } }, devbbbb2: { '2026-11-16': { n: 6, ok: 2, cards: 1 } }, devcccc3: { '2026-11-17': { n: 3, ok: 3, cards: 0 } } });
  eq('days total', r.days['2026-11-16'], { n: 16, ok: 10, cards: 1 });
  eq('label written to mistakes sheet', E.sheets['まちがい'].data[1][15], 'たろう');
  // 呼び名を変えたら、学習量の行にもあとから反映される
  w('devaaaa1', 'たろう君', [], { '2026-11-16': { n: 11, ok: 9, cards: 0 } });
  eq('label updated', E.post({ secret: SEC, read: true, subj: 'shakai' }).kids[0], { dev: 'devaaaa1', label: 'たろう君' });
}

console.log(fail ? `${fail} failures` : 'apps-script: all ok');
process.exit(fail ? 1 : 0);
