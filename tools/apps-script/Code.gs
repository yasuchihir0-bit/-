/**
 * @OnlyCurrentDoc
 *
 * 東海中トレーニング：まちがえた問題と答えた内容を、保護者の Google アカウントに集める受け口
 *
 *   ・お子さんの端末のアプリが、まちがえた問題と答えた内容をここへ自動で送ります（お子さんのログインはいりません）。
 *   ・保護者の端末のアプリ（保護者画面）が、ここから記録を読みます。
 *   ・書くときも読むときも「合言葉」が必要です。合言葉を知らない人は、アドレスを知っていても、記録を読めません。
 *   ・同じ記録が二度届いても、二重には書きません（端末ごとの通し番号で見分けます）。
 *   ・記録はこのスプレッドシートの「まちがい」「学習量」の 2 枚のシートにたまります。スプレッドシートからも見られます。
 *   ・ごほうびのしくみ（版 2 から）：解いた問題からポイントを計算し、バッジ・ごほうびとの交換の申請・保護者の承認・
 *     応援メッセージをあつかいます（「解答」「ポイント」「ごほうび」「申請」「応援」「バッジ」のシート）。
 *     ポイントはこの受け口が計算するので、お子さんの端末の中の数字を書きかえても、ふえません。
 *
 * つかい方は tools/apps-script/SETUP.md を見てください。仕様は docs/SPEC.md にあります。
 *
 * 上の「@OnlyCurrentDoc」は、このプログラムが触れる Google のデータを、
 * 「このスプレッドシートだけ」に限るための印です。消さないでください。
 * （消すと、Google ドライブにあるすべてのスプレッドシートへのアクセスを求める画面になります）
 */

// 受け口の版番号（アプリは、これより古い受け口には「Code.gs を新しくしてください」と知らせます）
const VERSION = 2;

// ★ここを、自分だけの合言葉（英数字 12 文字以上）に書きかえてください。
// 「記録を送る」ための合言葉です（お子さんの端末に入れます）。
const SECRET = 'ここを合言葉に書きかえる';
const SECRET_PLACEHOLDER = 'ここを合言葉に書きかえる';
// ★おすすめ：「記録を見る」ための、別の合言葉（英数字 12 文字以上）。保護者の端末にだけ入れます。
// 空のままにすると、上の合言葉で見ることもできます（お子さんの端末でも、ほかの端末の記録を読めてしまいます）。
const READ_SECRET = '';

const SHEET_NAME = 'まちがい';
const DAYS_SHEET = '学習量';
const HEADERS = ['受信日時', '日付', '時刻', '教科', '分野', '種類', '問題', '正解', '答えた内容', '結果', '端末', '番号', '分野ID', '教科ID', '答えなし', '呼び名'];
const DAYS_HEADERS = ['端末', '教科ID', '日付', '解いた数', '正解数', 'カード数', '呼び名'];
const C = { RECV: 0, DATE: 1, TIME: 2, SUBJ_NAME: 3, CAT_NAME: 4, MODE: 5, Q: 6, ANS: 7, GIVEN: 8, RESULT: 9, DEV: 10, N: 11, CAT: 12, SUBJ: 13, NOGIVEN: 14, LABEL: 15 };
const MAX_ROWS_PER_POST = 200;
const MAX_DAYS_PER_POST = 40;
const READ_LIMIT = 600;
const MAX_CELL = 1500;
const MODES = { quiz: 'クイズ', essay: '記述', card: '暗記カード', write: '書き取り', kanji: '漢字で書く' };
const MODE_IDS = ['quiz', 'essay', 'card', 'write', 'kanji'];

function json_(obj) {
  obj.ver = VERSION;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 合言葉から、できることを決める。書く用と読む用を分けているときは、読む用の合言葉では書けない */
function auth_(secret) {
  const none = { write: false, read: false };
  if (typeof secret !== 'string' || SECRET === SECRET_PLACEHOLDER || SECRET.length < 12) return none;
  const split = READ_SECRET.length > 0;
  if (split && (READ_SECRET.length < 12 || READ_SECRET === SECRET)) return { config: true, write: false, read: false };
  const w = secret === SECRET;
  const r = split ? secret === READ_SECRET : w;
  return { write: w, read: r };
}

/** ブラウザでこのアドレスを開いたときに、動いているかを確かめるためのもの（記録は出ません） */
function doGet() {
  return ContentService.createTextOutput('東海中トレーニングの記録の受け口は、動いています。');
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, err: 'format' });
  }
  if (!body || typeof body !== 'object') return json_({ ok: false, err: 'format' });
  // 合言葉を書きかえていないとき・短すぎるときは、だれの記録も受け付けない
  const a = auth_(body.secret);
  if (a.config) return json_({ ok: false, err: 'config' });
  if (!a.write && !a.read) return json_({ ok: false, err: 'secret' });
  if (body.ping) return json_({ ok: true, ping: true, can: { write: a.write, read: a.read } });
  if (body.read) return a.read ? read_(body) : json_({ ok: false, err: 'secret' });
  if (body.act) return family_(body, a);
  return a.write ? write_(body) : json_({ ok: false, err: 'readonly' });
}

/* ───────── 書く：まちがえた問題と、学習量 ───────── */
function write_(body) {
  const dev = clean_(body.dev, 20);
  const subj = clean_(body.subj, 20);
  const subjName = clean_(body.subjName, 20);
  const label = clean_(body.label, 20);
  if (!/^[a-z0-9]{4,20}$/.test(dev) || !/^[a-z]{2,20}$/.test(subj)) return json_({ ok: false, err: 'format' });
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS_PER_POST) : [];
  if (isBlocked_(dev)) return json_({ ok: false, err: 'blocked' });

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'last:' + dev + ':' + subj;
    const saved = props.getProperty(key); // 受け取りずみの最後の番号（まだ何も受け取っていなければ null）
    let last = saved == null ? -1 : Number(saved);
    if (!Number.isFinite(last)) last = -1;

    const fresh = rows
      .filter((r) => r && Number.isInteger(r.n) && r.n > last)
      .sort((a, b) => a.n - b.n);

    if (fresh.length) {
      const sheet = sheet_(SHEET_NAME, HEADERS, [[7, 420], [8, 200], [9, 260]]);
      const now = new Date();
      const values = fresh.map((r) => {
        const row = new Array(HEADERS.length).fill('');
        row[C.RECV] = now;
        row[C.DATE] = clean_(r.d, 10);
        row[C.TIME] = clean_(r.t, 5);
        row[C.SUBJ_NAME] = subjName || subj;
        row[C.CAT_NAME] = clean_(r.catName, 40);
        row[C.MODE] = MODES[r.m] || clean_(r.m, 10);
        row[C.Q] = clean_(r.q, MAX_CELL);
        row[C.ANS] = clean_(r.ans, MAX_CELL);
        row[C.GIVEN] = r.given == null ? '（わからないを選んだ）' : clean_(r.given, MAX_CELL);
        row[C.RESULT] = r.g === 'hard' ? '△ おしい' : '× まちがい';
        row[C.DEV] = dev;
        row[C.N] = r.n;
        row[C.CAT] = clean_(r.cat, 20);
        row[C.SUBJ] = subj;
        row[C.NOGIVEN] = r.given == null ? '1' : '0';
        row[C.LABEL] = label;
        return row;
      });
      const start = sheet.getLastRow() + 1;
      // 「=」や「+」で始まる文字を、計算式として読まれないよう、受信日時のほかは文字としてあつかう
      sheet.getRange(start, 2, values.length, HEADERS.length - 1).setNumberFormat('@');
      sheet.getRange(start, 1, values.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
      sheet.getRange(start, 1, values.length, HEADERS.length).setValues(values);
      last = fresh[fresh.length - 1].n;
      props.setProperty(key, String(last));
    }
    writeDays_(dev, subj, body.days, label);
    const out = { ok: true, acked: last, added: fresh.length };
    // ごほうびのしくみ：解いた記録（events）からポイントとバッジを計算し、お子さんの画面の中身を返す
    if (Array.isArray(body.events)) {
      const r = events_(dev, label, body.events);
      out.evAcked = r.evAcked;
      out.fam = { gained: r.gained, awards: r.awards, state: childState_(dev) };
    }
    seen_(dev, label);
    return json_(out);
  } finally {
    lock.releaseLock();
  }
}

/** 日ごとの学習量（解いた数・正解数・カードの枚数）を、端末・教科・日付ごとに上書きする */
function writeDays_(dev, subj, days, label) {
  if (!days || typeof days !== 'object') return;
  const dates = Object.keys(days).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-MAX_DAYS_PER_POST);
  if (!dates.length) return;
  const sheet = sheet_(DAYS_SHEET, DAYS_HEADERS, []);
  const last = sheet.getLastRow();
  const index = {};
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, 3).getValues().forEach((r, i) => { index[r[0] + '|' + r[1] + '|' + r[2]] = i + 2; });
  }
  const num = (v) => (Number.isInteger(v) && v >= 0 && v <= 100000 ? v : 0);
  const append = [];
  dates.forEach((d) => {
    const v = days[d] || {};
    const vals = [num(v.n), num(v.ok), num(v.cards)];
    const at = index[dev + '|' + subj + '|' + d];
    if (at) sheet.getRange(at, 4, 1, 4).setValues([vals.concat([label])]);
    else append.push([dev, subj, d].concat(vals, [label]));
  });
  if (append.length) {
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, append.length, 3).setNumberFormat('@');
    sheet.getRange(start, 1, append.length, DAYS_HEADERS.length).setValues(append);
  }
}

/* ───────── 読む：保護者画面が、ほかの端末の記録を取りにくる ───────── */
function read_(body) {
  const subj = clean_(body.subj, 20);
  const exclude = clean_(body.exclude, 20);
  if (!/^[a-z]{2,20}$/.test(subj)) return json_({ ok: false, err: 'format' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const devs = {};
  const labels = {};
  const out = [];
  let newest = 0;
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    for (let i = values.length - 1; i >= 0 && out.length < READ_LIMIT; i--) {
      const r = values[i];
      if (String(r[C.SUBJ]) !== subj || String(r[C.DEV]) === exclude) continue;
      const recv = r[C.RECV] instanceof Date ? r[C.RECV].getTime() : 0;
      if (recv > newest) newest = recv;
      devs[String(r[C.DEV])] = true;
      if (r[C.LABEL] && !labels[String(r[C.DEV])]) labels[String(r[C.DEV])] = String(r[C.LABEL]);
      out.push({
        d: String(r[C.DATE]),
        t: String(r[C.TIME]),
        cat: String(r[C.CAT]),
        m: MODE_IDS.indexOf(modeId_(r[C.MODE])) >= 0 ? modeId_(r[C.MODE]) : 'quiz',
        g: String(r[C.RESULT]).charAt(0) === '△' ? 'hard' : 'ng',
        q: String(r[C.Q]),
        ans: String(r[C.ANS]),
        given: String(r[C.NOGIVEN]) === '1' ? null : String(r[C.GIVEN]),
        n: Number(r[C.N]),
        dev: String(r[C.DEV]),
      });
    }
    out.reverse();
  }
  const days = {};
  const daysBy = {};
  const dsheet = ss.getSheetByName(DAYS_SHEET);
  if (dsheet && dsheet.getLastRow() > 1) {
    dsheet.getRange(2, 1, dsheet.getLastRow() - 1, DAYS_HEADERS.length).getValues().forEach((r) => {
      if (String(r[1]) !== subj || String(r[0]) === exclude) return;
      const dv = String(r[0]);
      devs[dv] = true;
      if (r[6]) labels[dv] = String(r[6]);
      const d = String(r[2]);
      const t = days[d] || (days[d] = { n: 0, ok: 0, cards: 0 });
      t.n += Number(r[3]) || 0; t.ok += Number(r[4]) || 0; t.cards += Number(r[5]) || 0;
      const by = daysBy[dv] || (daysBy[dv] = {});
      by[d] = { n: Number(r[3]) || 0, ok: Number(r[4]) || 0, cards: Number(r[5]) || 0 };
    });
  }
  const kids = Object.keys(devs).sort().map((dv) => ({ dev: dv, label: labels[dv] || '' }));
  return json_({ ok: true, rows: out, days: days, daysBy: daysBy, kids: kids, devs: kids.length, at: newest ? new Date(newest).toISOString() : '' });
}

function modeId_(label) {
  const s = String(label);
  for (let i = 0; i < MODE_IDS.length; i++) if (MODES[MODE_IDS[i]] === s) return MODE_IDS[i];
  return s;
}

function clean_(v, max) {
  return String(v == null ? '' : v).slice(0, max);
}

function sheet_(name, headers, widths) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    widths.forEach((w) => sheet.setColumnWidth(w[0], w[1]));
  }
  return sheet;
}

/* ═════════════════ ごほうびのしくみ（版 2） ═════════════════ */
const EV_SHEET = '解答', LEDGER = 'ポイント', REWARDS = 'ごほうび', REQS = '申請', MSGS = '応援', BADGE_SHEET = 'バッジ';
const EV_HEADERS = ['端末', '日付', '教科ID', '分野ID', '分野', '解いた数', '正解数', '秒', '★★★正解', '呼び名'];
const LEDGER_HEADERS = ['日時', '端末', '呼び名', '内容', 'pt', 'キー'];
const REWARD_HEADERS = ['ID', '絵文字', '名前', 'pt', '表示', '並び'];
const REQ_HEADERS = ['ID', '端末', '呼び名', 'ごほうびID', '名前', 'pt', '状態', 'ひとこと', '申請日時', '処理日時'];
const MSG_HEADERS = ['ID', '宛先', 'スタンプ', 'ひとこと', '送信日時', '読んだ端末'];
const BADGE_HEADERS = ['端末', 'バッジID', '回数', '最後の日'];
const MAX_EVENTS_PER_POST = 500;
const PT = { answer: 2, correct: 1, dayGoal: 20, dayBonus: 25 }; // 1 問 2pt・正解でさらに 1pt・1 日 20 問で +25pt
/* バッジ：test(s) が true になったら、1 回だけもらえる（repeat は、その日ごとにもらえる） */
const BADGES = [
  { id: 'first', emoji: '🌱', name: 'はじめの一歩', desc: 'はじめて問題を解く', pts: 10, test: (s) => s.total >= 1 },
  { id: 'q100', emoji: '💯', name: '100 問', desc: 'ぜんぶで 100 問解く', pts: 50, test: (s) => s.total >= 100 },
  { id: 'q500', emoji: '📚', name: '500 問', desc: 'ぜんぶで 500 問解く', pts: 150, test: (s) => s.total >= 500 },
  { id: 'q1000', emoji: '🏆', name: '1000 問', desc: 'ぜんぶで 1000 問解く', pts: 300, test: (s) => s.total >= 1000 },
  { id: 'streak3', emoji: '📅', name: '3 日連続', desc: '3 日続けて学習する', pts: 30, test: (s) => s.streak >= 3 },
  { id: 'streak7', emoji: '🔥', name: '7 日連続', desc: '7 日続けて学習する', pts: 80, test: (s) => s.streak >= 7 },
  { id: 'streak30', emoji: '🌟', name: '30 日連続', desc: '30 日続けて学習する', pts: 300, test: (s) => s.streak >= 30 },
  { id: 'all3', emoji: '🎒', name: '3 教科の日', desc: '1 日に国語・社会・理科をぜんぶ解く', pts: 20, test: (s) => s.maxSubjectsInDay >= 3 },
  { id: 'top50', emoji: '🏯', name: '東海中レベル 50', desc: '★★★ の問題に 50 問正解する', pts: 100, test: (s) => s.top >= 50 },
  { id: 'review', emoji: '🧹', name: '復習ゼロ', desc: 'その日の復習をぜんぶ終わらせる', pts: 15, repeat: true },
];

const num_ = (v) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0);
const isDay_ = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d));
const table_ = (name, headers) => sheet_(name, headers, []);
function values_(sheet, width) {
  const last = sheet.getLastRow();
  return last > 1 ? sheet.getRange(2, 1, last - 1, width).getValues() : [];
}
function append_(sheet, rows, textFrom) {
  if (!rows.length) return;
  const start = sheet.getLastRow() + 1;
  if (textFrom) sheet.getRange(start, textFrom, rows.length, rows[0].length - textFrom + 1).setNumberFormat('@');
  sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}
function isBlocked_(dev) {
  try { return (JSON.parse(PropertiesService.getScriptProperties().getProperty('blocked') || '[]')).indexOf(dev) >= 0; } catch (e) { return false; }
}
function seen_(dev, label) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('seen:' + dev, new Date().toISOString());
  if (label) p.setProperty('label:' + dev, label);
}

/** 解いた記録（端末ごとの通し番号つき）を数え、ポイントとバッジを計算する。同じ番号は二度数えない */
function events_(dev, label, events) {
  const props = PropertiesService.getScriptProperties();
  const k = 'ev:' + dev;
  const saved = props.getProperty(k);
  let last = saved == null ? -1 : Number(saved);
  const fresh = events.slice(0, MAX_EVENTS_PER_POST)
    .filter((e) => e && Number.isInteger(e.s) && e.s > last && isDay_(e.d))
    .sort((a, b) => a.s - b.s);
  if (!fresh.length) return { evAcked: last, gained: 0, awards: [] };
  // 1. 解答の数を、端末・日・教科・分野ごとに足す
  const ev = table_(EV_SHEET, EV_HEADERS);
  const rows = values_(ev, EV_HEADERS.length);
  const index = {};
  rows.forEach((r, i) => { index[[r[0], r[1], r[2], r[3]].join('|')] = i; });
  const touchedDays = {};
  const reviewDays = {};
  const added = [];
  fresh.forEach((e) => {
    if (e.k === 'review') { reviewDays[e.d] = true; return; }
    const subj = clean_(e.subj, 20), cat = clean_(e.cat, 20);
    if (!/^[a-z]{2,20}$/.test(subj) || !/^[a-z0-9]{1,20}$/.test(cat)) return;
    const key = [dev, e.d, subj, cat].join('|');
    let r;
    if (key in index) r = rows[index[key]];
    else { r = [dev, e.d, subj, cat, clean_(e.catName, 30), 0, 0, 0, 0, label]; index[key] = rows.length; rows.push(r); added.push(index[key]); }
    r[5] = num_(r[5]) + 1;
    if (e.ok) r[6] = num_(r[6]) + 1;
    r[7] = num_(r[7]) + Math.min(600, Math.max(0, num_(e.sec)));
    if (e.ok && num_(e.lv) >= 3) r[8] = num_(r[8]) + 1;
    if (label) r[9] = label;
    touchedDays[e.d] = true;
  });
  if (rows.length) {
    ev.getRange(2, 1, rows.length, 5).setNumberFormat('@');
    ev.getRange(2, 1, rows.length, EV_HEADERS.length).setValues(rows);
  }
  last = fresh[fresh.length - 1].s;
  props.setProperty(k, String(last));

  // 2. ポイント：日ごとの「問題を解いた」の行を、合計にあわせて書きなおす（差がもらえたポイント）
  const led = table_(LEDGER, LEDGER_HEADERS);
  const lrows = values_(led, LEDGER_HEADERS.length);
  const lkey = {};
  lrows.forEach((r, i) => { lkey[String(r[5])] = i + 2; });
  const now = new Date();
  const awards = [];
  let gained = 0;
  const mine = rows.filter((r) => r[0] === dev);
  const newLedger = [];
  const putLedger = (key, text, pts) => {
    if (key in lkey) {
      const row = lkey[key];
      const before = num_(led.getRange(row, 5, 1, 1).getValues()[0][0]);
      if (before === pts) return 0;
      led.getRange(row, 1, 1, 5).setValues([[now, dev, label, text, pts]]);
      return pts - before;
    }
    newLedger.push([now, dev, label, text, pts, key]);
    lkey[key] = -1;
    return pts;
  };
  Object.keys(touchedDays).sort().forEach((d) => {
    let n = 0, ok = 0;
    mine.filter((r) => r[1] === d).forEach((r) => { n += num_(r[5]); ok += num_(r[6]); });
    const g = putLedger('ans:' + dev + ':' + d, `問題を解いた（${d}・${n} 問・正解 ${ok}）`, n * PT.answer + ok * PT.correct);
    if (g) { gained += g; awards.push({ reason: 'answers', label: '問題を解いた', pts: g }); }
    if (n >= PT.dayGoal && !(('bonus:' + dev + ':' + d) in lkey)) {
      putLedger('bonus:' + dev + ':' + d, `1 日 ${PT.dayGoal} 問ボーナス（${d}）`, PT.dayBonus);
      gained += PT.dayBonus; awards.push({ reason: 'bonus', label: `1 日 ${PT.dayGoal} 問ボーナス`, pts: PT.dayBonus });
    }
  });

  // 3. バッジ
  const stats = statsOf_(mine);
  const bs = table_(BADGE_SHEET, BADGE_HEADERS);
  const brows = values_(bs, BADGE_HEADERS.length);
  const have = {};
  brows.forEach((r, i) => { if (r[0] === dev) have[String(r[1])] = { row: i + 2, count: num_(r[2]), last: String(r[3]) }; });
  const newBadges = [];
  BADGES.forEach((b) => {
    if (b.repeat) {
      Object.keys(reviewDays).sort().forEach((d) => {
        const h = have[b.id];
        if (h && h.last >= d) return;
        if (h) { h.count += 1; h.last = d; bs.getRange(h.row, 3, 1, 2).setValues([[h.count, d]]); }
        else { have[b.id] = { row: -1, count: 1, last: d }; newBadges.push([dev, b.id, 1, d]); }
        const key = 'badge:' + dev + ':' + b.id + ':' + d;
        if (!(key in lkey)) { putLedger(key, `バッジ：${b.name}`, b.pts); gained += b.pts; awards.push({ reason: 'badge', id: b.id, label: `${b.emoji} ${b.name}`, pts: b.pts }); }
      });
      return;
    }
    if (have[b.id] || !b.test(stats)) return;
    have[b.id] = { row: -1, count: 1, last: '' };
    newBadges.push([dev, b.id, 1, Object.keys(touchedDays).sort().pop() || '']);
    putLedger('badge:' + dev + ':' + b.id, `バッジ：${b.name}`, b.pts);
    gained += b.pts; awards.push({ reason: 'badge', id: b.id, label: `${b.emoji} ${b.name}`, pts: b.pts });
  });
  append_(bs, newBadges, 1);
  append_(led, newLedger, 2);
  return { evAcked: last, gained, awards };
}

/** 端末ごとの合計：ぜんぶで何問・★★★正解・連続日数・1 日に解いた教科の数 */
function statsOf_(rows) {
  const days = {};
  let total = 0, top = 0, sec = 0;
  rows.forEach((r) => {
    const n = num_(r[5]);
    total += n; top += num_(r[8]); sec += num_(r[7]);
    if (!n) return;
    const d = String(r[1]);
    (days[d] = days[d] || {})[String(r[2])] = true;
  });
  const list = Object.keys(days).sort();
  let streak = 0;
  if (list.length) {
    streak = 1;
    for (let i = list.length - 1; i > 0; i--) {
      if (dayDiff_(list[i - 1], list[i]) === 1) streak++; else break;
    }
  }
  const maxSubjectsInDay = list.reduce((m, d) => Math.max(m, Object.keys(days[d]).length), 0);
  return { total, top, sec, streak, maxSubjectsInDay, lastDay: list[list.length - 1] || '' };
}
function dayDiff_(a, b) {
  const t = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}
function balance_(dev) {
  const led = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LEDGER);
  if (!led) return 0;
  return values_(led, LEDGER_HEADERS.length).reduce((s, r) => s + (r[1] === dev ? num_(r[4]) : 0), 0);
}
function rewardsList_(all) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REWARDS);
  if (!sh) return [];
  return values_(sh, REWARD_HEADERS.length)
    .map((r) => ({ id: num_(r[0]), emoji: String(r[1]), name: String(r[2]), cost: num_(r[3]), hidden: String(r[4]) === '0', sort: num_(r[5]) }))
    .filter((r) => r.id && (all || !r.hidden))
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
}
function requestsList_(dev, status) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REQS);
  if (!sh) return [];
  return values_(sh, REQ_HEADERS.length)
    .map((r) => ({ id: num_(r[0]), dev: String(r[1]), label: String(r[2]), rewardId: num_(r[3]), name: String(r[4]), cost: num_(r[5]), status: String(r[6]), note: String(r[7]), createdAt: iso_(r[8]), decidedAt: iso_(r[9]) }))
    .filter((r) => r.id && (!dev || r.dev === dev) && (!status || status === 'all' || r.status === status))
    .sort((a, b) => b.id - a.id);
}
function messagesList_(dev) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MSGS);
  if (!sh) return [];
  return values_(sh, MSG_HEADERS.length)
    .map((r) => ({ id: num_(r[0]), to: String(r[1]), stamp: String(r[2]), text: String(r[3]), createdAt: iso_(r[4]), readBy: String(r[5] || '').split(',').filter(Boolean) }))
    .filter((m) => m.id && (!dev || m.to === '*' || m.to === dev))
    .sort((a, b) => b.id - a.id);
}
const iso_ = (v) => (v instanceof Date ? v.toISOString() : v ? String(v) : '');
const nextId_ = (sh) => values_(sh, 1).reduce((m, r) => Math.max(m, num_(r[0])), 0) + 1;

/** お子さんの画面に出すもの：ポイント・バッジ・交換できるごほうび・申請・まだ読んでいない応援 */
function childState_(dev) {
  const bs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BADGE_SHEET);
  const counts = {};
  if (bs) values_(bs, BADGE_HEADERS.length).forEach((r) => { if (r[0] === dev) counts[String(r[1])] = num_(r[2]); });
  return {
    balance: balance_(dev),
    badges: BADGES.map((b) => ({ id: b.id, emoji: b.emoji, name: b.name, desc: b.desc, pts: b.pts, count: counts[b.id] || 0 })),
    rewards: rewardsList_(false).map((r) => ({ id: r.id, emoji: r.emoji, name: r.name, cost: r.cost })),
    requests: requestsList_(dev).slice(0, 10).map((r) => ({ id: r.id, name: r.name, cost: r.cost, status: r.status, note: r.note })),
    messages: messagesList_(dev).filter((m) => m.readBy.indexOf(dev) < 0).slice(0, 5).map((m) => ({ id: m.id, stamp: m.stamp, text: m.text, createdAt: m.createdAt })),
  };
}

/** ごほうびのしくみの操作。お子さん（送る合言葉）と保護者（保護者の合言葉）で、できることが分かれる */
function family_(body, a) {
  const act = String(body.act);
  const CHILD = ['state', 'request', 'read_msgs'];
  const PARENT = ['summary', 'requests', 'decide', 'messages', 'send', 'rewards', 'reward_add', 'reward_update', 'kids', 'ledger', 'block'];
  if (CHILD.indexOf(act) >= 0) {
    if (!a.write) return json_({ ok: false, err: 'secret' });
    const dev = clean_(body.dev, 20);
    if (!/^[a-z0-9]{4,20}$/.test(dev)) return json_({ ok: false, err: 'format' });
    if (isBlocked_(dev)) return json_({ ok: false, err: 'blocked' });
    const label = clean_(body.label, 20);
    if (act === 'state') { seen_(dev, label); return json_({ ok: true, state: childState_(dev) }); }
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      if (act === 'read_msgs') {
        const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MSGS);
        const ids = Array.isArray(body.ids) ? body.ids.map(num_) : [];
        if (sh) values_(sh, MSG_HEADERS.length).forEach((r, i) => {
          if (ids.indexOf(num_(r[0])) < 0 || !(r[1] === '*' || r[1] === dev)) return;
          const by = String(r[5] || '').split(',').filter(Boolean);
          if (by.indexOf(dev) < 0) { by.push(dev); sh.getRange(i + 2, 6, 1, 1).setValues([[by.join(',')]]); }
        });
        return json_({ ok: true, state: childState_(dev) });
      }
      // request：ごほうびとの交換を申請する（ポイントは申請したときに引き、却下されたら返す）
      const rw = rewardsList_(false).filter((r) => r.id === num_(body.rewardId))[0];
      if (!rw) return json_({ ok: false, err: 'notfound' });
      if (balance_(dev) < rw.cost) return json_({ ok: false, err: 'points' });
      const sh = table_(REQS, REQ_HEADERS);
      const id = nextId_(sh);
      const now = new Date();
      append_(sh, [[id, dev, label, rw.id, rw.name, rw.cost, 'pending', '', now, '']], 2);
      append_(table_(LEDGER, LEDGER_HEADERS), [[now, dev, label, `ごほうびの申請：${rw.name}`, -rw.cost, 'req:' + id]], 2);
      seen_(dev, label);
      return json_({ ok: true, state: childState_(dev) });
    } finally { lock.releaseLock(); }
  }
  if (PARENT.indexOf(act) < 0) return json_({ ok: false, err: 'format' });
  if (!a.read) return json_({ ok: false, err: 'secret' });
  // 保護者の操作は、合言葉を 2 つに分けているときだけ（分けていないと、お子さんの端末からも承認できてしまう）
  if (!READ_SECRET) return json_({ ok: false, err: 'need_split' });
  return parent_(act, body);
}

function parent_(act, body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const kid = /^[a-z0-9]{4,20}$/.test(String(body.kid || '')) ? String(body.kid) : '';
  if (act === 'summary') return json_(Object.assign({ ok: true }, summary_(kid, isDay_(body.today) ? String(body.today) : '')));
  if (act === 'requests') return json_({ ok: true, requests: requestsList_(kid, String(body.status || 'all')).slice(0, 50) });
  if (act === 'messages') return json_({ ok: true, messages: messagesList_('').slice(0, 30) });
  if (act === 'rewards') return json_({ ok: true, rewards: rewardsList_(true) });
  if (act === 'kids') return json_({ ok: true, kids: kids_() });
  if (act === 'ledger') {
    const led = ss.getSheetByName(LEDGER);
    const list = led ? values_(led, LEDGER_HEADERS.length).filter((r) => !kid || r[1] === kid).slice(-Math.min(200, Math.max(1, num_(body.limit) || 50))).reverse()
      .map((r) => ({ at: iso_(r[0]), dev: String(r[1]), label: String(r[2]), text: String(r[3]), pts: num_(r[4]) })) : [];
    return json_({ ok: true, ledger: list });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (act === 'decide') {
      const sh = ss.getSheetByName(REQS);
      if (!sh) return json_({ ok: false, err: 'notfound' });
      const rows = values_(sh, REQ_HEADERS.length);
      const i = rows.findIndex((r) => num_(r[0]) === num_(body.id));
      if (i < 0) return json_({ ok: false, err: 'notfound' });
      if (String(rows[i][6]) !== 'pending') return json_({ ok: false, err: 'done' });
      const approve = body.approve === true;
      const now = new Date();
      sh.getRange(i + 2, 7, 1, 4).setValues([[approve ? 'approved' : 'rejected', clean_(body.note, 100), rows[i][8], now]]);
      if (!approve) append_(table_(LEDGER, LEDGER_HEADERS), [[now, String(rows[i][1]), String(rows[i][2]), `ごほうびの申請を見送り（返却）：${rows[i][4]}`, num_(rows[i][5]), 'refund:' + num_(rows[i][0])]], 2);
      return json_({ ok: true });
    }
    if (act === 'send') {
      const stamp = clean_(body.stamp, 20), text = clean_(body.text, 100);
      if (!stamp && !text) return json_({ ok: false, err: 'format' });
      const to = body.to === '*' || !body.to ? '*' : (/^[a-z0-9]{4,20}$/.test(String(body.to)) ? String(body.to) : '');
      if (!to) return json_({ ok: false, err: 'format' });
      const sh = table_(MSGS, MSG_HEADERS);
      append_(sh, [[nextId_(sh), to, stamp, text, new Date(), '']], 2);
      return json_({ ok: true });
    }
    if (act === 'reward_add') {
      const name = clean_(body.name, 30).trim(), emoji = clean_(body.emoji, 8).trim(), cost = num_(body.cost);
      if (!name || cost < 1 || cost > 100000) return json_({ ok: false, err: 'format' });
      const sh = table_(REWARDS, REWARD_HEADERS);
      const id = nextId_(sh);
      append_(sh, [[id, emoji, name, cost, '1', id]], 2);
      return json_({ ok: true, id: id });
    }
    if (act === 'reward_update') {
      const sh = ss.getSheetByName(REWARDS);
      if (!sh) return json_({ ok: false, err: 'notfound' });
      const rows = values_(sh, REWARD_HEADERS.length);
      const i = rows.findIndex((r) => num_(r[0]) === num_(body.id));
      if (i < 0) return json_({ ok: false, err: 'notfound' });
      const r = rows[i];
      if (body.cost !== undefined) { const c = num_(body.cost); if (c < 1 || c > 100000) return json_({ ok: false, err: 'format' }); r[3] = c; }
      if (body.hidden !== undefined) r[4] = body.hidden ? '0' : '1';
      if (body.sort !== undefined) r[5] = num_(body.sort);
      sh.getRange(i + 2, 1, 1, REWARD_HEADERS.length).setValues([r]);
      return json_({ ok: true });
    }
    if (act === 'block') {
      const p = PropertiesService.getScriptProperties();
      let list = [];
      try { list = JSON.parse(p.getProperty('blocked') || '[]'); } catch (e) { list = []; }
      if (!kid) return json_({ ok: false, err: 'format' });
      list = list.filter((d) => d !== kid);
      if (body.block === true) list.push(kid);
      p.setProperty('blocked', JSON.stringify(list));
      return json_({ ok: true });
    }
  } finally { lock.releaseLock(); }
  return json_({ ok: false, err: 'format' });
}

/** お子さん（端末）の一覧：呼び名・最後の通信・外しているか */
function kids_() {
  const p = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const devs = {};
  [[SHEET_NAME, C.DEV, HEADERS.length], [EV_SHEET, 0, EV_HEADERS.length]].forEach(([n, col, w]) => {
    const sh = ss.getSheetByName(n);
    if (sh) values_(sh, w).forEach((r) => { if (r[col]) devs[String(r[col])] = true; });
  });
  let blocked = [];
  try { blocked = JSON.parse(p.getProperty('blocked') || '[]'); } catch (e) { blocked = []; }
  return Object.keys(devs).sort().map((d) => ({ dev: d, label: p.getProperty('label:' + d) || '', lastSeen: p.getProperty('seen:' + d) || '', blocked: blocked.indexOf(d) >= 0, balance: balance_(d) }));
}

/** 保護者の「ようす」：きょう・今週・ポイント・連続日数・苦手そうな分野・確認待ちの申請 */
function summary_(kid, today) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ev = ss.getSheetByName(EV_SHEET);
  const rows = ev ? values_(ev, EV_HEADERS.length).filter((r) => !kid || r[0] === kid) : [];
  const day = today || rows.reduce((m, r) => (String(r[1]) > m ? String(r[1]) : m), '');
  const dow = day ? (new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))).getUTCDay() + 6) % 7 : 0; // 月曜 = 0
  const blank = () => ({ solved: 0, ok: 0, sec: 0, bySubject: {} });
  const t = blank(), w = blank();
  const weak = {};
  rows.forEach((r) => {
    const d = String(r[1]), n = num_(r[5]), ok = num_(r[6]), sec = num_(r[7]), subj = String(r[2]);
    const diff = day ? dayDiff_(d, day) : 999;
    if (diff === 0) { t.solved += n; t.ok += ok; t.sec += sec; t.bySubject[subj] = (t.bySubject[subj] || 0) + n; }
    if (diff >= 0 && diff <= dow) { w.solved += n; w.ok += ok; w.sec += sec; w.bySubject[subj] = (w.bySubject[subj] || 0) + n; }
    if (diff >= 0 && diff < 14) {
      const k = subj + '|' + r[3];
      const x = weak[k] || (weak[k] = { subject: subj, cat: String(r[3]), catName: String(r[4]), n: 0, ok: 0 });
      x.n += n; x.ok += ok;
    }
  });
  const led = ss.getSheetByName(LEDGER);
  const lrows = led ? values_(led, LEDGER_HEADERS.length).filter((r) => !kid || r[1] === kid) : [];
  const balance = lrows.reduce((s, r) => s + num_(r[4]), 0);
  const weekStart = day ? new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) - dow)) : null;
  w.gained = lrows.filter((r) => num_(r[4]) > 0 && String(r[5]).indexOf('refund:') !== 0 && weekStart && r[0] instanceof Date && r[0].getTime() >= weekStart.getTime() - 86400000).reduce((s, r) => s + num_(r[4]), 0);
  const devs = kid ? [kid] : Object.keys(rows.reduce((m, r) => { m[r[0]] = true; return m; }, {}));
  const streak = devs.reduce((m, d) => Math.max(m, statsOf_(rows.filter((r) => r[0] === d)).streak), 0);
  const weakList = Object.keys(weak).map((k) => weak[k]).filter((x) => x.n >= 10).sort((a, b) => a.ok / a.n - b.ok / b.n).slice(0, 5);
  const p = PropertiesService.getScriptProperties();
  const lastSeen = devs.map((d) => p.getProperty('seen:' + d) || '').sort().pop() || '';
  return { day: day, today: t, week: w, balance: balance, streak: streak, weak: weakList, pending: requestsList_(kid, 'pending').length, lastSeen: lastSeen };
}

