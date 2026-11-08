// 解き直しノートの復習スケジュールのテスト: node tests/notebook-srs.mjs
import assert from 'node:assert/strict';
import * as srs from '../notebook/js/srs.js';

const I = srs.DEFAULT_INTERVALS;

// 日付の計算
assert.equal(srs.addDays('2026-01-31', 1), '2026-02-01');
assert.equal(srs.addDays('2026-12-31', 1), '2027-01-01');
assert.equal(srs.daysBetween('2026-03-01', '2026-03-31'), 30);
assert.equal(srs.daysBetween('2026-03-08', '2026-03-01'), -7);

// 登録した次の日に 1 回目
let s = srs.newSchedule('2026-04-01');
assert.equal(s.due, '2026-04-02');
assert.ok(!srs.isDue(s, '2026-04-01'));
assert.ok(srs.isDue(s, '2026-04-02'));
assert.ok(srs.isDue(s, '2026-04-10'), 'おくれていても出てくる');

// ○ を続けると 1 → 3 → 7 → 14 → 30 → 60 日とのびて、最後に卒業
let day = '2026-04-02';
const gaps = [];
for (let i = 0; i < I.length - 1; i++) {
  s = srs.review(s, 'good', day);
  if (s.mastered) break;
  gaps.push(srs.daysBetween(day, s.due));
  day = s.due;
}
assert.deepEqual(gaps, I.slice(1));
assert.ok(!s.mastered);
s = srs.review(s, 'good', day);
assert.ok(s.mastered);
assert.equal(s.due, null);
assert.ok(!srs.isDue(s, '2030-01-01'));
assert.equal(s.history.length, I.length);

// × で最初にもどる
s = srs.newSchedule('2026-04-01');
s = srs.review(s, 'good', '2026-04-02');
s = srs.review(s, 'good', '2026-04-05');
assert.equal(s.stage, 2);
s = srs.review(s, 'again', '2026-04-12');
assert.equal(s.stage, 0);
assert.equal(s.lapses, 1);
assert.equal(s.due, '2026-04-13');

// △ は段階そのまま、半分の日数
s = srs.newSchedule('2026-04-01');
s = srs.review(s, 'good', '2026-04-02');
s = srs.review(s, 'good', '2026-04-05'); // stage 2 (7 日)
s = srs.review(s, 'hard', '2026-04-12');
assert.equal(s.stage, 2);
assert.equal(srs.daysBetween('2026-04-12', s.due), 4);
assert.equal(srs.previewInterval({ stage: 0 }, 'hard'), 1);
assert.equal(srs.previewInterval({ stage: I.length - 1 }, 'good'), null);

// 卒業した問題をもどす
s = srs.revive({ ...s, mastered: true, due: null }, '2026-05-01');
assert.equal(s.due, '2026-05-02');
assert.ok(!s.mastered);

// 記憶の目安：直後は 100%、予定日に 70%
s = srs.review(srs.newSchedule('2026-04-01'), 'good', '2026-04-02'); // 次は 3 日後
assert.equal(srs.retention(s, '2026-04-02'), 1);
assert.ok(Math.abs(srs.retention(s, s.due) - 0.7) < 1e-9);
assert.ok(Math.abs(srs.retention(srs.newSchedule('2026-04-01'), '2026-04-02') - 0.7) < 1e-9);

// グラフの点
const pts = srs.curvePoints(s, '2026-04-01', '2026-04-03');
assert.equal(pts[0].day, 0);
assert.equal(pts[pts.length - 1].day, srs.daysBetween('2026-04-01', s.due));
assert.ok(pts.some((p) => p.event === 'good'));
assert.ok(pts.every((p) => p.r > 0 && p.r <= 1));

// 間隔の入力
assert.deepEqual(srs.parseIntervals('1, 2、4 8'), [1, 2, 4, 8]);
assert.equal(srs.parseIntervals('3, 1'), null);
assert.equal(srs.parseIntervals('abc'), null);

// 表示
assert.equal(srs.intervalLabel(1), '明日');
assert.equal(srs.intervalLabel(14), '2週間後');
assert.equal(srs.intervalLabel(30), '1か月後');
assert.equal(srs.dueLabel({ due: '2026-04-01', mastered: false }, '2026-04-03'), '2日おくれ');

console.log('notebook srs: OK');
