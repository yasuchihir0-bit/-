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
  eq('wrong secret', E.post({ secret: 'x', ping: true }), { ok: false, err: 'secret', ver: 3 });
  eq('ping', E.post({ secret: SEC, ping: true }), { ok: true, ping: true, can: { write: true, read: true }, ver: 3 });
  eq('bad json', E.post('{oops'), { ok: false, err: 'format', ver: 3 });
  const D = makeEnv(null); // 合言葉を書きかえていない（初期のまま）
  eq('placeholder refused', D.post({ secret: 'ここを合言葉に書きかえる', ping: true }), { ok: false, err: 'secret', ver: 3 });
  const S = makeEnv('short');
  eq('short refused', S.post({ secret: 'short', ping: true }), { ok: false, err: 'secret', ver: 3 });
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
  eq('bad dev refused', E.post({ secret: SEC, dev: '../x', subj: 'shakai', rows: [] }), { ok: false, err: 'format', ver: 3 });
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
  eq('read needs secret', E.post({ secret: 'nope', read: true, subj: 'shakai' }), { ok: false, err: 'secret', ver: 3 });
  eq('read empty', E.post({ secret: SEC, read: true, subj: 'kokugo' }), { ok: true, rows: [], days: {}, daysBy: {}, kids: [], devs: 0, at: '', ver: 3 });
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
  eq('write secret cannot read', E.post({ secret: W, read: true, subj: 'shakai' }), { ok: false, err: 'secret', ver: 3 });
  eq('read secret cannot write', E.post({ secret: RD, ...base, rows: [row(1)] }), { ok: false, err: 'readonly', ver: 3 });
  eq('read secret reads', E.post({ secret: RD, read: true, subj: 'shakai' }).rows.length, 1);
  eq('nothing written by read secret', E.sheets['まちがい'].getLastRow(), 2);
  // 読む用が短い・書く用と同じ：設定まちがいとして、すべて断る
  eq('short read secret = config error', makeEnv(W, 'short').post({ secret: W, ping: true }), { ok: false, err: 'config', ver: 3 });
  eq('same read secret = config error', makeEnv(W, W).post({ secret: W, ping: true }), { ok: false, err: 'config', ver: 3 });
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

// 6) ごほうびのしくみ：ポイント・ボーナス・バッジ・申請・承認・却下・応援
{
  const W = 'write-secret-fam1', RD = 'read-secret-fam22';
  const E = makeEnv(W, RD);
  const ev = (s, o = {}) => ({ s, d: '2026-11-17', subj: 'shakai', cat: 'tokai', catName: '東海地方', ok: true, lv: 2, sec: 10, ...o });
  const send = (events, dev = 'kidaaaa1', label = 'たろう') => E.post({ secret: W, dev, subj: 'shakai', subjName: '社会', label, rows: [], events });
  // 10 問（正解 7）：10×2 + 7 = 27pt、はじめの一歩 +10
  let r = send(Array.from({ length: 10 }, (_, i) => ev(i, { ok: i < 7 })));
  eq('points for 10 answers', [r.fam.gained, r.evAcked, r.fam.state.balance], [37, 9, 37]);
  eq('first badge', r.fam.awards.filter((a) => a.reason === 'badge').map((a) => a.id), ['first']);
  // 同じ記録をもう一度送っても増えない
  r = send(Array.from({ length: 10 }, (_, i) => ev(i, { ok: i < 7 })));
  eq('resend counts nothing', [r.fam.gained, r.fam.state.balance], [0, 37]);
  // さらに 10 問（全問正解）で 1 日 20 問：+30 +25
  r = send(Array.from({ length: 10 }, (_, i) => ev(10 + i)));
  eq('day bonus', [r.fam.gained, r.fam.state.balance, r.fam.awards.some((a) => a.reason === 'bonus')], [55, 92, true]);
  // ボーナスは 1 日 1 回
  r = send([ev(20)]); eq('bonus once a day', r.fam.gained, 3);
  // 3 教科の日・復習ゼロ（その日に 1 回）
  r = send([ev(21, { subj: 'kokugo', cat: 'imi' }), ev(22, { subj: 'rika', cat: 'denki' }), { s: 23, d: '2026-11-17', k: 'review' }, { s: 24, d: '2026-11-17', k: 'review' }]);
  eq('all3 + review badge once', r.fam.awards.filter((a) => a.reason === 'badge').map((a) => a.id).sort(), ['all3', 'review']);
  eq('badge counts in state', r.fam.state.badges.filter((b) => b.count).map((b) => b.id).sort(), ['all3', 'first', 'review']);
  // 連続日数：翌日と翌々日 → 3 日連続
  send([ev(25, { d: '2026-11-18' })]);
  r = send([ev(26, { d: '2026-11-19' }), { s: 27, d: '2026-11-19', k: 'review' }]);
  eq('streak3 + review again next day', r.fam.awards.filter((a) => a.reason === 'badge').map((a) => a.id).sort(), ['review', 'streak3']);
  const bal = r.fam.state.balance;
  // ごほうび：保護者が登録 → お子さんが申請 → 却下で返却 → 申請 → 承認
  const P = (o) => E.post({ secret: RD, ...o });
  eq('child cannot add rewards', E.post({ secret: W, act: 'reward_add', name: 'x', cost: 1 }).err, 'secret');
  const id1 = P({ act: 'reward_add', emoji: '🎮', name: 'ゲーム30分', cost: 100 }).id;
  const id2 = P({ act: 'reward_add', emoji: '🍰', name: 'ケーキ', cost: 100000 }).id;
  eq('reward ids', [id1, id2], [1, 2]);
  const C = (o) => E.post({ secret: W, dev: 'kidaaaa1', label: 'たろう', ...o });
  eq('child sees rewards', C({ act: 'state' }).state.rewards.map((x) => x.name), ['ゲーム30分', 'ケーキ']);
  eq('not enough points', C({ act: 'request', rewardId: id2 }).err, 'points');
  r = C({ act: 'request', rewardId: id1 });
  eq('request holds points', [r.ok, r.state.balance, r.state.requests[0].status], [true, bal - 100, 'pending']);
  eq('parent sees pending', P({ act: 'summary', today: '2026-11-19' }).pending, 1);
  eq('reject refunds', [P({ act: 'decide', id: 1, approve: false, note: 'またこんど' }).ok, C({ act: 'state' }).state.balance], [true, bal]);
  eq('cannot decide twice', P({ act: 'decide', id: 1, approve: true }).err, 'done');
  C({ act: 'request', rewardId: id1 });
  eq('approve keeps points spent', [P({ act: 'decide', id: 2, approve: true }).ok, C({ act: 'state' }).state.balance, C({ act: 'state' }).state.requests[0].status], [true, bal - 100, 'approved']);
  eq('child cannot approve', C({ act: 'decide', id: 2, approve: true }).err, 'secret');
  // 非表示にしたごほうびは、お子さんに出ない・申請できない
  P({ act: 'reward_update', id: id1, hidden: true });
  eq('hidden reward', [C({ act: 'state' }).state.rewards.map((x) => x.id), C({ act: 'request', rewardId: id1 }).err], [[2], 'notfound']);
  // 応援：全員あて・ひとりあて、読んだら消える
  P({ act: 'send', to: '*', stamp: '💮 よくできました', text: 'がんばってるね' });
  P({ act: 'send', to: 'kidbbbb2', stamp: '', text: 'はなこへ' });
  let st = C({ act: 'state' }).state;
  eq('child sees only own/all messages', st.messages.map((m) => m.text), ['がんばってるね']);
  st = C({ act: 'read_msgs', ids: [st.messages[0].id] }).state;
  eq('read message disappears', st.messages.length, 0);
  eq('parent sees read status', P({ act: 'messages' }).messages.find((m) => m.to === '*').readBy, ['kidaaaa1']);
  // 保護者の「ようす」
  const sm = P({ act: 'summary', today: '2026-11-19' });
  eq('summary today', [sm.today.solved, sm.streak, sm.week.solved], [1, 3, 25]);
  eq('kids list', P({ act: 'kids' }).kids.map((k) => [k.dev, k.label]), [['kidaaaa1', 'たろう']]);
  eq('ledger newest first', P({ act: 'ledger', limit: 3 }).ledger.length, 3);
  // まとめ取り：1 回で、ようす・一覧・申請などを返す（ひとつずつ取ったときと同じ中身）
  const m = P({ act: 'multi', parts: [{ act: 'kids' }, { act: 'summary', today: '2026-11-19' }, { act: 'requests', status: 'all' }, { act: 'rewards' }, { act: 'decide', id: 2 }] });
  eq('multi same as single', [m.ok, JSON.stringify(m.results[0]) === JSON.stringify(Object.assign({}, P({ act: 'kids' }), { ver: undefined })), m.results[1].today.solved, m.results[2].requests.length, m.results[3].rewards.length], [true, true, 1, 2, 2]);
  eq('multi refuses writes', m.results[4], { ok: false, err: 'format' });
  eq('multi needs parent secret', C({ act: 'multi', parts: [{ act: 'kids' }] }).err, 'secret');
  // 端末を外す → その端末の記録は受け付けない
  P({ act: 'block', kid: 'kidaaaa1', block: true });
  eq('blocked device refused', [send([ev(30)]).err, C({ act: 'state' }).err], ['blocked', 'blocked']);
  P({ act: 'block', kid: 'kidaaaa1', block: false });
  eq('unblocked', send([ev(30)]).ok, true);
  // 合言葉を分けていない受け口では、保護者の操作はできない（お子さんの端末から承認できてしまうため）
  const single = makeEnv('only-one-secret-123');
  eq('parent actions need split secrets', single.post({ secret: 'only-one-secret-123', act: 'rewards' }).err, 'need_split');
  // 2 人目のお子さんは、別にポイントがたまる
  r = send([ev(0, { d: '2026-11-19' })], 'kidbbbb2', 'はなこ');
  eq('second child separate balance', [r.fam.state.balance, r.fam.state.messages.map((m) => m.text)], [13, ['はなこへ', 'がんばってるね']]);
}

console.log(fail ? `${fail} failures` : 'apps-script: all ok');
process.exit(fail ? 1 : 0);
