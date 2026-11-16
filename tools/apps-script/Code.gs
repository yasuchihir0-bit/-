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
 *
 * つかい方は tools/apps-script/SETUP.md を見てください。仕様は docs/SPEC.md にあります。
 *
 * 上の「@OnlyCurrentDoc」は、このプログラムが触れる Google のデータを、
 * 「このスプレッドシートだけ」に限るための印です。消さないでください。
 * （消すと、Google ドライブにあるすべてのスプレッドシートへのアクセスを求める画面になります）
 */

// 受け口の版番号（アプリは、これより古い受け口には「Code.gs を新しくしてください」と知らせます）
const VERSION = 1;

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
    return json_({ ok: true, acked: last, added: fresh.length });
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
