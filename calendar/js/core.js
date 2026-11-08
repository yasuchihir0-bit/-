// 画面に依存しないロジック（node からもテストできる）
(function (g) {
  // 予定の種類。task: true は「親がやること」（チェックできる）
  const TYPES = [
    { id: 'apply_start', label: '出願開始', short: '出願', icon: '📝', task: true },
    { id: 'apply_end', label: '出願締切', short: '締切', icon: '⏰', task: true },
    { id: 'docs', label: '書類必着', short: '書類', icon: '📮', task: true },
    { id: 'exam', label: '試験日', short: '試験', icon: '✏️', task: false },
    { id: 'result', label: '合格発表', short: '発表', icon: '🌸', task: false },
    { id: 'proc', label: '入学手続き締切', short: '手続', icon: '📋', task: true },
    { id: 'pay', label: '納入期限', short: '納入', icon: '💴', task: true },
    { id: 'brief', label: '入学説明会', short: '説明', icon: '🏫', task: false },
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  const pad = (n) => String(n).padStart(2, '0');
  const parseDate = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysUntil = (dateStr, today) => {
    const d = parseDate(dateStr);
    return d ? Math.round((d - startOfDay(today)) / 86400000) : null;
  };
  const fmtDate = (s, time) => {
    const d = parseDate(s);
    if (!d) return '未登録';
    return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})${time ? ' ' + time : ''}`;
  };
  const countdown = (n) => {
    if (n === null) return '';
    if (n === 0) return '今日';
    if (n === 1) return '明日';
    if (n === 2) return 'あさって';
    if (n > 0) return `あと${n}日`;
    return `${-n}日前`;
  };

  const eventKey = (schoolId, type) => `${schoolId}:${type}`;

  // 学校リスト → 日付順の予定リスト
  function buildEvents(schools) {
    const out = [];
    for (const s of schools) {
      for (const t of TYPES) {
        const e = s.events && s.events[t.id];
        if (!e || !parseDate(e.date)) continue;
        out.push({
          key: eventKey(s.id, t.id), schoolId: s.id, school: s.name, type: t.id,
          date: e.date, time: e.time || '', note: e.note || '', third: !!e.third,
        });
      }
    }
    const order = Object.fromEntries(TYPES.map((t, i) => [t.id, i]));
    return out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')) || order[a.type] - order[b.type]);
  }

  // 「次にやること」：済んでいない予定（過ぎた未完了タスクも「遅れ」として残す）
  function upcoming(events, today, done) {
    return events
      .map((e) => ({ ...e, days: daysUntil(e.date, today), done: !!done[e.key], task: TYPE[e.type].task }))
      .filter((e) => (e.task ? !e.done : e.days >= 0));
  }

  const urgency = (e) => {
    if (e.days < 0) return e.task ? 'late' : 'past';
    if (e.days <= 1) return 'now';
    if (e.days <= 3) return 'soon';
    if (e.days <= 7) return 'week';
    return 'later';
  };

  // 気をつけること：試験日のかさなり、手続き締切が他校の発表より前
  function findConflicts(schools) {
    const out = [];
    const ev = (s, t) => (s.events && s.events[t] && parseDate(s.events[t].date) ? s.events[t] : null);
    const stamp = (e) => e.date + 'T' + (e.time || '23:59');
    for (let i = 0; i < schools.length; i++) {
      for (let j = 0; j < schools.length; j++) {
        if (i === j) continue;
        const a = schools[i], b = schools[j];
        if (i < j && ev(a, 'exam') && ev(b, 'exam') && a.events.exam.date === b.events.exam.date && !(a.presetId && b.presetId && a.presetId.split('-')[0] === b.presetId.split('-')[0])) {
          out.push({ level: 'warn', text: `${a.name} と ${b.name} の試験日が同じ ${fmtDate(a.events.exam.date)} です。どちらを受けるか決めておきましょう。` });
        }
        // a の手続き（または納入）の締切が b の合格発表より前
        const deadlines = ['proc', 'pay'].map((t) => ev(a, t)).filter(Boolean).sort((x, y) => stamp(x).localeCompare(stamp(y)));
        const r = ev(b, 'result');
        if (deadlines.length && r && stamp(deadlines[0]) < stamp(r)) {
          out.push({
            level: 'info',
            text: `${a.name} の手続き締切（${fmtDate(deadlines[0].date, deadlines[0].time)}）は、${b.name} の合格発表（${fmtDate(r.date, r.time)}）より前です。${b.name} の結果を待たずに、${a.name} の入学金を納めるか決める必要があります。`,
          });
        }
      }
    }
    return out;
  }

  // リマインドする予定：今日が「n 日前」にあたる未完了のタスク
  function dueReminders(events, today, done, offsets, notified) {
    const out = [];
    for (const e of events) {
      if (!TYPE[e.type].task && e.type !== 'exam' && e.type !== 'result') continue;
      if (done[e.key]) continue;
      const n = daysUntil(e.date, today);
      if (!offsets.includes(n)) continue;
      const id = `${e.key}:${e.date}:${n}`;
      if (notified[id]) continue;
      out.push({ id, event: e, days: n });
    }
    return out;
  }

  // ---- カレンダー（.ics）書き出し：スマホのカレンダーで通知を受けとれる ----
  const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    // 1 行 75 オクテットまで（マルチバイト文字の途中で切らない）
    const enc = (c) => new TextEncoder().encode(c).length;
    const parts = [];
    let cur = '', len = 0, limit = 75;
    for (const ch of line) {
      const n = enc(ch);
      if (len + n > limit) { parts.push(cur); cur = ''; len = 0; limit = 74; }
      cur += ch; len += n;
    }
    parts.push(cur);
    return parts.join('\r\n ');
  }
  function toICS(events, offsets, now) {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//juken-calendar//JA', 'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:受験スケジュール', 'X-WR-TIMEZONE:Asia/Tokyo'];
    for (const e of events) {
      const t = TYPE[e.type];
      const d = e.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', `UID:${e.key}-${d}@juken-calendar`, `DTSTAMP:${stamp}`);
      if (e.time) {
        const hm = e.time.replace(':', '') + '00';
        L.push(`DTSTART;TZID=Asia/Tokyo:${d}T${hm}`, 'DURATION:PT1H');
      } else {
        const next = new Date(parseDate(e.date).getTime() + 86400000 + 3600000);
        L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${ymd(next).replace(/-/g, '')}`);
      }
      L.push(`SUMMARY:${icsText(`${t.icon}${e.school} ${t.label}`)}`);
      if (e.note) L.push(`DESCRIPTION:${icsText(e.note)}`);
      for (const n of [...new Set(offsets)].sort((a, b) => b - a)) {
        // 終日の予定は n 日前の朝 9 時、時刻つきの予定は n 日前の同じ時刻（当日は 2 時間前）
        let trig;
        if (e.time) trig = n === 0 ? '-PT2H' : `-P${n}D`;
        else trig = n === 0 ? 'PT9H' : `-PT${n * 24 - 9}H`;
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`${e.school} ${t.label}（${countdown(n)}）`)}`, `TRIGGER:${trig}`, 'END:VALARM');
      }
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  // Google カレンダーの「予定を追加」画面を開く URL（アプリ内で .ics を保存できない環境用）
  function gcalUrl(e, label) {
    const d = e.date.replace(/-/g, '');
    let dates;
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number);
      const end = `${pad((h + 1) % 24)}${pad(m)}00`;
      dates = `${d}T${pad(h)}${pad(m)}00/${d}T${end}`;
    } else {
      const next = new Date(parseDate(e.date).getTime() + 86400000 + 3600000);
      dates = `${d}/${ymd(next).replace(/-/g, '')}`;
    }
    const q = new URLSearchParams({ action: 'TEMPLATE', text: label, dates, ctz: 'Asia/Tokyo', details: e.note || '' });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  // Outlook（個人の outlook.com / 仕事・学校の Microsoft 365）の「予定を追加」画面
  function outlookUrl(e, label, host) {
    let start, end, allday;
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number);
      start = `${e.date}T${pad(h)}:${pad(m)}:00+09:00`;
      end = `${e.date}T${pad((h + 1) % 24)}:${pad(m)}:00+09:00`;
      allday = 'false';
    } else {
      start = e.date;
      end = ymd(new Date(parseDate(e.date).getTime() + 86400000 + 3600000));
      allday = 'true';
    }
    const q = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: label, startdt: start, enddt: end, allday, body: e.note || '' });
    return `https://${host}/calendar/deeplink/compose?` + q.toString();
  }

  // 連携できるカレンダー。link: 予定ごとの追加画面の URL。ics: .ics ファイルで入れる
  const CALS = [
    { id: 'google', label: 'Google カレンダー', link: (e, l) => gcalUrl(e, l) },
    { id: 'outlook', label: 'Outlook（個人用 outlook.com・hotmail）', link: (e, l) => outlookUrl(e, l, 'outlook.live.com') },
    { id: 'office', label: 'Outlook（仕事・学校の Microsoft 365）', link: (e, l) => outlookUrl(e, l, 'outlook.office.com') },
    { id: 'ics', label: 'iPhone・Mac のカレンダーなど（.ics ファイル）', ics: true },
  ];

  g.SCHED = { gcalUrl, outlookUrl, CALS, TYPES, TYPE, WD, pad, parseDate, ymd, daysUntil, fmtDate, countdown, eventKey, buildEvents, upcoming, urgency, findConflicts, dueReminders, toICS };
})(globalThis);
