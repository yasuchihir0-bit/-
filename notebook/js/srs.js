// 忘却曲線にもとづく復習スケジュール（ブラウザでも Node のテストでも使えるように DOM を使わない）

// 正解するたびに次の復習までの間をのばす（日数）。最後の段階を自力で解けたら「卒業」
export const DEFAULT_INTERVALS = [1, 3, 7, 14, 30, 60];

// 次の復習をする時点で、記憶がどのくらい残っているかの目安（エビングハウスの忘却曲線を単純化）
const RETENTION_AT_DUE = 0.7;

export const RESULTS = {
  again: { label: '× 解けない', short: '×' },
  hard: { label: '△ あやしい', short: '△' },
  good: { label: '○ 解けた', short: '○' },
};

// ---- 日付（端末のローカル日付を 'YYYY-MM-DD' で扱う） ----
export function today(now = new Date()) {
  return toDateStr(now);
}
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function addDays(s, n) {
  const t = new Date(toUTC(s) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function parseIntervals(text) {
  const list = String(text)
    .split(/[,、\s]+/)
    .map((v) => Math.round(Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0);
  for (let i = 1; i < list.length; i++) if (list[i] < list[i - 1]) return null;
  return list.length ? list : null;
}

// 新しく登録した問題の復習データ。登録した次の日に 1 回目の解き直し
export function newSchedule(addedOn, intervals = DEFAULT_INTERVALS) {
  return { stage: 0, due: addDays(addedOn, intervals[0]), lastReviewed: null, lapses: 0, mastered: false, history: [] };
}

// 次の復習日までの日数（結果ごと）。ボタンに「3日後」などと出すのに使う
export function previewInterval(srs, result, intervals = DEFAULT_INTERVALS) {
  const stage = Math.min(srs.stage, intervals.length - 1);
  if (result === 'again') return intervals[0];
  if (result === 'hard') return Math.max(1, Math.round(intervals[stage] / 2));
  const next = srs.stage + 1;
  return next >= intervals.length ? null : intervals[next]; // null = 卒業
}

// 解き直しの結果を記録して、次の復習日を決める
export function review(srs, result, on, intervals = DEFAULT_INTERVALS) {
  if (!RESULTS[result]) throw new Error(`unknown result: ${result}`);
  const s = { ...srs, history: [...(srs.history || []), { date: on, result, stage: srs.stage }] };
  s.lastReviewed = on;
  if (result === 'again') {
    s.stage = 0;
    s.lapses = (srs.lapses || 0) + 1;
    s.mastered = false;
    s.due = addDays(on, intervals[0]);
  } else if (result === 'hard') {
    s.stage = Math.min(srs.stage, intervals.length - 1);
    s.mastered = false;
    s.due = addDays(on, previewInterval(srs, 'hard', intervals));
  } else {
    const next = srs.stage + 1;
    if (next >= intervals.length) {
      s.stage = intervals.length;
      s.mastered = true;
      s.due = null;
    } else {
      s.stage = next;
      s.mastered = false;
      s.due = addDays(on, intervals[next]);
    }
  }
  return s;
}

// 卒業した問題をもう一度復習の対象にもどす
export function revive(srs, on, intervals = DEFAULT_INTERVALS) {
  return { ...srs, mastered: false, stage: 0, due: addDays(on, intervals[0]) };
}

export function isDue(srs, on) {
  return !srs.mastered && srs.due != null && srs.due <= on;
}

// 今どのくらい覚えているかの目安（0〜1）。次の復習日に RETENTION_AT_DUE になるように下がっていく
export function retention(srs, on, intervals = DEFAULT_INTERVALS) {
  if (srs.mastered) return 1;
  const from = srs.lastReviewed || (srs.due ? addDays(srs.due, -intervals[0]) : on);
  const span = Math.max(1, srs.due ? daysBetween(from, srs.due) : intervals[0]);
  const t = Math.max(0, daysBetween(from, on));
  return Math.pow(RETENTION_AT_DUE, t / span);
}

// 忘却曲線のグラフ用：登録日から今日（＋先の予定）までの記憶の目安を点の列にする
export function curvePoints(srs, addedOn, on, intervals = DEFAULT_INTERVALS) {
  const points = [];
  const events = [{ date: addedOn, result: 'again' }, ...(srs.history || [])];
  const end = srs.due && srs.due > on ? srs.due : on;
  let stateFrom = addedOn;
  let span = intervals[0];
  let replay = newSchedule(addedOn, intervals);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (i > 0) {
      replay = review(replay, ev.result, ev.date, intervals);
      stateFrom = ev.date;
      span = replay.due ? Math.max(1, daysBetween(ev.date, replay.due)) : 365;
    }
    const until = i + 1 < events.length ? events[i + 1].date : end;
    const len = Math.max(0, daysBetween(stateFrom, until));
    for (let d = 0; d <= len; d++) {
      points.push({ day: daysBetween(addedOn, stateFrom) + d, r: Math.pow(RETENTION_AT_DUE, d / span), event: d === 0 && i > 0 ? ev.result : null });
    }
  }
  return points;
}

export function stageLabel(srs, intervals = DEFAULT_INTERVALS) {
  if (srs.mastered) return '卒業';
  return `${Math.min(srs.stage, intervals.length - 1) + 1}/${intervals.length} 回目`;
}

export function dueLabel(srs, on) {
  if (srs.mastered) return '卒業';
  const d = daysBetween(on, srs.due);
  if (d < 0) return `${-d}日おくれ`;
  if (d === 0) return '今日';
  if (d === 1) return '明日';
  return `${d}日後`;
}

export function intervalLabel(days) {
  if (days == null) return '卒業';
  if (days === 1) return '明日';
  if (days % 30 === 0) return `${days / 30}か月後`;
  if (days % 7 === 0) return `${days / 7}週間後`;
  return `${days}日後`;
}
