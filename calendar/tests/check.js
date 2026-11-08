// ロジックとプリセットのチェック: node calendar/tests/check.js
const path = require('path');
require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'schools.js'));
const { SCHED: S, SCHOOL_PRESETS: P } = globalThis;
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.error('NG:', msg); } };

// プリセット：日付の形式と順番（出願 → 試験 → 発表 → 手続き）
const order = ['apply_start', 'apply_end', 'exam', 'result', 'proc', 'pay', 'brief']; // 書類必着は出願締切より前のこともある
for (const p of P) {
  ok(p.id && p.school && p.pref && p.url && Array.isArray(p.sources), `preset fields ${p.id}`);
  ok(['愛知', '岐阜', '三重'].includes(p.pref) && ['共学', '男子', '女子'].includes(p.gender), `pref/gender ${p.id}`);
  ok(p.verified === (Object.keys(p.events).length > 0 && Object.values(p.events).every((e) => !e.third)), `verified flag ${p.id}`);
  if (p.events.docs && p.events.exam) ok(p.events.docs.date <= p.events.exam.date, `${p.id}: docs after exam`);
  for (const [t, e] of Object.entries(p.events)) {
    ok(S.TYPE[t], `${p.id}: unknown type ${t}`);
    ok(S.parseDate(e.date), `${p.id}.${t}: bad date ${e.date}`);
    ok(!e.time || /^\d{2}:\d{2}$/.test(e.time), `${p.id}.${t}: bad time`);
  }
  const ds = order.filter((t) => p.events[t]).map((t) => p.events[t].date);
  ok(ds.every((d, i) => i === 0 || ds[i - 1] <= d), `${p.id}: dates out of order ${ds}`);
}

const today = new Date(2027, 0, 10);
ok(S.daysUntil('2027-01-13', today) === 3, 'daysUntil');
ok(S.fmtDate('2027-02-06') === '2月6日(土)', 'fmtDate ' + S.fmtDate('2027-02-06'));
ok(S.countdown(0) === '今日' && S.countdown(1) === '明日' && S.countdown(5) === 'あと5日', 'countdown');

ok(new Set(P.map((p) => p.id)).size === P.length, 'unique ids');
ok(['tokai', 'aichi', 'shukutoku'].every((id) => P.some((p) => p.id === id)), '以前の id が残っている（更新ボタン用）');
const pick = ['tokai', 'aichi', 'shukutoku'];
const schools = P.filter((p) => pick.includes(p.id)).map((p) => ({ ...p, name: p.school, events: JSON.parse(JSON.stringify(p.events)) }));
const ev = S.buildEvents(schools);
ok(ev.every((e, i) => i === 0 || ev[i - 1].date <= e.date), 'sorted');
const up = S.upcoming(ev, new Date(2027, 0, 25), {});
ok(up.some((e) => e.key === 'aichi:apply_end' && S.urgency(e) === 'late'), '過ぎた未完了タスクは遅れ');
ok(!up.some((e) => e.key === 'aichi:exam'), '過ぎた試験は表示しない');
ok(!S.upcoming(ev, new Date(2027, 0, 25), { 'aichi:apply_end': true }).some((e) => e.key === 'aichi:apply_end'), '済みは消える');

// 気をつけること
const a = { id: 'a', name: 'A中', events: { exam: { date: '2027-01-20' }, result: { date: '2027-01-22' }, proc: { date: '2027-01-24', time: '15:00' } } };
const b = { id: 'b', name: 'B中', events: { exam: { date: '2027-01-20' }, result: { date: '2027-01-25' } } };
const c = S.findConflicts([a, b]);
ok(c.some((x) => x.text.includes('試験日が同じ')), 'same exam');
ok(c.some((x) => x.text.startsWith('A中 の手続き締切')), 'deadline before result');
ok(!c.some((x) => x.text.startsWith('B中 の手続き締切')), 'no false positive');

// リマインド
const r = S.dueReminders(ev, new Date(2027, 0, 6), {}, [7, 3, 1, 0], {});
ok(r.some((x) => x.event.key === 'tokai:apply_start' && x.days === 7), 'reminder 7 days');
ok(S.dueReminders(ev, new Date(2027, 0, 6), {}, [7], Object.fromEntries(r.map((x) => [x.id, 1]))).length === 0, 'no repeat');

// .ics
const ics = S.toICS(ev, [3, 0], new Date(Date.UTC(2026, 10, 8)));
ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trim().endsWith('END:VCALENDAR'), 'ics frame');
ok((ics.match(/BEGIN:VEVENT/g) || []).length === ev.length, 'ics events');
ok(ics.includes('DTSTART;TZID=Asia/Tokyo:20270113T100000'), 'ics timed');
ok(ics.includes('DTSTART;VALUE=DATE:20270206') && ics.includes('DTEND;VALUE=DATE:20270207'), 'ics all-day');
ok(ics.includes('TRIGGER:-PT63H') && ics.includes('TRIGGER:PT9H'), 'ics alarms');
ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'ics line folding');

console.log(fail ? `${fail} 件の問題` : `OK（${new Set(P.map((p) => p.school)).size} 校・${P.length} 回／テスト用の予定 ${ev.length} 件）`);
process.exit(fail ? 1 : 0);
