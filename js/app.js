/* 東海中 トレーニング（国語・社会 共通）：画面とロジック
 * 教科のデータは window.SUBJECT（なければ window.KOKUGO）。教科ごとのちがいは SUBJECT.app で設定する。 */
(function () {
  'use strict';
  const { pick, shuffle, esc, rich, parseAnswer, req, fromDecimal } = window.U;
  const Charts = window.Charts;

  const SUBJECTS = [window.SUBJECT || window.KOKUGO];
  const SUBJ = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
  const K = SUBJECTS[0];
  /* 教科ごとの設定（書いていないものは国語の値） */
  const APP = Object.assign({
    key: 'tokai-kokugo-v1',
    file: 'tokai-kokugo-kiroku',
    pickDesc: 'ことわざ・敬語・文法など、苦手な分野をクイズや暗記カードで集中練習。',
    topFocus: ['shinjo', 'hyoron', 'tsukai', 'kanyo', 'bunpo'],
    textHint: '記述式：ひらがなで書けば OK です。',
    contentNote: '問題文・例文・解説はこのアプリのために作ったものです。まちがいがないよう注意していますが、言葉の意味や使い方は辞書によって説明が少しちがうことがあります。気になるところは辞書や学校・塾の教材でも確かめてください。',
    links: [],
  }, K.app || {});
  const $app = document.getElementById('app');

  /* ───────── 日付 ───────── */
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dstr(new Date());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dstr(new Date(y, m - 1, d + n)); };
  const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

  /* ───────── 問題の見分け（キー） ───────── */
  const qkey = (q) => `${q.subject}|${q.q}|${q.ans}`;
  const lvOf = (x) => x.lv || 1;
  /* 計算問題（数値で答える）：n が正解の数、unit が単位 */
  const isNum = (item) => item.n !== undefined;
  const ansOf = (item) => (isNum(item) ? `${item.n}${item.unit || ''}` : item.k ? item.k : item.a ? item.a[0] : item.ok ? item.ok.join('／') : item.c[0]);
  const bkey = (sid, item) => `${sid}|${item.q}|${ansOf(item)}`;
  const BANK = new Map();
  SUBJECTS.forEach((s) => (s.bank || []).forEach((item, idx) => {
    BANK.set(bkey(s.id, item), { s, item, idx });
  }));

  /* ───────── 保存（この端末のブラウザ内のみ） ───────── */
  const KEY = APP.key;
  const LOG_MAX = 3000, IMG_KEEP = 100; // まちがいの記録の上限・手書き画像を残す件数
  const blank = () => ({ version: 2, stats: {}, cards: {}, kanji: {}, days: {}, lvs: {}, log: [], sessions: 0 });
  let store = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = sanitize(JSON.parse(raw));
  } catch (e) { /* 保存できない環境でも動くようにする */ }
  /* 保存データ・読みこんだファイルを、決まった形の安全なデータだけに整える
     （細工されたファイルを読みこんでも、画面に HTML が入りこんだり、止まったりしないように） */
  function sanitize(d) {
    const out = blank();
    if (!d || typeof d !== 'object') return out;
    const int = (v, max = 1e7) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.floor(+v))) : 0);
    const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
    const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.slice(0, 500)) : undefined);
    const cats = new Set(K.cats.map((c) => c.id));
    const obj = (v) => (v && typeof v === 'object' ? v : {});
    Object.entries(obj(d.stats)).forEach(([k, v]) => {
      const m = /^([a-z]+):([a-z]+)$/.exec(k);
      if (m && m[1] === K.id && cats.has(m[2])) out.stats[k] = { n: int(v && v.n), ok: int(v && v.ok) };
    });
    Object.entries(obj(d.cards)).forEach(([k, c]) => {
      if (typeof k !== 'string' || k.length > 3000 || !c || !cats.has(c.cat)) return;
      const card = { box: int(c.box, 5), due: isDate(c.due) ? c.due : today(), n: int(c.n), ok: int(c.ok), lapses: int(c.lapses), cat: c.cat, lv: Math.max(1, int(c.lv, 3)) };
      if (isDate(c.last)) card.last = c.last;
      const sn = c.snap;
      if (sn && typeof sn === 'object' && cats.has(sn.cat) && ['choice', 'text', 'multi'].includes(sn.type)) {
        card.snap = { subject: K.id, cat: sn.cat, type: sn.type, q: str(sn.q), ans: str(sn.ans), exp: str(sn.exp), lv: card.lv };
        ['choices', 'accept', 'correct'].forEach((f) => { const a = strs(sn[f]); if (a) card.snap[f] = a; });
        if ((sn.type === 'choice' || sn.type === 'multi') && !(card.snap.choices && card.snap.choices.length)) delete card.snap;
        if (sn.type === 'text' && !(card.snap.accept && card.snap.accept.length)) delete card.snap;
        if (sn.type === 'multi' && !card.snap.correct) delete card.snap;
      }
      out.cards[k] = card;
    });
    Object.entries(obj(d.days)).forEach(([k, v]) => {
      if (isDate(k) && v) out.days[k] = { n: int(v.n), ok: int(v.ok), sec: int(v.sec), cards: int(v.cards) };
    });
    ['1', '2', '3'].forEach((k) => { const v = obj(d.lvs)[k]; if (v) out.lvs[k] = { n: int(v.n), ok: int(v.ok) }; });
    // 漢字で書く（手書き）の記録：キーは書く言葉そのもの
    Object.entries(obj(d.kanji)).forEach(([k, c]) => {
      if (typeof k !== 'string' || !k || k.length > 40 || !c || typeof c !== 'object') return;
      const card = { box: int(c.box, 5), due: isDate(c.due) ? c.due : today(), n: int(c.n), ok: int(c.ok), lapses: int(c.lapses) };
      if (isDate(c.last)) card.last = c.last;
      out.kanji[k] = card;
    });
    // まちがえた問題の記録（保護者画面用）
    if (Array.isArray(d.log)) {
      d.log.slice(-LOG_MAX).forEach((e) => {
        if (!e || typeof e !== 'object' || !cats.has(e.cat) || !isDate(e.d) || typeof e.q !== 'string') return;
        const o = { d: e.d, t: /^\d{2}:\d{2}$/.test(e.t) ? e.t : '', cat: e.cat, q: str(e.q), ans: str(e.ans, 500), g: e.g === 'hard' ? 'hard' : 'ng', m: ['quiz', 'write', 'essay', 'card', 'kanji'].includes(e.m) ? e.m : 'quiz' };
        if (typeof e.given === 'string') o.given = str(e.given, 600);
        if (Number.isInteger(e.n) && e.n >= 0) o.n = e.n;
        if (Number.isInteger(e.b)) o.b = Math.max(-1, Math.min(5, e.b));
        if (typeof e.exp === 'string' && e.exp) o.exp = str(e.exp);
        if (typeof e.img === 'string' && e.img.length < 40000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(e.img)) o.img = e.img;
        out.log.push(o);
      });
    }
    out.seq = int(d.seq, 1e9);
    out.sessions = int(d.sessions);
    if ([10, 20, 30, 50].includes(+d.goal)) out.goal = +d.goal;
    if (d.answerMode === 'choice') out.answerMode = 'choice';
    if (d.padSize === 'xl') out.padSize = 'xl';
    if (d.seenGuide === true) out.seenGuide = true;
    if (Array.isArray(d.wrong)) out.wrong = d.wrong.filter((q) => q && typeof q === 'object' && cats.has(q.cat) && typeof q.q === 'string');
    return out;
  }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {
      // 容量がいっぱいのときは、手書きの画像を古いほうから半分ずつ消して、保存できるまでくり返す
      for (let i = 0; i < 12; i++) {
        const imgs = (store.log || []).filter((x) => x.img);
        if (!imgs.length) break;
        imgs.slice(0, Math.ceil(imgs.length / 2)).forEach((x) => { delete x.img; });
        try { localStorage.setItem(KEY, JSON.stringify(store)); return; } catch (e2) { /* もう一度 */ }
      }
      // それでも入らないときは、まちがいの記録を古いほうから半分ずつ消す（学習の記録・復習の予定は残す）
      for (let i = 0; i < 12 && (store.log || []).length; i++) {
        store.log.splice(0, Math.ceil(store.log.length / 2));
        try { localStorage.setItem(KEY, JSON.stringify(store)); return; } catch (e3) { /* もう一度 */ }
      }
    }
  };

  /* ───────── まちがえた問題の記録（保護者画面で見る） ─────────
   * g: 'ng'（まちがい・書けなかった）/ 'hard'（△）  m: quiz / write（書き取り）/ essay（記述）/ card（暗記カード）/ kanji（漢字で書く）
   * given: 答えた内容（null は「わからない」）。img: 手書きの画像（新しい IMG_KEEP 件だけ残す） */
  function logMiss(q, g, m, given, img) {
    const now = new Date();
    if (!Number.isInteger(store.seq)) store.seq = 0;
    const e = { n: store.seq++, d: today(), t: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, cat: q.cat, q: String(q.q).slice(0, 2000), ans: String(q.ans).slice(0, 500), g, m };
    if (given != null) e.given = String(given).slice(0, 600);
    if (q.exp && !BANK.has(`${K.id}|${q.q}|${q.ans}`)) e.exp = String(q.exp).slice(0, 2000);
    if (img) e.img = img;
    if (!Array.isArray(store.log)) store.log = [];
    store.log.push(e);
    if (store.log.length > LOG_MAX) store.log.splice(0, store.log.length - LOG_MAX);
    let kept = 0;
    for (let i = store.log.length - 1; i >= 0; i--) if (store.log[i].img && ++kept > IMG_KEEP) delete store.log[i].img;
    save();
    pushSheet(true);
  }
  /* 手書きを小さな画像にする（どの画面の色でも読めるよう、こい灰色の線にそろえる） */
  function padImage() {
    try {
      const ink = $app.querySelector('#ink');
      if (!ink || !ink.width) return null;
      const k = Math.min(1, 320 / ink.width);
      const c = document.createElement('canvas');
      c.width = Math.round(ink.width * k); c.height = Math.round(ink.height * k);
      const x = c.getContext('2d');
      x.drawImage(ink, 0, 0, c.width, c.height);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      let any = false;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 20) { any = true; break; }
      if (!any) return null;
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      return url.length < 40000 ? url : null;
    } catch (e) { return null; }
  }

  /* まちがいの記録に通し番号をつける（端末どうしの同期で、変わった部分だけ送るため） */
  {
    let seq = store.seq || 0;
    (store.log || []).forEach((e) => { if (Number.isInteger(e.n)) seq = Math.max(seq, e.n + 1); });
    (store.log || []).forEach((e) => { if (!Number.isInteger(e.n)) e.n = seq++; });
    store.seq = seq;
  }
  const SYNC = (typeof window !== 'undefined' && window.TokaiSync) || null;
  const SYNC_S = APP.key.replace(/^tokai-/, '').replace(/-v\d+$/, ''); // kokugo / shakai / rika
  /* この端末の記録を claude.ai 側に保存する（公開ページで開いたときだけ。失敗しても何もしない） */
  const pushSync = () => { if (SYNC && SYNC.available()) { try { SYNC.upload(SYNC_S).catch(() => {}); } catch (e) { /* noop */ } } };
  /* 保護者の Google スプレッドシートへ自動で送る（sheetsync.js。送り先を設定したときだけ動く） */
  const SHEET = (typeof window !== 'undefined' && window.SheetSync) || null;
  const sheetOpt = () => ({ subject: SYNC_S, subjectName: K.name, getLog: () => store.log || [], getDays: () => store.days || {}, catName: (id) => { const c = K.cats.find((x) => x.id === id); return c ? c.name : id; } });
  const pushSheet = (soon) => { if (SHEET) { try { if (soon) SHEET.flushSoon(sheetOpt()); else SHEET.flush(sheetOpt()).catch(() => {}); } catch (e) { /* noop */ } } };
  /* ほかの端末から読みこんだ記録（sync.js が置いたもの） */
  function remoteData() {
    if (!SYNC) return null;
    try {
      const r = JSON.parse(localStorage.getItem(SYNC.remoteKey(SYNC_S)));
      if (!r || !Array.isArray(r.log)) return null;
      const c = sanitize({ log: r.log, days: r.days });
      return { log: c.log, days: c.days, at: typeof r.at === 'string' ? r.at.slice(0, 30) : '', devs: +r.devs || 1 };
    } catch (e) { return null; }
  }

  /* 旧バージョンの「まちがえた問題」を復習カードに引き継ぐ */
  if (Array.isArray(store.wrong)) {
    store.wrong.forEach((q) => {
      const k = qkey(q);
      if (!store.cards[k]) {
        store.cards[k] = { box: 0, due: today(), n: 1, ok: 0, lapses: 1, last: today(), cat: q.cat, lv: lvOf(q) };
        if (!BANK.has(k)) store.cards[k].snap = slim(q);
      }
    });
    delete store.wrong;
    save();
  }

  /* ───────── 間隔反復（忘れかけたころに復習する） ─────────
   * 箱 0〜5。正解するたびに次の箱へ進み、復習の間隔がのびる。まちがえると箱 0 にもどる。 */
  const INTERVALS = [0, 1, 3, 7, 14, 30];
  const STAGES = [
    { id: 'master', name: '習得', min: 4, note: '14 日以上あけても正解できた' },
    { id: 'fixed', name: '定着中', min: 2, note: '数日あけて正解できた' },
    { id: 'learn', name: '学習中', min: 0, note: 'まちがえた・覚えはじめ' },
  ];
  const stageOf = (c) => (!c ? 'new' : c.box >= 4 ? 'master' : c.box >= 2 ? 'fixed' : 'learn');

  function slim(q) {
    const o = { subject: q.subject, cat: q.cat, type: q.type, q: q.q, ans: q.ans, exp: q.exp, lv: lvOf(q) };
    if (q.choices) o.choices = q.choices.slice();
    if (q.accept) o.accept = q.accept.slice();
    if (q.correct) o.correct = q.correct.slice();
    if (q.val) { o.val = { n: q.val.n, d: q.val.d }; o.unit = q.unit || ''; }
    if (q.passage) o.passage = q.passage;
    return o;
  }

  /* grade: 'ok'（正解・覚えた） / 'hard'（あやしい） / 'ng'（まちがい・まだ） */
  function schedule(q, grade) {
    const k = qkey(q), t = today();
    let c = store.cards[k];
    const isNew = !c;
    if (!c) c = store.cards[k] = { box: 0, due: t, n: 0, ok: 0, lapses: 0, cat: q.cat, lv: lvOf(q) };
    c.n++;
    if (grade === 'ok') c.ok++;
    if (grade === 'ng') { c.lapses++; c.box = 0; }
    else if (grade === 'hard') c.box = Math.max(1, c.box - 1);
    else if (isNew) c.box = 2; // 初めてで正解：すでに知っている問題なので 3 日後に確認
    else if (c.due <= t) c.box = Math.min(5, c.box + 1); // 予定日に正解できたら次の箱へ
    c.due = addDays(t, INTERVALS[c.box]);
    c.last = t;
    if (!BANK.has(k)) c.snap = slim(q);
  }

  function logDay(ok, sec, kind) {
    const t = today();
    const d = store.days[t] || (store.days[t] = { n: 0, ok: 0, sec: 0, cards: 0 });
    if (kind === 'card') d.cards++;
    else { d.n++; if (ok) d.ok++; }
    d.sec += Math.min(120, Math.max(0, Math.round(sec)));
  }

  /* クイズで答えたとき */
  function record(q, ok, sec, grade) {
    const k = `${q.subject}:${q.cat}`;
    const s = store.stats[k] || (store.stats[k] = { n: 0, ok: 0 });
    s.n++; if (ok) s.ok++;
    const lv = String(lvOf(q));
    const L = store.lvs[lv] || (store.lvs[lv] = { n: 0, ok: 0 });
    L.n++; if (ok) L.ok++;
    schedule(q, grade || (ok ? 'ok' : 'ng'));
    logDay(ok, sec, 'quiz');
    save();
  }

  /* ───────── 問題をつくる ───────── */
  const catOf = (sid, cid) => SUBJ[sid].cats.find((c) => c.id === cid);

  function fromBank(subject, item, idx) {
    const base = { subject: subject.id, cat: item.cat, id: `${subject.id}-${idx}`, q: item.q, exp: item.exp, lv: lvOf(item) };
    if (item.p) base.passage = item.p;
    if (item.k) return Object.assign(base, { type: 'essay', ans: item.k, pts: (item.pts || []).slice(), lim: item.lim || 0 });
    if (isNum(item)) return Object.assign(base, { type: 'num', val: fromDecimal(String(item.n)), unit: item.unit || '', ans: ansOf(item) });
    if (item.a) return Object.assign(base, { type: 'text', ans: item.a[0], accept: item.a });
    if (item.ok) return Object.assign(base, { type: 'multi', choices: shuffle(item.c), correct: item.ok.slice(), ans: ansOf(item) });
    return Object.assign(base, { type: 'choice', choices: shuffle(item.c), ans: item.c[0] });
  }

  function fromGen(subject, cat, filter) {
    const g = pick(cat.gens)(filter);
    if (!g) return null;
    return Object.assign({ subject: subject.id, cat: cat.id, type: 'choice' }, g);
  }

  /* 復習カード → 問題 */
  function fromCard(k, c) {
    const b = BANK.get(k);
    if (b) return fromBank(b.s, b.item, b.idx);
    if (!c.snap) return null;
    const q = Object.assign({}, c.snap);
    if (q.choices) q.choices = shuffle(q.choices);
    return q;
  }

  /* 記述式の答え合わせ：空白・記号・カタカナ/ひらがなのちがいは無視 */
  const normText = (s) => String(s).normalize('NFKC')
    .replace(/[\s　。、「」『』（）()・]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const textOk = (q, v) => q.accept.some((a) => normText(a) === normText(v));
  /* 計算問題の答え合わせ：単位はつけてもつけなくてもよい。0.5 と 1/2 のような書き方のちがいも同じとみなす */
  const numOk = (q, v) => { const r = parseAnswer(v); return !!r && req(r, q.val); };

  /* 難易度のしぼりこみ */
  const LEVELS = {
    all: { name: '★★と★★★', f: null },
    top: { name: '★★★だけ', f: (lv) => lv >= 3 },
  };
  const stars = (lv) => '★'.repeat(lv) + '☆'.repeat(3 - lv);

  /* 出題の優先順：①復習日が来た問題 ②まだ解いていない問題 ③そのほか */
  function prioritized(list) {
    const t = today();
    const due = [], fresh = [], rest = [];
    list.forEach((x) => {
      const c = store.cards[x.key];
      if (!c) fresh.push(x); else if (c.due <= t) due.push(x); else rest.push(x);
    });
    // pop() で取り出すので、優先したいものを後ろに置く
    return shuffle(rest).concat(shuffle(fresh), shuffle(due));
  }

  /* targets: [{sid, cid}] の中から n 問 */
  function buildSet(targets, n, filter) {
    const pools = targets.map(({ sid, cid }) => {
      const subject = SUBJ[sid], cat = catOf(sid, cid);
      const bank = (subject.bank || [])
        .map((item, idx) => ({ item, idx, key: bkey(sid, item) }))
        .filter((x) => x.item.cat === cid && (!filter || filter(lvOf(x.item))));
      return { subject, cat, bank: prioritized(bank) };
    }).filter((p) => p.cat);
    const out = [], seen = new Set();
    let guard = 0;
    while (out.length < n && guard++ < n * 50) {
      const live = pools.filter((p) => p.cat.gens || p.bank.length);
      if (!live.length) break;
      const p = pick(live);
      let q = null;
      if (p.cat.gens && (!p.bank.length || Math.random() < 0.3)) q = fromGen(p.subject, p.cat, filter);
      else if (p.bank.length) { const { item, idx } = p.bank.pop(); q = fromBank(p.subject, item, idx); }
      if (!q || seen.has(qkey(q))) continue;
      seen.add(qkey(q));
      out.push(q);
    }
    return out;
  }

  /* 今日復習する問題（箱の小さい順＝忘れやすい順） */
  function dueList(cid) {
    const t = today();
    return Object.entries(store.cards)
      .filter(([, c]) => c.due <= t && (cid ? c.cat === cid : !SOLO.has(c.cat)))
      .sort((a, b) => a[1].box - b[1].box || a[1].due.localeCompare(b[1].due))
      .map(([k, c]) => fromCard(k, c))
      .filter(Boolean);
  }

  /* ───────── 集計 ───────── */
  const pct = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);
  const totals = () => Object.values(store.stats).reduce((a, v) => ({ n: a.n + v.n, ok: a.ok + v.ok }), { n: 0, ok: 0 });

  function streak() {
    let d = today(), s = 0;
    const has = (x) => store.days[x] && (store.days[x].n + store.days[x].cards) > 0;
    if (!has(d)) d = addDays(d, -1);
    while (has(d)) { s++; d = addDays(d, -1); }
    return s;
  }

  /* 分野ごとの習熟度：{ total, new, learn, fixed, master } */
  function mastery(cid) {
    const cat = catOf(K.id, cid);
    const r = { total: 0, new: 0, learn: 0, fixed: 0, master: 0 };
    if (cat.gens) {
      // 自動で出題する分野は、もとになる組の数を問題数として数える
      const pairs = cat.size ? cat.size() : K.ANTONYMS.length + K.SYNONYMS.length;
      r.total = pairs;
      Object.values(store.cards).filter((c) => c.cat === cid).forEach((c) => { r[stageOf(c)]++; });
      const seen = r.learn + r.fixed + r.master;
      if (seen > pairs) { const k = pairs / seen; r.learn = Math.round(r.learn * k); r.fixed = Math.round(r.fixed * k); r.master = pairs - r.learn - r.fixed; }
      r.new = Math.max(0, pairs - r.learn - r.fixed - r.master);
      return r;
    }
    K.bank.forEach((item) => {
      if (item.cat !== cid) return;
      r.total++;
      r[stageOf(store.cards[bkey(K.id, item)])]++;
    });
    return r;
  }

  /* ───────── 画面共通 ───────── */
  const h = (html) => { Charts.hideTip(); $app.innerHTML = html; window.scrollTo(0, 0); };
  const on = (sel, ev, fn) => { const el = $app.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  const onAll = (sel, ev, fn) => $app.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  let keyHandler = null;
  const setKeys = (fn) => { keyHandler = fn; };
  document.addEventListener('keydown', (e) => { if (keyHandler) keyHandler(e); });
  let onResize = null;
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => onResize && onResize(), 150); });
  /* 画面の中に出す確認・お知らせ（confirm / alert が使えない環境でも動くように）
     ask(本文, { ok, cancel, html }) → Promise<boolean>。cancel を null にするとボタンは 1 つ */
  function ask(text, opt = {}) {
    return new Promise((resolve) => {
      Charts.hideTip();
      const prev = document.activeElement;
      const el = document.createElement('div');
      el.className = 'modal';
      const cancel = opt.cancel === undefined ? 'やめる' : opt.cancel;
      el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="確認">
        <p class="ask-text">${opt.html ? text : esc(text)}</p>
        <div class="row" style="justify-content:flex-end;margin-top:16px">
          ${cancel ? `<button class="btn ghost" data-a="0" type="button">${esc(cancel)}</button>` : ''}
          <button class="btn" data-a="1" type="button">${esc(opt.ok || 'OK')}</button>
        </div></div>`;
      const done = (v) => {
        el.remove();
        document.removeEventListener('keydown', key, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const key = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); done(false); }
        else if (e.key === 'Enter' && !e.isComposing && !(e.target && e.target.tagName === 'TEXTAREA')) { e.preventDefault(); e.stopPropagation(); done(true); }
        else e.stopPropagation();
      };
      el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => done(b.dataset.a === '1')));
      el.addEventListener('click', (e) => { if (e.target === el) done(false); });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(el);
      if (opt.onOpen) opt.onOpen(el);
      el.querySelector('[data-a="1"]').focus();
    });
  }
  const notice = (text) => ask(text, { cancel: null });
  /* 問題のとちゅうで別の画面に行くときは確かめる */
  const leave = (fn) => {
    if (!(session && !session.done && session.idx > 0)) { fn(); return; }
    ask('とちゅうでやめますか？（答えた問題の記録は残ります）', { ok: 'やめる', cancel: '続ける' }).then((y) => { if (y) fn(); });
  };
  document.getElementById('homeBtn').addEventListener('click', () => leave(home));
  Charts.initTips();
  document.getElementById('statsBtn').addEventListener('click', () => leave(analysis));
  document.getElementById('helpBtn').addEventListener('click', () => leave(help));

  const reset = () => { session = null; setKeys(null); onResize = null; clearInterval(timerId); };

  /* 覚えぐあいの 4 段階（色の濃さで表す） */
  const STAGE_NAMES = { master: '覚えた', fixed: 'もう少し', learn: 'にがて', new: 'まだ' };
  function masteryBar(m, label, tips = true) {
    const seg = (n, cls, name) => (n ? `<i class="${cls}" style="flex:${n}"${tips ? ` data-tip="${esc(label)}：${name} ${n} 問（${pct(n, m.total)}%）"` : ''}></i>` : '');
    return `<span class="mbar">${seg(m.master, 'm4', STAGE_NAMES.master)}${seg(m.fixed, 'm3', STAGE_NAMES.fixed)}${seg(m.learn, 'm2', STAGE_NAMES.learn)}${seg(m.new, 'm0', STAGE_NAMES.new)}</span>`;
  }
  const stageLegend = () => `<div class="legend"><i class="m4"></i>覚えた<i class="m3"></i>もう少し<i class="m2"></i>にがて<i class="m0"></i>まだ</div>`;

  const allTargets = () => K.cats.filter((c) => !c.solo).map((c) => ({ sid: K.id, cid: c.id }));
  const SOLO = new Set(K.cats.filter((c) => c.solo).map((c) => c.id));
  /* 新しい問題を n 問：半分を★★★、残りを★★〜★★★から */
  function freshSet(targets, n, exclude = new Set()) {
    const pickNew = (k, f) => buildSet(targets, k + 5, f).filter((q) => !exclude.has(qkey(q)));
    const hard = pickNew(Math.ceil(n / 2), LEVELS.top.f).slice(0, Math.ceil(n / 2));
    hard.forEach((q) => exclude.add(qkey(q)));
    return shuffle(hard.concat(pickNew(n - hard.length, null).slice(0, n - hard.length)));
  }
  const goal = () => store.goal || 20;
  const todayCount = () => { const d = store.days[today()]; return d ? d.n + (d.cards || 0) : 0; };

  /* 今日の学習：復習が来た問題を先に、残りを新しい問題で 10 問 */
  const ROUND = 10;
  function dailySet() {
    const due = dueList().slice(0, ROUND);
    const keys = new Set(due.map(qkey));
    const fresh = freshSet(allTargets(), ROUND - due.length, keys);
    return { set: due.concat(fresh), nDue: due.length, nNew: fresh.length };
  }
  function startDaily() {
    const { set } = dailySet();
    start(set, '今日の学習');
    if (session) session.daily = true;
  }

  /* ───────── ホーム ───────── */
  function home() {
    reset();
    const due = dueList().length;
    const done = todayCount(), G = goal();
    const st = streak();
    const nDue = Math.min(due, ROUND);
    const all = K.cats.map((c) => mastery(c.id)).reduce((a, m) => ({ total: a.total + m.total, master: a.master + m.master, fixed: a.fixed + m.fixed, learn: a.learn + m.learn, new: a.new + m.new }), { total: 0, master: 0, fixed: 0, learn: 0, new: 0 });
    const first = !Object.keys(store.days).length;
    h(`
      <div class="card hero">
        <div class="hero-top">
          <div>
            <div class="small">今日の目標</div>
            <div class="goal"><b>${done}</b> / ${G} 問</div>
          </div>
          <div class="hero-right">
            <div class="streak" title="続けて学習した日数">${st ? `🔥 ${st} 日連続` : '今日から始めよう'}</div>
            <span class="chip" title="★★（標準）と★★★（東海中レベル）だけを出します">🏯 東海中レベル</span>
          </div>
        </div>
        <div class="progress big"><i style="width:${Math.min(100, (done / G) * 100)}%"></i></div>
        <button class="btn wide start" data-daily="1" type="button">
          ${done >= G ? '🎉 目標達成！ もっとやる' : first ? '▶ はじめる' : '▶ 今日の学習をはじめる'}
          <small>${nDue ? `復習 ${nDue} 問 ＋ 新しい問題 ${ROUND - nDue} 問` : `新しい問題 ${ROUND} 問`}</small>
        </button>
        <p class="small" style="margin:8px 0 0">${first
          ? 'まずはこのボタンを押すだけで OK。まちがえた問題は、あとで自動的にもう一度出てきます。'
          : 'まよったらこのボタン。まちがえた問題や、忘れかけた問題を先に出します。'}</p>
      </div>

      <div class="grid two">
        <button class="tile" style="--tc:var(--accent)" data-pick="1">
          <span class="ic">📚</span><span class="tt">分野をえらぶ</span>
          <span class="ds">${esc(APP.pickDesc)}</span>
        </button>
        <button class="tile" style="--tc:${K.color}" data-test="1">
          <span class="ic">🏆</span><span class="tt">力だめし</span>
          <span class="ds">15 問のテスト。ふつうのテストと、東海中レベルのテスト。</span>
        </button>
        ${PASSAGE_IDS.length ? `<button class="tile" style="--tc:var(--c-mix)" data-dokkai="1">
          <span class="ic">📖</span><span class="tt">長文読解</span>
          <span class="ds">説明文・物語文を読んで答える。理由・気持ち・抜き出し・記述（自己採点）。</span>
        </button>` : ''}
        ${KANJI.length ? `<button class="tile" style="--tc:var(--ok)" data-kanji="1">
          <span class="ic">✍️</span><span class="tt">漢字で書く</span>
          <span class="ds">用語を指やペンで書いて練習。答えを見て、自分で ○・△・× をつけます。</span>
        </button>` : ''}
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <strong>ぜんぶで ${all.total} 問のうち</strong>
          <button class="linkbtn" data-stats="1" type="button">📊 くわしく見る</button>
        </div>
        ${masteryBar(all, '全体')}
        ${stageLegend()}
        <p class="small" style="margin:4px 0 0">覚えた <b>${all.master}</b>・もう少し <b>${all.fixed}</b>・にがて <b>${all.learn}</b>・まだ <b>${all.new}</b></p>
      </div>
      <p class="small center"><button class="linkbtn" data-help="1" type="button">❓ 使い方を見る</button>　<button class="linkbtn" data-parents="1" type="button">👪 保護者の方へ</button></p>
      ${APP.links.length ? `<p class="small center">ほかの教科：${APP.links.map((l) => `<a class="linkbtn" href="${esc(l.href)}">${esc(l.label)}</a>`).join('・')}</p>` : ''}
      <p class="small center notice">このアプリは東海中学校の公式のものではありません。学校とは関係のない、受験勉強用の非公式アプリです。</p>`);
    on('[data-daily]', 'click', startDaily);
    on('[data-pick]', 'click', () => practice('quiz'));
    on('[data-test]', 'click', tests);
    on('[data-kanji]', 'click', () => kanjiHome());
    on('[data-dokkai]', 'click', dokkaiHome);
    on('[data-stats]', 'click', analysis);
    on('[data-help]', 'click', help);
    on('[data-parents]', 'click', () => parents());
    if (!store.seenGuide) guide();
  }

  /* ───────── 分野をえらぶ（クイズ／暗記カード） ───────── */
  function practice(mode) {
    reset();
    let level = 'all';
    const tiles = K.cats.filter((c) => !(c.solo && mode === 'flash')).map((c) => {
      const m = mastery(c.id);
      const d = dueList(c.id).length;
      return `<button class="tile" style="--tc:${mode === 'quiz' ? 'var(--accent)' : 'var(--ok)'}" data-c="${c.id}">
        <span class="tt">${esc(c.name)}</span>
        ${masteryBar(m, c.name, false)}
        <span class="badge">${d ? `🔁 復習 ${d}・` : ''}覚えた ${m.master}／${m.total}</span>
      </button>`;
    }).join('');
    h(`
      <h1>📚 分野をえらぶ</h1>
      <div class="seg mode" role="group" aria-label="練習のしかた">
        <button type="button" data-mode="quiz" aria-pressed="${mode === 'quiz'}">✏️ クイズ（10 問）</button>
        <button type="button" data-mode="flash" aria-pressed="${mode === 'flash'}">🃏 暗記カード（20 枚）</button>
      </div>
      <p class="lead" style="margin-top:10px">${mode === 'quiz'
        ? '4 つの中から答えをえらんだり、答えを書いたりします。'
        : '問題を見て、<b>答えを頭の中で思い出してから</b>カードをめくります。思い出せたかどうかを自分でえらびます。'}</p>
      ${mode === 'quiz' ? `<div class="row" style="margin-bottom:12px"><span class="small">むずかしさ</span>
        <div class="seg" role="group" aria-label="むずかしさ">
          ${Object.entries(LEVELS).map(([k, v]) => `<button type="button" data-lv="${k}" aria-pressed="${k === level}">${v.name}</button>`).join('')}
        </div></div>` : ''}
      ${stageLegend()}
      <div class="grid cats">${tiles}</div>
      <p class="small center"><button class="linkbtn" data-setup="1" type="button">いくつかの分野を組み合わせる・問題数を変える</button></p>`);
    onAll('[data-mode]', 'click', (e) => practice(e.currentTarget.dataset.mode));
    onAll('[data-lv]', 'click', (e) => {
      level = e.currentTarget.dataset.lv;
      $app.querySelectorAll('[data-lv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lv === level)));
    });
    onAll('[data-c]', 'click', (e) => {
      const cid = e.currentTarget.dataset.c;
      const name = catOf(K.id, cid).name;
      if (SOLO.has(cid)) { dokkaiHome(); return; }
      if (mode === 'quiz') start(buildSet([{ sid: K.id, cid }], 10, LEVELS[level].f), name);
      else {
        const due = dueList(cid);
        const keys = new Set(due.map(qkey));
        const more = buildSet([{ sid: K.id, cid }], 20).filter((q) => !keys.has(qkey(q)));
        flashStart(due.concat(more).slice(0, 20), name);
      }
    });
    on('[data-setup]', 'click', setup);
  }

  /* ───────── 力だめし ───────── */
  function tests() {
    reset();
    h(`
      <h1>🏆 力だめし</h1>
      <p class="lead">15 問のテストです。時間も計ります。終わったら、分野ごとの結果が見られます。</p>
      <div class="grid two">
        <button class="tile" style="--tc:var(--c-mix)" data-mix="1">
          <span class="ic">📝</span><span class="tt">ふつうのテスト</span>
          <span class="ds">全分野から、★★（標準）と★★★（東海中レベル）を合わせて 15 問。</span>
        </button>
        <button class="tile" style="--tc:${K.color}" data-top="1">
          <span class="ic">🏯</span><span class="tt">東海中レベル</span>
          <span class="ds">★★★（難関校レベル）が 10 問＋★★が 5 問。「すべて選ぶ」「答えを書く」問題もあります。</span>
        </button>
      </div>`);
    on('[data-top]', 'click', () => {
      // 東海中でよく問われる分野を多めに出す（国語：気持ち・説明文の言葉・使い方・慣用句・文法）
      const focus = APP.topFocus.map((cid) => ({ sid: K.id, cid }));
      const set = buildSet(focus, 6, LEVELS.top.f);
      const seenQ = new Set(set.map(qkey));
      const more = buildSet(allTargets(), 8, LEVELS.top.f).filter((q) => !seenQ.has(qkey(q))).slice(0, 10 - set.length);
      more.forEach((q) => seenQ.add(qkey(q)));
      const rest = buildSet(allTargets(), 10, null).filter((q) => !seenQ.has(qkey(q))).slice(0, 15 - set.length - more.length);
      start(shuffle(set.concat(more, rest)), '東海中レベルのテスト');
    });
    on('[data-mix]', 'click', () => start(buildSet(allTargets(), 15), 'ふつうのテスト'));
  }

  /* ───────── はじめての案内 ───────── */
  const GUIDE = [
    { ic: '▶', t: '毎日「今日の学習」を押すだけ', b: 'ホームの大きなボタンを押すと、10 問ずつ出てきます。<br>1 日の目標は 20 問（使い方のページで変えられます）。' },
    { ic: '🔁', t: 'まちがえた問題は、また出てくる', b: 'まちがえた問題は、その日のうちにもう一度出ます。<br>正解するたびに「次に出るまで」が長くなります（1 日後 → 3 日後 → 1 週間後 → 2 週間後 → 1 か月後）。<br>だから、<b>にがてな問題ほどくり返し出て、覚えた問題はあまり出なくなります。</b>' },
    { ic: '📊', t: '色の帯で、覚えぐあいがわかる', b: `${'<span class="mbar demo"><i class="m4" style="flex:3"></i><i class="m3" style="flex:2"></i><i class="m2" style="flex:2"></i><i class="m0" style="flex:3"></i></span>'}濃い色ほど、しっかり覚えています。<br>にがてな分野は「分野をえらぶ」で集中練習しましょう。` },
  ];
  function guide(i = 0) {
    Charts.hideTip();
    let el = document.getElementById('guide');
    if (!el) { el = document.createElement('div'); el.id = 'guide'; el.className = 'modal'; document.body.appendChild(el); }
    const g = GUIDE[i];
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="gt">
      <div class="dots">${GUIDE.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="g-ic">${g.ic}</div>
      <h2 id="gt">${g.t}</h2>
      <p>${g.b}</p>
      <div class="row" style="justify-content:space-between;margin-top:16px">
        <button class="btn ghost" data-skip type="button">${i < GUIDE.length - 1 ? 'とばす' : 'もどる'}</button>
        <button class="btn" data-next type="button">${i < GUIDE.length - 1 ? 'つぎへ' : 'はじめる！'}</button>
      </div></div>`;
    const close = () => { el.remove(); store.seenGuide = true; save(); };
    el.querySelector('[data-next]').addEventListener('click', () => (i < GUIDE.length - 1 ? guide(i + 1) : close()));
    el.querySelector('[data-skip]').addEventListener('click', () => (i < GUIDE.length - 1 ? close() : guide(i - 1)));
    el.querySelector('[data-next]').focus();
  }

  /* ───────── 使い方 ───────── */
  function help() {
    reset();
    h(`
      <h1>❓ 使い方</h1>
      <div class="card">
        <h2 style="margin-top:0">毎日のやり方</h2>
        <ol class="steps">
          <li>ホームの <b>「▶ 今日の学習をはじめる」</b> を押す（10 問）。</li>
          <li>目標の問題数になるまで、もう一度押す。</li>
          <li>時間があれば <b>「分野をえらぶ」</b> で、にがてな分野を練習する。</li>
          <li>週に 1 回くらい <b>「力だめし」</b> で 15 問のテストをして、 <b>📊</b> で成長を確かめる。</li>
        </ol>
      </div>
      <div class="card">
        <h2 style="margin-top:0">ボタンの説明</h2>
        <dl class="defs">
          <dt>▶ 今日の学習</dt><dd>復習の問題を先に、足りない分を新しい問題で 10 問。いちばんおすすめ。</dd>
          <dt>📚 分野をえらぶ</dt><dd>分野を 1 つえらんで練習。<b>クイズ</b>（答えをえらぶ・書く）と<b>暗記カード</b>（思い出してからめくる）を切りかえられます。</dd>
          <dt>🏆 力だめし</dt><dd>15 問のテスト。「東海中レベル」はむずかしい問題だけです。</dd>
          ${KANJI.length ? '<dt>✍️ 漢字で書く</dt><dd>用語を手書きで書く練習。書いたら「答えを見る」を押し、正しい漢字と見くらべて ○（書けた）・△（おしい）・×（書けなかった）を自分でつけます。書けなかった言葉は、またあとで出てきます。</dd>' : ''}
          <dt>📊 くわしく見る</dt><dd>毎日の問題数、正答率、分野ごとの覚えぐあい、よくまちがえる問題がわかります。</dd>
        </dl>
      </div>
      <div class="card">
        <h2 style="margin-top:0">マークの意味</h2>
        <dl class="defs">
          <dt>色の帯</dt><dd>${stageLegend()}「覚えた」は 2 週間以上あけても正解できた問題、「もう少し」は数日あけて正解できた問題、「にがて」はまちがえた問題、「まだ」はまだ解いていない問題です。</dd>
          <dt><span class="lv">★★☆</span></dt><dd>標準（中学入試でよく出るレベル）</dd>
          <dt><span class="lv">★★★</span></dt><dd>むずかしい（東海中・難関校レベル）。新しい問題の半分は ★★★ です。</dd>
          <dt>すべて選ぶ</dt><dd>正しいものを<b>全部</b>選んでから「答える」を押す問題。1 つでも多かったり足りなかったりすると不正解です。</dd>
          <dt>記述</dt><dd>答えを書く問題。<b>ひらがなで書けば OK</b> です（漢字でも正解になります）。</dd>
          <dt>わからない</dt><dd>答えがわからないときに押すと、正解と解説が出ます。その問題はあとでまた出てきます。</dd>
        </dl>
      </div>
      <div class="card">
        <h2 style="margin-top:0">暗記カードのつけ方</h2>
        <dl class="defs">
          <dt>× 思い出せない</dt><dd>今日のうちに、もう一度出ます。</dd>
          <dt>△ あやしい</dt><dd>近いうち（1〜3 日後）にまた出ます。</dd>
          <dt>○ 思い出せた</dt><dd>しばらくあけてから出ます（だんだん間があきます）。</dd>
        </dl>
        <p class="small" style="margin:0">正直につけるほど、効率よく覚えられます。</p>
      </div>
      ${KANJI.length ? `<div class="card">
        <h2 style="margin-top:0">答え方</h2>
        <div class="seg" role="group" aria-label="答え方">
          <button type="button" data-am="write" aria-pressed="${store.answerMode !== 'choice'}">✍️ 書き取り</button>
          <button type="button" data-am="choice" aria-pressed="${store.answerMode === 'choice'}">🔘 えらぶ・キーボード</button>
        </div>
        <p class="small" style="margin:8px 0 0">「書き取り」にすると、答えが人物・できごと・地名・用語の問題は、選択肢を出さずに<b>手書きで漢字を書いて</b>答えます。書いたら答えを見て、自分で ○・△・× をつけます。文を選ぶ問題・並べかえ・「すべて選ぶ」はそのままです。</p>
      </div>` : ''}
      <div class="card">
        <h2 style="margin-top:0">1 日の目標</h2>
        <div class="seg" role="group" aria-label="1 日の目標">
          ${[10, 20, 30, 50].map((n) => `<button type="button" data-goal="${n}" aria-pressed="${n === goal()}">${n} 問</button>`).join('')}
        </div>
        <p class="small" style="margin:8px 0 0">記録はこの端末のブラウザに保存されます。別の端末に移すときは 📊 のページの「記録を書き出す」を使ってください。</p>
      </div>
      <div class="card">
        <h2 style="margin-top:0">👪 保護者の方へ</h2>
        <p style="margin:0 0 10px">お子さんがまちがえた問題と、そのとき答えた内容を一覧で見られます。</p>
        <button class="btn sub" data-parents="1" type="button">保護者画面をひらく</button>
      </div>
      <div class="card">
        <h2 style="margin-top:0">このアプリについて</h2>
        <ul class="steps" style="padding-left:1.2em">
          <li>東海中学校の<b>公式のアプリではありません</b>。学校とは関係のない、受験勉強用の非公式アプリです。出題の傾向やむずかしさは、公開されている情報をもとにした目安です。</li>
          <li>${APP.contentNote}</li>
          <li>学習の記録は、この端末のブラウザの中にだけ保存されます。名前などの個人情報を入力する場所はなく、記録をインターネットに送ることもありません。</li>
        </ul>
      </div>
      <div class="row"><button class="btn sub" id="again" type="button">はじめての案内をもう一度見る</button>
      <button class="btn" id="back" type="button">ホームへ</button></div>`);
    onAll('[data-am]', 'click', (e) => {
      if (e.currentTarget.dataset.am === 'choice') store.answerMode = 'choice'; else delete store.answerMode;
      save();
      $app.querySelectorAll('[data-am]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.am === 'choice') === (store.answerMode === 'choice'))));
    });
    on('[data-parents]', 'click', () => parents());
    onAll('[data-goal]', 'click', (e) => {
      store.goal = +e.currentTarget.dataset.goal; save();
      $app.querySelectorAll('[data-goal]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.goal === store.goal)));
    });
    on('#again', 'click', () => guide(0));
    on('#back', 'click', home);
  }

  /* ───────── 出題設定 ───────── */
  function setup() {
    reset();
    let count = 10, level = 'all';
    h(`
      <h1>🎯 分野を選んで練習</h1>
      <p class="lead">練習したい分野を選んでください。</p>
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <strong>分野</strong>
          <span class="row"><button class="btn ghost" id="all" type="button">すべて</button><button class="btn ghost" id="none" type="button">解除</button></span>
        </div>
        <div class="checks">
          ${K.cats.filter((c) => !c.solo).map((c) => {
            const st = store.stats[`${K.id}:${c.id}`];
            const size = c.gens ? '自動で出題' : `${K.bank.filter((b) => b.cat === c.id).length} 問`;
            return `<label class="check"><input type="checkbox" value="${c.id}" checked>
              <span>${esc(c.name)}<br><span class="small">${size}${st ? `・正答率 ${pct(st.ok, st.n)}%` : ''}</span></span></label>`;
          }).join('')}
        </div>
        <div style="margin-top:16px"><strong>難易度</strong></div>
        <div class="seg" role="group" aria-label="難易度" style="margin-top:6px">
          ${Object.entries(LEVELS).map(([k, v]) => `<button type="button" data-lv="${k}" aria-pressed="${k === level}">${v.name}</button>`).join('')}
        </div>
        <div style="margin-top:16px"><strong>問題数</strong></div>
        <div class="seg" role="group" aria-label="問題数" style="margin-top:6px">
          ${[5, 10, 20].map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === count}">${n} 問</button>`).join('')}
        </div>
        <div style="margin-top:20px"><button class="btn wide" id="go" type="button">スタート</button></div>
      </div>
      <p class="small">復習日が来た問題 → まだ解いていない問題 → そのほか の順に出ます。</p>`);
    const boxes = () => [...$app.querySelectorAll('.checks input')];
    const sync = () => { $app.querySelector('#go').disabled = !boxes().some((b) => b.checked); };
    onAll('.checks input', 'change', sync);
    on('#all', 'click', () => { boxes().forEach((b) => { b.checked = true; }); sync(); });
    on('#none', 'click', () => { boxes().forEach((b) => { b.checked = false; }); sync(); });
    onAll('[data-n]', 'click', (e) => {
      count = +e.currentTarget.dataset.n;
      $app.querySelectorAll('[data-n]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === count)));
    });
    onAll('[data-lv]', 'click', (e) => {
      level = e.currentTarget.dataset.lv;
      $app.querySelectorAll('[data-lv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lv === level)));
    });
    on('#go', 'click', () => {
      const targets = boxes().filter((b) => b.checked).map((b) => ({ sid: K.id, cid: b.value }));
      const set = buildSet(targets, count, LEVELS[level].f);
      if (set.length) start(set, '分野を選んで練習');
    });
  }

  /* ───────── 出題（クイズ） ───────── */
  let session = null;
  let timerId = null;

  function start(questions, title) {
    if (!questions.length) { notice('出題できる問題がありません。'); return; }
    reset();
    session = { title, questions, idx: 0, results: [], t0: Date.now(), done: false };
    store.sessions++; save();
    show();
  }

  const elapsed = () => {
    const s = Math.floor((Date.now() - session.t0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  /* ───────── 書き取りで答える（答えが用語の問題） ───────── */
  const NOT_TERM = /正しいもの|誤って|まちがって|適切なもの|組み合わせ|並べ|説明|理由|特ちょう|どうなり|どのよう|ものはどれ|ことはどれ|すべて選び|何年|何才|何件|何海里|何％|いくつ|数字/;
  function writeTermOf(q) {
    if (!KANJI.length || store.answerMode === 'choice') return null;
    if (q.passage || (q.type !== 'choice' && q.type !== 'text')) return null;
    let w = q.type === 'text' ? q.accept[0] : q.ans;
    w = String(w).replace(/（.*?）$/, '').trim();
    if (!HAS_KANJI.test(w) || [...w].length > 10 || /[\s0-9０-９、。→―ー・「」『』,]/.test(w)) return null;
    if (q.type === 'choice' && NOT_TERM.test(q.q)) return null;
    return w;
  }
  const asWriteQ = (s) => s.replace(/はどれですか。$/, 'は何ですか。').replace(/どれですか。$/, '何ですか。');

  function writeShow(q, term) {
    const s = SUBJ[q.subject], cat = catOf(q.subject, q.cat);
    const total = session.questions.length;
    const card = store.cards[qkey(q)];
    const len = [...term].length;
    const yomi = q.type === 'text' ? (q.accept.find((x) => KANA_ONLY.test(x)) || '') : '';
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:${s.color}">${esc(cat ? cat.name : s.name)}</span> <span class="lv" title="難易度">${stars(q.lv || 1)}</span> <span class="small">✍️ 書き取り</span>${card ? (card.lapses ? ` <span class="small">・前にまちがえた</span>` : '') : ' <span class="small">・初めて</span>'}</span>
        <span>${session.idx + 1} / ${total}　⏱ <span id="clock">${elapsed()}</span></span></div>
      <div class="progress"><i style="width:${(session.idx / total) * 100}%"></i></div>
      <div class="card">
        <div class="qtext">${rich(maskHint(asWriteQ(q.q), term))}</div>
        <div class="small">漢字 ${len} 文字で書きましょう。</div>
        <div class="pad" id="pad"><canvas id="guide" aria-hidden="true"></canvas><canvas id="ink" aria-label="ここに答えを書く"></canvas></div>
        ${padTools()}
        <div id="back" hidden>
          <hr>
          <div class="small">答え</div>
          <div class="kanji-ans">${esc(term)}</div>
          ${yomi ? `<div class="small">${esc(yomi)}</div>` : ''}
          ${q.ans !== term ? `<div class="small">（${esc(q.ans)}）</div>` : ''}
          ${q.exp ? `<div class="exp-title">解説</div><div class="exp">${rich(q.exp)}</div>` : ''}
          <p class="small" style="margin:8px 0 0">自分の字と見くらべましょう。答えはわかったけれど字がちがったときは △ にします。</p>
        </div>
      </div>
      <div id="act"><button class="btn wide" id="flip" type="button">答えを見る</button></div>`);
    clearInterval(timerId);
    timerId = setInterval(() => { const c = document.getElementById('clock'); if (c) c.textContent = elapsed(); else clearInterval(timerId); }, 1000);
    wirePad(len);
    const shownAt = Date.now();
    let open = false, done = false;
    const LABEL = { ok: '○ 書けた', hard: '△ おしい', ng: '× 書けなかった' };
    const grade = (g) => {
      if (done) return;
      done = true;
      const ok = g === 'ok';
      if (!ok) logMiss(Object.assign({}, q, { q: asWriteQ(q.q), ans: term }), g, 'write', '', padImage());
      session.results.push({ q, ok, given: `書き取り：${LABEL[g]}` });
      record(q, ok, (Date.now() - shownAt) / 1000, g);
      session.idx++;
      if (session.idx < session.questions.length) show(); else result();
    };
    const flip = () => {
      if (open) return;
      open = true;
      $app.querySelector('#back').hidden = false;
      $app.querySelector('#act').innerHTML = `
        <p class="small" style="margin:0 0 6px">正しく書けましたか？</p>
        <div class="grade">
          <button class="btn g-ng" data-gr="ng" type="button"><b>×</b>書けなかった</button>
          <button class="btn g-hard" data-gr="hard" type="button"><b>△</b>おしい</button>
          <button class="btn g-ok" data-gr="ok" type="button"><b>○</b>書けた</button>
        </div>`;
      onAll('[data-gr]', 'click', (e) => grade(e.currentTarget.dataset.gr));
      $app.querySelector('#back').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    on('#flip', 'click', flip);
    setKeys((e) => {
      if (!open && e.key === 'Enter') { e.preventDefault(); flip(); return; }
      if (open) { const g = { 1: 'ng', 2: 'hard', 3: 'ok' }[e.key]; if (g) grade(g); }
    });
  }

  function show() {
    const q = session.questions[session.idx];
    const wterm = writeTermOf(q);
    if (wterm) { writeShow(q, wterm); return; }
    const s = SUBJ[q.subject], cat = catOf(q.subject, q.cat);
    const total = session.questions.length;
    const card = store.cards[qkey(q)];
    const body = q.type === 'essay'
      ? `<textarea id="essay" class="essay" rows="4" aria-label="記述の答え" placeholder="ここに書く（下書きでもよい）"></textarea>
        <div class="small" id="ecount">${q.lim ? `0 / ${q.lim} 字` : '0 字'}</div>
        <div class="hint">書けたら「答えを見る」。模範解答と採点のポイントを見て、自分で ○・△・× をつけます。</div>
        <button class="btn wide" id="reveal" type="button">答えを見る</button>`
      : q.type === 'text' || q.type === 'num'
      ? `<div class="answer-row">
          <input id="ans" type="text" ${q.type === 'num' ? 'inputmode="decimal" ' : ''}autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="答え" placeholder="${q.type === 'num' ? '数字で答える' : 'ここに書く'}">
          ${q.type === 'num' && q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}
          <button class="btn" id="submitText" type="button">答える</button>
        </div>
        <div class="err" id="err"></div>
        <div class="hint">${q.type === 'num' ? '計算：数字だけで OK（単位はいりません）。小数でも分数（1/2 など）でもかまいません。' : q.passage ? '本文の言葉を、そのまま書きぬきます（句読点やかぎかっこはなくてもかまいません）。' : esc(APP.textHint)}</div>`
      : q.type === 'multi'
      ? `<div class="multi-note">✅ あてはまるものを<b>すべて</b>選んでから「答える」を押してください。</div>
        <div class="choices">${q.choices.map((c, i) => `<button class="choice mchoice" type="button" data-i="${i}" aria-pressed="false"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>
        <div class="err" id="err"></div>
        <button class="btn wide" id="submitMulti" type="button">答える</button>`
      : `<div class="choices">${q.choices.map((c, i) => `<button class="choice" type="button" data-i="${i}"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>`;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:${s.color}">${esc(cat ? cat.name : s.name)}</span> <span class="lv" title="難易度">${stars(q.lv || 1)}</span>${q.type === 'essay' ? ' <span class="small">記述（自己採点）</span>' : q.type === 'text' ? ` <span class="small">${q.passage ? '抜き出し' : '記述'}</span>` : q.type === 'num' ? ' <span class="small">計算</span>' : q.type === 'multi' ? ' <span class="small">すべて選ぶ</span>' : ''}${card ? (card.lapses ? ` <span class="small">・前にまちがえた</span>` : '') : ' <span class="small">・初めて</span>'}</span>
        <span>${session.idx + 1} / ${total}　⏱ <span id="clock">${elapsed()}</span></span></div>
      <div class="progress"><i style="width:${(session.idx / total) * 100}%"></i></div>
      ${q.passage ? passageBox(q.passage) : ''}
      <div class="card">
        <div class="qtext">${rich(q.q)}</div>
        <div id="input">${body}</div>
        <div id="fb"></div>
      </div>
      <div class="row" style="justify-content:space-between">
        <button class="btn ghost" id="skip" type="button">わからない</button>
        <button class="btn" id="next" type="button" hidden>${session.idx + 1 < total ? '次の問題へ' : '結果を見る'}</button>
      </div>`);

    clearInterval(timerId);
    timerId = setInterval(() => { const c = document.getElementById('clock'); if (c) c.textContent = elapsed(); else clearInterval(timerId); }, 1000);

    const shownAt = Date.now();
    let answered = false;
    const finish = (ok, given, g, note) => {
      if (answered) return;
      answered = true;
      session.results.push({ q, ok, given });
      record(q, ok, (Date.now() - shownAt) / 1000, g);
      if (!ok) logMiss(q, g === 'hard' ? 'hard' : 'ng', q.type === 'essay' ? 'essay' : 'quiz', q.type === 'essay' ? (given == null ? null : (note || '（何も書かなかった）')) : given);
      const c = store.cards[qkey(q)];
      const nextTxt = c.box === 0 ? 'このあと「今日の復習」でもう一度出ます。' : `次の復習：${md(c.due)}（${INTERVALS[c.box]} 日後）`;
      $app.querySelector('#skip').hidden = true;
      const nb = $app.querySelector('#next');
      nb.hidden = false;
      if (q.type === 'essay') {
        $app.querySelector('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'ng'}"><div class="mark">${esc(given || '× わからない')}</div><div class="small" style="margin-top:8px">${nextTxt}</div></div>`;
        if (given == null) $app.querySelector('#fb').insertAdjacentHTML('afterbegin', essayAnswer(q));
        $app.querySelectorAll('#input button, #input textarea').forEach((el) => { el.disabled = true; });
        nb.focus();
        return;
      }
      $app.querySelector('#fb').innerHTML = `
        <div class="feedback ${ok ? 'ok' : 'ng'}">
          <div class="mark">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
          ${ok ? '' : `<div>正解：<strong>${esc(q.ans)}</strong></div>`}
          ${q.exp ? `<div class="exp-title">解説</div><div class="exp">${rich(q.exp)}</div>` : ''}
          <div class="small" style="margin-top:8px">${nextTxt}</div>
        </div>`;
      $app.querySelectorAll('#input button:not(.mchoice), #input input').forEach((el) => { el.disabled = true; });
      $app.querySelectorAll('#input .mchoice').forEach((el) => { el.disabled = true; });
      nb.focus();
    };
    const next = () => {
      if (!answered) return;
      session.idx++;
      if (session.idx < session.questions.length) show(); else result();
    };
    on('#next', 'click', next);
    on('#skip', 'click', () => finish(false, null));

    wirePassage();
    if (q.type === 'essay') {
      const ta = $app.querySelector('#essay'), cnt = $app.querySelector('#ecount');
      ta.addEventListener('input', () => {
        const n = [...ta.value.replace(/\s/g, '')].length;
        cnt.textContent = q.lim ? `${n} / ${q.lim} 字` : `${n} 字`;
        cnt.classList.toggle('over', !!q.lim && n > q.lim);
      });
      const LABEL = { ok: '○ よく書けた', hard: '△ 部分的に書けた', ng: '× 書けなかった' };
      let opened = false;
      const reveal = () => {
        if (opened || answered) return;
        opened = true;
        ta.readOnly = true;
        const rb = $app.querySelector('#reveal');
        rb.insertAdjacentHTML('beforebegin', `${essayAnswer(q)}
          <p class="small" style="margin:10px 0 6px">ポイントがそろっていれば ○、一部だけなら △ にします。</p>
          <div class="grade">
            <button class="btn g-ng" data-gr="ng" type="button"><b>×</b>書けなかった</button>
            <button class="btn g-hard" data-gr="hard" type="button"><b>△</b>部分的</button>
            <button class="btn g-ok" data-gr="ok" type="button"><b>○</b>よく書けた</button>
          </div>`);
        rb.remove();
        onAll('[data-gr]', 'click', (e) => { const g = e.currentTarget.dataset.gr; finish(g === 'ok', LABEL[g], g, ta.value.trim()); });
      };
      on('#reveal', 'click', reveal);
      setKeys((e) => {
        if (answered) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); next(); } return; }
        if (opened && e.target.tagName !== 'TEXTAREA') { const g = { 1: 'ng', 2: 'hard', 3: 'ok' }[e.key]; if (g) $app.querySelector(`[data-gr="${g}"]`).click(); }
      });
    } else if (q.type === 'choice') {
      onAll('.choice', 'click', (e) => {
        const btn = e.currentTarget;
        const given = q.choices[+btn.dataset.i];
        const ok = given === q.ans;
        $app.querySelectorAll('.choice').forEach((b) => {
          if (q.choices[+b.dataset.i] === q.ans) b.classList.add('ok');
        });
        if (!ok) btn.classList.add('ng');
        finish(ok, given);
      });
      setKeys((e) => {
        if (answered) { if (e.key === 'Enter') { e.preventDefault(); next(); } return; }
        const b = $app.querySelector(`.choice[data-i="${+e.key - 1}"]`);
        if (b) b.click();
      });
    } else if (q.type === 'multi') {
      const err = $app.querySelector('#err');
      const btns = [...$app.querySelectorAll('.mchoice')];
      const toggle = (b) => { if (!answered) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); err.textContent = ''; } };
      btns.forEach((b) => b.addEventListener('click', () => toggle(b)));
      const submit = () => {
        if (answered) return;
        const picked = btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => q.choices[+b.dataset.i]);
        if (!picked.length) { err.textContent = '1 つ以上選んでください。'; return; }
        const ok = picked.length === q.correct.length && picked.every((x) => q.correct.includes(x));
        btns.forEach((b) => {
          const c = q.choices[+b.dataset.i], sel = b.getAttribute('aria-pressed') === 'true';
          if (q.correct.includes(c)) b.classList.add('ok'); else if (sel) b.classList.add('ng');
        });
        finish(ok, picked.join('／'));
      };
      on('#submitMulti', 'click', submit);
      setKeys((e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (answered) next(); else submit(); return; }
        const b = btns[+e.key - 1];
        if (b) toggle(b);
      });
    } else {
      const input = $app.querySelector('#ans');
      const err = $app.querySelector('#err');
      const submit = () => {
        if (answered) return;
        const v = input.value.trim();
        if (!v) { err.textContent = '答えを書いてください。'; return; }
        if (q.type === 'num' && !parseAnswer(v)) { err.textContent = '数字で答えてください（例：12、0.5、1/3）。'; return; }
        err.textContent = '';
        finish(q.type === 'num' ? numOk(q, v) : textOk(q, v), v);
      };
      on('#submitText', 'click', submit);
      setKeys((e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        if (answered) next(); else submit();
      });
      if (window.matchMedia('(min-width: 700px)').matches) input.focus();
    }
  }

  /* ───────── 長文読解 ───────── */
  const PASSAGES = K.passages || {};
  const PASSAGE_IDS = Object.keys(PASSAGES);
  const pQuestions = (pid) => K.bank.map((item, idx) => ({ item, idx })).filter((x) => x.item.p === pid);
  /* 本文の書き方：[[①|線を引く部分]]、［Ａ］などの空らんはそのまま */
  const pRich = (t) => rich(t).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '<span class="bsen"><span class="bno">$1</span><u>$2</u></span>');
  const pLen = (pid) => [...PASSAGES[pid].text.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1').replace(/\s/g, '')].length;
  let pOpen = true;
  function passageBox(pid) {
    const P = PASSAGES[pid];
    if (!P) return '';
    return `<details class="passage card" ${pOpen ? 'open' : ''}>
      <summary><span class="tag" style="--tc:var(--c-mix)">${esc(P.kind)}</span> <b>${esc(P.title)}</b> <span class="small">（本文 約 ${Math.round(pLen(pid) / 100) * 100} 字・タップで${pOpen ? 'たたむ' : 'ひらく'}）</span></summary>
      <div class="ptext">${P.text.trim().split(/\n+/).map((para) => `<p>${pRich(para)}</p>`).join('')}</div>
      ${P.note ? `<p class="small pnote">${esc(P.note)}</p>` : ''}
    </details>`;
  }
  function wirePassage() {
    const d = $app.querySelector('details.passage');
    if (!d) return;
    d.addEventListener('toggle', () => {
      pOpen = d.open;
      const sm = d.querySelector('summary .small');
      if (sm) sm.textContent = sm.textContent.replace(/たたむ|ひらく/, pOpen ? 'たたむ' : 'ひらく');
    });
  }
  const essayAnswer = (q) => `<div class="essay-ans">
      <div class="exp-title">解答例</div><div class="model">${rich(q.ans)}</div>
      ${q.pts.length ? `<div class="exp-title">採点のポイント</div><ul class="pts">${q.pts.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>` : ''}
    </div>`;

  function dokkaiHome() {
    reset();
    const t = today();
    const rows = PASSAGE_IDS.map((pid) => {
      const P = PASSAGES[pid], qs = pQuestions(pid);
      const m = { total: qs.length, new: 0, learn: 0, fixed: 0, master: 0 };
      let due = 0;
      qs.forEach(({ item }) => { const c = store.cards[bkey(K.id, item)]; m[stageOf(c)]++; if (c && c.due <= t) due++; });
      return `<button class="tile ptile" style="--tc:var(--c-mix)" data-p="${esc(pid)}">
        <span class="tt"><span class="tag" style="--tc:var(--c-mix)">${esc(P.kind)}</span> ${esc(P.title)}</span>
        ${masteryBar(m, P.title, false)}
        <span class="badge">約 ${Math.round(pLen(pid) / 100) * 100} 字・${qs.length} 問${due ? `・🔁 復習 ${due}` : m.new === m.total ? '・まだ' : `・覚えた ${m.master}／${m.total}`}</span>
      </button>`;
    }).join('');
    h(`
      <h1>📖 長文読解</h1>
      <p class="lead">本文を読んで、順番に答えます（★★★ 東海中レベル）。本文は問題の上にいつでも出ています。記述問題は、解答例と採点のポイントを見て、自分で ○・△・× をつけます。</p>
      <p class="small">コツ：先に設問をざっと見てから本文を読むと、どこに注意すればよいかがわかります。理由を聞かれたら「〜から。」、気持ちを聞かれたら「〜気持ち。」で終えましょう。</p>
      ${stageLegend()}
      <div class="grid cats">${rows}</div>
      <p class="small">文章はすべてこのアプリのために書いたものです。復習の日が来た文章には 🔁 が出ます。もう一度通して解き直しましょう。</p>`);
    onAll('[data-p]', 'click', (e) => {
      const pid = e.currentTarget.dataset.p;
      pOpen = true;
      start(pQuestions(pid).map(({ item, idx }) => fromBank(K, item, idx)), PASSAGES[pid].title);
    });
  }

  /* ───────── 結果 ───────── */
  function result() {
    clearInterval(timerId);
    session.done = true;
    pushSync();
    pushSheet();
    setKeys(null);
    const rs = session.results;
    const ok = rs.filter((r) => r.ok).length;
    const p = pct(ok, rs.length);
    const msg = p === 100 ? 'パーフェクト！すばらしい！' : p >= 80 ? 'よくできました！' : p >= 60 ? 'あと少し！まちがえた問題を見直そう。' : '解説を読んで、もう一度チャレンジしよう。';
    const wrongs = rs.filter((r) => !r.ok).map((r) => r.q);
    // 分野ごとの結果
    const byCat = {};
    rs.forEach((r) => { const b = byCat[r.q.cat] || (byCat[r.q.cat] = { n: 0, ok: 0 }); b.n++; if (r.ok) b.ok++; });
    const catRows = Object.entries(byCat).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([cid, v]) =>
      `<div class="stat-row"><span>${esc(catOf(K.id, cid).name)}</span><span class="bar"><i style="width:${pct(v.ok, v.n)}%" data-tip="${v.ok}/${v.n} 問正解"></i></span><span class="pc">${v.ok}/${v.n}</span></div>`).join('');
    h(`
      <h1>${esc(session.title)} の結果</h1>
      <div class="card">
        <div class="score">${ok}<small> / ${rs.length} 問</small>　${p}<small>%</small></div>
        <p style="margin:6px 0 0">${msg}</p>
        <p class="small" style="margin:4px 0 0">かかった時間 ${elapsed()}${wrongs.length ? '・まちがえた問題は、あとでもう一度出てきます' : ''}</p>
        ${Object.keys(byCat).length > 1 ? `<div style="margin-top:10px">${catRows}</div>` : ''}
      </div>
      ${session.daily ? `<div class="card hero">
        <div class="small">今日の目標</div>
        <div class="goal"><b>${todayCount()}</b> / ${goal()} 問</div>
        <div class="progress big"><i style="width:${Math.min(100, (todayCount() / goal()) * 100)}%"></i></div>
        <p style="margin:0 0 8px">${todayCount() >= goal() ? '🎉 今日の目標を達成しました！' : `あと <b>${goal() - todayCount()}</b> 問で目標達成！`}</p>
        <button class="btn wide" id="more" type="button">▶ 続けて 10 問</button>
      </div>` : ''}
      <div class="row" style="margin-bottom:14px">
        ${wrongs.length ? '<button class="btn sub" id="redo" type="button">まちがえた問題をもう一度</button>' : ''}
        <button class="btn sub" id="home2" type="button">ホームへ</button>
      </div>
      <div class="card">
        <strong>ふり返り</strong> <span class="small">（タップで解説）</span>
        <ul class="rlist">
          ${rs.map((r) => `<li><details>
            <summary><span class="m ${r.ok ? 'ok' : 'ng'}">${r.ok ? '○' : '×'}</span><span class="qs">${rich(r.q.q)}</span></summary>
            <div class="body">
              <div>正解：<strong>${esc(r.q.ans)}</strong>${!r.ok ? `　あなたの答え：${r.given == null ? 'わからない' : esc(r.given)}` : ''}</div>
              <div class="exp">${rich(r.q.exp || '')}</div>
            </div></details></li>`).join('')}
        </ul>
      </div>`);
    on('#redo', 'click', () => start(wrongs.map((q) => Object.assign({}, q, { choices: q.choices && shuffle(q.choices) })), 'もう一度'));
    on('#home2', 'click', home);
    on('#more', 'click', startDaily);
  }

  /* ───────── 暗記カード ───────── */
  const asRecall = (s) => s.replace(/として正しいものはどれですか。/, 'は？').replace(/はどれですか。/, 'は？').replace(/をすべて選びなさい。/, 'をすべて答えよう（いくつある？）');

  function flashStart(cards, title) {
    if (!cards.length) { notice('カードがありません。'); return; }
    reset();
    session = { title, questions: cards, idx: 0, results: [], t0: Date.now(), done: false, flash: true };
    flashShow();
  }

  function flashShow() {
    const q = session.questions[session.idx];
    const cat = catOf(q.subject, q.cat);
    const total = session.questions.length;
    const shownAt = Date.now();
    let open = false;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:var(--ok)">${esc(cat.name)}</span> <span class="lv">${stars(q.lv || 1)}</span></span>
        <span>${session.idx + 1} / ${total}</span></div>
      <div class="progress"><i style="width:${(session.idx / total) * 100}%"></i></div>
      <div class="card flash">
        <div class="small">問題</div>
        <div class="qtext">${rich(q.type === 'text' || q.type === 'num' ? q.q : asRecall(q.q))}</div>
        <div id="back" hidden>
          <hr>
          <div class="small">答え</div>
          <div class="flash-ans">${esc(q.ans)}</div>
          ${q.exp ? `<div class="exp">${rich(q.exp)}</div>` : ''}
        </div>
      </div>
      <div id="act">
        <button class="btn wide" id="flip" type="button">答えを見る（スペース）</button>
      </div>`);
    const grade = (g) => {
      schedule(q, g);
      if (g === 'ng') logMiss(q, 'ng', 'card', '');
      logDay(g === 'ok', (Date.now() - shownAt) / 1000, 'card');
      save();
      session.results.push({ q, g });
      session.idx++;
      if (session.idx < total) flashShow(); else flashResult();
    };
    const flip = () => {
      if (open) return;
      open = true;
      $app.querySelector('#back').hidden = false;
      $app.querySelector('#act').innerHTML = `
        <p class="small" style="margin:0 0 6px">思い出せましたか？</p>
        <div class="grade">
          <button class="btn g-ng" data-g="ng" type="button"><b>×</b>思い出せない</button>
          <button class="btn g-hard" data-g="hard" type="button"><b>△</b>あやしい</button>
          <button class="btn g-ok" data-g="ok" type="button"><b>○</b>思い出せた</button>
        </div>`;
      onAll('[data-g]', 'click', (e) => grade(e.currentTarget.dataset.g));
    };
    on('#flip', 'click', flip);
    setKeys((e) => {
      if (!open && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); return; }
      if (open) { const g = { 1: 'ng', 2: 'hard', 3: 'ok' }[e.key]; if (g) grade(g); }
    });
  }

  function flashResult() {
    session.done = true;
    pushSync();
    pushSheet();
    setKeys(null);
    const rs = session.results;
    const cnt = (g) => rs.filter((r) => r.g === g).length;
    const weak = rs.filter((r) => r.g !== 'ok').map((r) => r.q);
    h(`
      <h1>🃏 ${esc(session.title)} の結果</h1>
      <div class="card">
        <div class="kpis">
          <div class="kpi"><b>${cnt('ok')}</b><span>○ 思い出せた</span></div>
          <div class="kpi"><b>${cnt('hard')}</b><span>△ あやしい</span></div>
          <div class="kpi"><b>${cnt('ng')}</b><span>× 思い出せない</span></div>
        </div>
        <p class="small" style="margin:8px 0 0">「×」は今日のうちに、「△」は近いうちに、「○」は数日〜数週間後にまた出ます。</p>
      </div>
      <div class="row">
        ${weak.length ? '<button class="btn" id="again" type="button">「×」「△」だけもう一度</button>' : ''}
        <button class="btn sub" id="home2" type="button">ホームへ</button>
      </div>`);
    on('#again', 'click', () => flashStart(shuffle(weak), session.title));
    on('#home2', 'click', home);
  }


  /* ───────── 漢字で書く（手書きで書いて、自分で答え合わせ） ─────────
   * 言葉は「記述式の問題のうち答えに漢字がふくまれるもの」と SUBJECT.kanjiExtra（[分野, ヒント, 漢字, よみ, 解説]）から作る。
   * 記録は store.kanji に、クイズとは別に保存する（間隔反復のしくみは同じ）。 */
  const HAS_KANJI = /[一-鿿々]/;
  const KANA_ONLY = /^[ぁ-ゖー・]+$/;
  const KANJI = (() => {
    if (!APP.kanji) return [];
    const list = [], seen = new Set();
    const add = (w) => { if (!w.ans || seen.has(w.ans)) return; seen.add(w.ans); w.key = w.ans; list.push(w); };
    (K.bank || []).forEach((b) => {
      if (b.a && !b.p && HAS_KANJI.test(b.a[0])) add({ cat: b.cat, lv: lvOf(b), q: b.q, ans: b.a[0], yomi: b.a.find((x) => KANA_ONLY.test(x)) || '', exp: b.exp || '' });
    });
    (K.kanjiExtra || []).forEach(([cat, q, ans, yomi, exp]) => add({ cat, lv: 2, q, ans, yomi: yomi || '', exp: exp || '' }));
    return list.filter((w) => catOf(K.id, w.cat));
  })();
  /* ヒントの中に答えの一部（漢字 2 字以上）が入っていたら 〇 でかくす（例：「〜した条約」→「〜した〇〇」） */
  function maskHint(q, ans) {
    let out = q;
    const chars = [...ans];
    for (let n = chars.length; n >= 2; n--) {
      for (let i = 0; i + n <= chars.length; i++) {
        const sub = chars.slice(i, i + n).join('');
        if (/^[\u4e00-\u9fff々]+$/.test(sub) && out.includes(sub)) out = out.split(sub).join('〇'.repeat(n));
      }
    }
    return out;
  }
  const kGroup = (w) => String((catOf(K.id, w.cat) || {}).note || '').split('・')[0] || 'そのほか';
  const K_GROUPS = ['すべて', ...new Set(KANJI.map(kGroup))];

  function kSchedule(w, grade) {
    const t = today();
    let c = store.kanji[w.key];
    const isNew = !c;
    if (!c) c = store.kanji[w.key] = { box: 0, due: t, n: 0, ok: 0, lapses: 0 };
    c.n++;
    if (grade === 'ok') c.ok++;
    if (grade === 'ng') { c.lapses++; c.box = 0; }
    else if (grade === 'hard') c.box = Math.max(1, c.box - 1);
    else if (isNew) c.box = 2;
    else if (c.due <= t) c.box = Math.min(5, c.box + 1);
    c.due = addDays(t, INTERVALS[c.box]);
    c.last = t;
  }

  /* 出す順：①復習日が来た言葉（忘れやすい順）②まだ書いていない言葉 ③そのほか */
  function kanjiSet(words, n) {
    const t = today();
    const due = [], fresh = [], rest = [];
    words.forEach((w) => {
      const c = store.kanji[w.key];
      if (!c) fresh.push(w); else if (c.due <= t) due.push(w); else rest.push(w);
    });
    due.sort((a, b) => store.kanji[a.key].box - store.kanji[b.key].box);
    rest.sort((a, b) => store.kanji[a.key].due.localeCompare(store.kanji[b.key].due));
    return due.concat(shuffle(fresh), rest).slice(0, n);
  }

  function kanjiHome(group = 'すべて', count = 10) {
    reset();
    const words = KANJI.filter((w) => group === 'すべて' || kGroup(w) === group);
    const m = { total: words.length, new: 0, learn: 0, fixed: 0, master: 0 };
    words.forEach((w) => { m[stageOf(store.kanji[w.key])]++; });
    const t = today();
    const due = words.filter((w) => store.kanji[w.key] && store.kanji[w.key].due <= t).length;
    const missed = words.filter((w) => store.kanji[w.key] && store.kanji[w.key].lapses > 0);
    h(`
      <h1>✍️ 漢字で書く</h1>
      <p class="lead">ヒントを読んで、用語を<b>漢字で</b>わくの中に書きます。書けたら「答えを見る」を押し、正しい漢字と見くらべて、自分で ○・△・× をつけてください。</p>
      <div class="card">
        <div class="row" style="margin-bottom:10px"><span class="small">分野</span>
          <div class="seg" role="group" aria-label="分野">${K_GROUPS.map((g) => `<button type="button" data-g="${esc(g)}" aria-pressed="${g === group}">${esc(g)}</button>`).join('')}</div></div>
        <div class="row" style="margin-bottom:12px"><span class="small">1 回に書く数</span>
          <div class="seg" role="group" aria-label="1 回に書く数">${[5, 10, 20].map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === count}">${n} 語</button>`).join('')}</div></div>
        <button class="btn wide start" id="kgo" type="button">▶ 書きはじめる<small>${due ? `復習 ${Math.min(due, count)} 語をふくむ ` : ''}${count} 語</small></button>
        ${missed.length ? `<button class="btn sub wide" id="kmiss" type="button" style="margin-top:10px">まちがえた言葉だけ（${missed.length} 語）</button>` : ''}
      </div>
      <div class="card">
        <strong>${esc(group === 'すべて' ? '全部' : group)}の ${m.total} 語のうち</strong>
        ${masteryBar(m, '漢字で書く')}
        <div class="legend"><i class="m4"></i>書ける<i class="m3"></i>もう少し<i class="m2"></i>にがて<i class="m0"></i>まだ</div>
        <p class="small" style="margin:4px 0 0">書ける <b>${m.master}</b>・もう少し <b>${m.fixed}</b>・にがて <b>${m.learn}</b>・まだ <b>${m.new}</b>${due ? `・今日の復習 <b>${due}</b>` : ''}</p>
      </div>
      <p class="small">タブレットやスマホでは指やペンで、パソコンではマウスで書けます。とめ・はね・はらいまでていねいに書きましょう。</p>`);
    onAll('[data-g]', 'click', (e) => kanjiHome(e.currentTarget.dataset.g, count));
    onAll('[data-n]', 'click', (e) => kanjiHome(group, +e.currentTarget.dataset.n));
    on('#kgo', 'click', () => kanjiStart(kanjiSet(words, count), '漢字で書く'));
    on('#kmiss', 'click', () => kanjiStart(shuffle(missed).slice(0, Math.max(count, 10)), 'まちがえた言葉'));
  }

  function kanjiStart(words, title) {
    if (!words.length) { notice('書く言葉がありません。'); return; }
    reset();
    session = { title, questions: words, idx: 0, results: [], t0: Date.now(), done: false, kanji: true };
    kanjiShow();
  }

  /* 手書きのわくの下のボタン（マスの大きさ・1 画もどす・ぜんぶ消す） */
  const padTools = () => `<div class="row pad-tools">
          <div class="seg" role="group" aria-label="マスの大きさ">
            <button type="button" data-ps="l" aria-pressed="${store.padSize !== 'xl'}" aria-label="マス 大">マス大</button>
            <button type="button" data-ps="xl" aria-pressed="${store.padSize === 'xl'}" aria-label="マス 特大">特大</button>
          </div>
          <span class="grow"></span>
          <button class="btn ghost" id="undo" type="button" aria-label="1 画もどす">↩ もどす</button>
          <button class="btn ghost" id="clear" type="button" aria-label="ぜんぶ消す">消す</button>
        </div>`;
  function wirePad(n) {
    let pad = setupPad(n);
    on('#undo', 'click', () => pad.undo());
    on('#clear', 'click', () => pad.clear());
    onAll('[data-ps]', 'click', (e) => {
      if (e.currentTarget.dataset.ps === 'xl') store.padSize = 'xl'; else delete store.padSize;
      save();
      $app.querySelectorAll('[data-ps]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.ps === 'xl') === (store.padSize === 'xl'))));
      // 大きさを変えたら、わくを作り直す（書いた線は消える）
      $app.querySelector('#pad').innerHTML = '<canvas id="guide" aria-hidden="true"></canvas><canvas id="ink" aria-label="ここに書く"></canvas>';
      pad = setupPad(n);
    });
  }

  /* 手書きのわく：字数ぶんの練習用のます目（十字の点線つき）をかき、その上に線を書けるようにする */
  function setupPad(n) {
    const pad = $app.querySelector('#pad');
    const guide = pad.querySelector('#guide'), ink = pad.querySelector('#ink');
    const W = pad.clientWidth;
    // マスの大きさ：ふつうは 1 マス 100px 以上（スマホで 1 行 3 マス）、特大は 150px 以上（1 行 2 マス）
    const xl = store.padSize === 'xl';
    const perRow = Math.max(1, Math.min(n, Math.floor(W / (xl ? 150 : 100))));
    const box = Math.min(xl ? 240 : 170, Math.floor(W / perRow));
    const rows = Math.ceil(n / perRow);
    const H = rows * box;
    const dpr = window.devicePixelRatio || 1;
    [guide, ink].forEach((c) => {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = `${W}px`; c.style.height = `${H}px`;
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    pad.style.height = `${H}px`;
    const css = getComputedStyle(document.documentElement);
    const lineColor = css.getPropertyValue('--line').trim() || '#ccc';
    const inkColor = css.getPropertyValue('--text').trim() || '#000';
    const g = guide.getContext('2d');
    const x0 = Math.floor((W - perRow * box) / 2);
    g.strokeStyle = lineColor;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % perRow) * box, y = Math.floor(i / perRow) * box;
      g.setLineDash([]); g.lineWidth = 2; g.strokeRect(x + 3, y + 3, box - 6, box - 6);
      g.setLineDash([5, 5]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + box / 2, y + 6); g.lineTo(x + box / 2, y + box - 6);
      g.moveTo(x + 6, y + box / 2); g.lineTo(x + box - 6, y + box / 2); g.stroke();
    }
    const ctx = ink.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = inkColor;
    ctx.lineWidth = Math.max(3, Math.round(box / 22));
    const strokes = [];
    let cur = null;
    const pos = (e) => { const r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const redraw = () => {
      ctx.clearRect(0, 0, W, H);
      strokes.forEach((st) => {
        ctx.beginPath();
        st.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (st.length === 1) ctx.lineTo(st[0][0] + 0.1, st[0][1] + 0.1);
        ctx.stroke();
      });
    };
    ink.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { ink.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      cur = [pos(e)]; strokes.push(cur); redraw();
    });
    ink.addEventListener('pointermove', (e) => {
      if (!cur) return;
      e.preventDefault();
      const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (pts.length ? pts : [e]).forEach((pe) => {
        const p = pos(pe), a = cur[cur.length - 1];
        cur.push(p);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      });
    });
    const end = () => { cur = null; };
    ink.addEventListener('pointerup', end);
    ink.addEventListener('pointercancel', end);
    ink.addEventListener('pointerleave', end);
    return { undo() { strokes.pop(); redraw(); }, clear() { strokes.length = 0; redraw(); }, count: () => strokes.length };
  }

  function kanjiShow() {
    const w = session.questions[session.idx];
    const cat = catOf(K.id, w.cat);
    const total = session.questions.length;
    const c = store.kanji[w.key];
    const shownAt = Date.now();
    let open = false;
    const len = [...w.ans].length;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:var(--ok)">✍️ 漢字で書く</span> <span class="small">${esc(cat ? cat.name : '')}${c ? (c.lapses ? '・前に書けなかった' : '') : '・初めて'}</span></span>
        <span>${session.idx + 1} / ${total}</span></div>
      <div class="progress"><i style="width:${(session.idx / total) * 100}%"></i></div>
      <div class="card">
        <div class="qtext">${rich(maskHint(w.q, w.ans))}</div>
        <div class="small">${len} 文字で書きましょう。${w.yomi ? `<button class="linkbtn" id="yomiBtn" type="button">読みを見る</button><span id="yomi" hidden>読み：<b>${esc(w.yomi)}</b></span>` : ''}</div>
        <div class="pad" id="pad"><canvas id="guide" aria-hidden="true"></canvas><canvas id="ink" aria-label="ここに漢字を書く"></canvas></div>
        ${padTools()}
        <div id="back" hidden>
          <hr>
          <div class="small">正しい漢字</div>
          <div class="kanji-ans">${esc(w.ans)}</div>
          ${w.yomi ? `<div class="small">${esc(w.yomi)}</div>` : ''}
          ${w.exp ? `<div class="exp">${rich(w.exp)}</div>` : ''}
          <p class="small" style="margin:8px 0 0">自分の字と見くらべましょう。1 画でもちがったら △ か × にします。</p>
        </div>
      </div>
      <div id="act"><button class="btn wide" id="flip" type="button">答えを見る</button></div>`);
    wirePad(len);
    on('#yomiBtn', 'click', (e) => { e.currentTarget.hidden = true; $app.querySelector('#yomi').hidden = false; });
    const grade = (g) => {
      if (g !== 'ok') logMiss(w, g, 'kanji', '', padImage());
      kSchedule(w, g);
      logDay(g === 'ok', (Date.now() - shownAt) / 1000, 'card');
      save();
      session.results.push({ w, g });
      session.idx++;
      if (session.idx < total) kanjiShow(); else kanjiResult();
    };
    const flip = () => {
      if (open) return;
      open = true;
      $app.querySelector('#back').hidden = false;
      $app.querySelector('#act').innerHTML = `
        <p class="small" style="margin:0 0 6px">正しく書けましたか？</p>
        <div class="grade">
          <button class="btn g-ng" data-gr="ng" type="button"><b>×</b>書けなかった</button>
          <button class="btn g-hard" data-gr="hard" type="button"><b>△</b>おしい</button>
          <button class="btn g-ok" data-gr="ok" type="button"><b>○</b>書けた</button>
        </div>`;
      onAll('[data-gr]', 'click', (e) => grade(e.currentTarget.dataset.gr));
      $app.querySelector('#back').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    on('#flip', 'click', flip);
    setKeys((e) => {
      if (!open && e.key === 'Enter') { e.preventDefault(); flip(); return; }
      if (open) { const g = { 1: 'ng', 2: 'hard', 3: 'ok' }[e.key]; if (g) grade(g); }
    });
  }

  function kanjiResult() {
    session.done = true;
    pushSync();
    setKeys(null);
    const rs = session.results;
    const cnt = (g) => rs.filter((r) => r.g === g).length;
    const weak = rs.filter((r) => r.g !== 'ok').map((r) => r.w);
    h(`
      <h1>✍️ ${esc(session.title)} の結果</h1>
      <div class="card">
        <div class="kpis">
          <div class="kpi"><b>${cnt('ok')}</b><span>○ 書けた</span></div>
          <div class="kpi"><b>${cnt('hard')}</b><span>△ おしい</span></div>
          <div class="kpi"><b>${cnt('ng')}</b><span>× 書けなかった</span></div>
        </div>
        <p class="small" style="margin:8px 0 0">「×」は今日のうちに、「△」は近いうちに、「○」は数日〜数週間後にまた出ます。</p>
      </div>
      ${weak.length ? `<div class="card"><strong>練習したい言葉</strong>
        <ul class="kanji-list">${weak.map((w) => `<li><span class="kanji-sm">${esc(w.ans)}</span><span class="small">${esc(w.yomi)}</span></li>`).join('')}</ul>
        <p class="small" style="margin:6px 0 0">ノートに 3 回ずつ書いてから、もう一度ためしましょう。</p></div>` : ''}
      <div class="row">
        ${weak.length ? '<button class="btn" id="again" type="button">「×」「△」だけもう一度</button>' : ''}
        <button class="btn sub" id="more" type="button">続けて書く</button>
        <button class="btn ghost" id="home2" type="button">ホームへ</button>
      </div>`);
    on('#again', 'click', () => kanjiStart(shuffle(weak), session.title));
    on('#more', 'click', () => kanjiHome());
    on('#home2', 'click', home);
  }

  /* ───────── 保護者画面：まちがえた問題と、答えた内容 ───────── */
  const P_RANGES = { today: ['今日', 0], week: ['7 日間', 6], month: ['30 日間', 29], all: ['すべて', null] };
  const P_MODE = { quiz: 'クイズ', write: '書き取り', essay: '記述', card: '暗記カード', kanji: '漢字で書く' };
  /* 送られた日時を、この端末の時刻で「11/16 21:45」の形にする */
  const atText = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  let pSheetMsg = '';   // スプレッドシートへの送信先の設定のお知らせ
  let pSrc = null;      // 'local'（この端末）/ 'remote'（ほかの端末）
  let pSyncMsg = '';    // 同期の結果のお知らせ
  let pSynced = false;  // この画面を開いてから、自動の同期をしたか
  /* 「保護者のスプレッドシートに自動で送る」の設定欄（claude.ai の公開ページでは外に送れないので出さない） */
  function sheetCard() {
    if (!SHEET || (SYNC && SYNC.available())) return '';
    const st = SHEET.status(sheetOpt());
    const line = !st.configured ? 'まだ設定されていません。'
      : `${st.lastOk ? `この端末から最後に送った日時：${atText(st.lastOk)}` : 'この端末からは、まだ送っていません'}${st.pending ? `／まだ送っていない記録 ${st.pending} 件` : ''}${st.unconfirmed ? '／返事が読めない環境のため、届いたかは確認できません（スプレッドシートで確かめてください）' : ''}${st.lastErr ? `／${esc(st.lastErr)}` : ''}`;
    return `<div class="card p-sheet">
      <strong>📨 お子さんの端末と記録をやりとりする</strong>
      <p class="small" style="margin:6px 0 8px">お子さんの端末でまちがえた問題と答えた内容を、保護者の Google アカウント経由で、保護者の端末のこの画面で見られます。お子さんのログインはいりません。<b>お子さんの端末と保護者の端末の両方で</b>、同じアドレスと合言葉を、一度だけ設定します。設定のしかたは README の「保護者の端末で見る（Google 経由）」を見てください。</p>
      <p class="small" id="shst" style="margin:0 0 8px">${st.configured ? '設定ずみ。' : ''}${line}</p>
      <label class="small" for="shurl">受け口のアドレス</label>
      <input id="shurl" class="p-field" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(st.url)}">
      <label class="small" for="shsec">合言葉（Code.gs に書いたもの）</label>
      <input id="shsec" class="p-field" type="password" autocomplete="off" placeholder="${st.configured ? '（設定ずみ。かえるときだけ入れ直す）' : '12 文字以上'}">
      <p style="margin:8px 0 0"><button class="btn sub" id="shsave" type="button">保存してためす</button>${st.configured ? ' <button class="btn ghost" id="shoff" type="button">送信をやめる</button>' : ''} <span class="small" id="shmsg">${esc(pSheetMsg)}</span></p>
    </div>`;
  }
  function parents(range = 'week', cid = '', shown = 30) {
    reset();
    const T = today();
    const viaSheet = !(SYNC && SYNC.available()) && !!SHEET && SHEET.status(sheetOpt()).configured; // 保護者のスプレッドシート経由
    const syncOn = (SYNC && SYNC.available()) || viaSheet;
    const remote = remoteData();
    // 記録のない端末（保護者の端末）では、ほかの端末の記録を先に見せる
    const isRemote = !!remote && (pSrc || ((store.log || []).length ? 'local' : 'remote')) === 'remote';
    const DATA = isRemote ? remote : { log: store.log || [], days: store.days };
    const from = P_RANGES[range][1] == null ? '' : addDays(T, -P_RANGES[range][1]);
    const inRange = DATA.log.filter((e) => e.d >= from && catOf(K.id, e.cat));
    const list = inRange.filter((e) => !cid || e.cat === cid).slice().reverse();
    // 期間内の学習量
    const dsum = Object.entries(DATA.days).filter(([d]) => d >= from).reduce((a, [, v]) => ({ n: a.n + v.n, ok: a.ok + v.ok, cards: a.cards + (v.cards || 0) }), { n: 0, ok: 0, cards: 0 });
    const byCat = {};
    inRange.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + 1; });
    const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxC = catRows.length ? catRows[0][1] : 1;
    // 同じ問題を何回まちがえたか（記録に残っている分）
    const times = {};
    DATA.log.forEach((e) => { const k = `${e.q}|${e.ans}`; times[k] = (times[k] || 0) + 1; });
    const given = (e) => {
      if (e.img) return `<img class="p-img" src="${e.img}" alt="お子さんが書いた字">`;
      if (e.m === 'write' || e.m === 'kanji') return `<span class="small">（手書き。画像は新しい ${IMG_KEEP} 件だけ残ります）</span>`;
      if (e.m === 'card') return '<span class="small">（暗記カード：頭の中で答える形式）</span>';
      if (e.given === undefined) return '<b class="p-none">「わからない」を選んだ</b>';
      return `<span class="p-given">${rich(e.given)}</span>`;
    };
    const verdict = (e) => (e.g === 'hard' ? '△ おしい（自己採点）'
      : e.m === 'card' ? '× 思い出せなかった（自己採点）'
      : e.m === 'write' || e.m === 'kanji' || e.m === 'essay' ? '× 書けなかった（自己採点）' : '× まちがい');
    const now = (e) => {
      const c = isRemote ? (Number.isInteger(e.b) && e.b >= 0 ? { box: e.b } : null) : e.m === 'kanji' ? store.kanji[e.ans] : store.cards[`${K.id}|${e.q}|${e.ans}`];
      if (!c) return '';
      return c.box >= 2 ? '<span class="p-now ok">その後、復習で正解</span>' : c.box === 1 ? '<span class="p-now">その後 1 回正解</span>' : '<span class="p-now ng">まだ復習中</span>';
    };
    const expOf = (e) => { const b = BANK.get(`${K.id}|${e.q}|${e.ans}`); return e.exp || (b && b.item.exp) || ''; };
    const psg = (e) => { const b = BANK.get(`${K.id}|${e.q}|${e.ans}`); const P = b && b.item.p && PASSAGES[b.item.p]; return P ? `<div class="small">文章：${esc(P.kind)}「${esc(P.title)}」</div>` : ''; };
    const items = list.slice(0, shown).map((e) => {
      const n = times[`${e.q}|${e.ans}`];
      return `<li class="p-item">
        <div class="p-head"><span><span class="tag" style="--tc:${K.color}">${esc(catOf(K.id, e.cat).name)}</span> <span class="small">${md(e.d)} ${esc(e.t)}・${P_MODE[e.m]}</span></span>
          <span class="small">${n > 1 ? `<b class="p-rep">${n} 回目</b> ` : ''}${now(e)}</span></div>
        ${psg(e)}
        <div class="p-q">${rich(e.q)}</div>
        <dl class="p-ans">
          <dt>正解</dt><dd><strong>${rich(e.ans)}</strong></dd>
          <dt>答えた内容</dt><dd>${given(e)}<div class="small p-verdict ${e.g === 'hard' ? 'hard' : 'ng'}">${verdict(e)}</div></dd>
        </dl>
        ${expOf(e) ? `<details><summary class="small">解説を見る</summary><div class="exp">${rich(expOf(e))}</div></details>` : ''}
      </li>`;
    }).join('');
    h(`
      <h1>👪 保護者画面</h1>
      <p class="lead">${esc(K.name)}で、お子さんがまちがえた問題と、そのとき答えた内容です。新しいものから順に出ます。</p>
      ${syncOn ? `<div class="card p-sync">
        ${remote ? `<div class="seg" role="group" aria-label="どの端末の記録を見るか">
          <button type="button" data-src="local" aria-pressed="${!isRemote}">この端末の記録</button>
          <button type="button" data-src="remote" aria-pressed="${isRemote}">ほかの端末の記録</button>
        </div>` : ''}
        <p class="small" style="margin:${remote ? '8px' : '0'} 0 0">${isRemote
          ? `ほかの端末（${remote.devs} 台）で解いた記録です。${atText(remote.at) ? `最後に送られた日時：${atText(remote.at)}` : ''}`
          : remote ? 'この端末で解いた記録です。' : viaSheet ? 'お子さんの端末の記録は、保護者のスプレッドシート経由でここに届きます。まだ届いていないときは、お子さんが問題をまちがえたあとに、更新してください。' : 'お子さんの端末と同じ claude.ai アカウントでログインすると、お子さんの端末の記録がここに出ます。'}</p>
        <p style="margin:8px 0 0"><button class="btn sub" id="psync" type="button">🔄 記録を更新する</button> <span class="small" id="psyncmsg">${esc(pSyncMsg)}</span></p>
      </div>` : ''}
      ${sheetCard()}
      <div class="row" style="margin-bottom:10px"><span class="small">期間</span>
        <div class="seg" role="group" aria-label="期間">${Object.entries(P_RANGES).map(([k, v]) => `<button type="button" data-r="${k}" aria-pressed="${k === range}">${v[0]}</button>`).join('')}</div></div>
      <div class="kpis big">
        <div class="kpi"><b>${dsum.n + dsum.cards}</b><span>解いた数（問・枚）</span></div>
        <div class="kpi"><b>${dsum.n ? pct(dsum.ok, dsum.n) + '%' : '—'}</b><span>クイズの正答率</span></div>
        <div class="kpi"><b>${inRange.length}</b><span>まちがい（△をふくむ）</span></div>
      </div>
      ${catRows.length ? `<div class="card">
        <strong>分野ごとのまちがい</strong> <span class="small">（タップでしぼりこみ）</span>
        <div style="margin-top:8px">${catRows.map(([c, n]) => `<button type="button" class="stat-row p-cat" data-pc="${c}" aria-pressed="${c === cid}"><span>${esc(catOf(K.id, c).name)}</span><span class="bar"><i style="width:${(n / maxC) * 100}%"></i></span><span class="pc">${n} 件</span></button>`).join('')}</div>
        ${cid ? '<p class="small" style="margin:8px 0 0"><button class="linkbtn" data-pc="" type="button">しぼりこみをやめる</button></p>' : ''}
      </div>` : ''}
      <div class="card">
        <strong>まちがえた問題${cid ? `（${esc(catOf(K.id, cid).name)}）` : ''}：${list.length} 件</strong>
        ${list.length ? `<ul class="p-list">${items}</ul>${list.length > shown ? `<button class="btn sub wide" id="pmore" type="button">さらに表示（残り ${list.length - shown} 件）</button>` : ''}`
          : `<p class="small" style="margin:8px 0 0">${DATA.log.length ? 'この期間・分野には、まちがいの記録がありません。' : 'まだ記録がありません。この画面ができたあとに解いた問題から記録されます。'}</p>`}
      </div>
      <div class="card">
        <strong>この画面について</strong>
        <ul class="steps small" style="padding-left:1.2em;margin-top:6px">
          <li>クイズは、えらんだ選択肢や入力した答えをそのまま表示します。</li>
          <li>${KANJI.length ? `手書き（書き取り・漢字で書く）は、書いた字の画像を新しい ${IMG_KEEP} 件まで残します。` : ''}記述・暗記カードは、お子さん自身がつけた ○・△・× です。</li>
          <li>記録は新しい ${LOG_MAX} 件まで、この端末のブラウザに保存されます。公開ページを claude.ai にログインして開いているときは、新しい 600 件（手書きの画像は 40 件）が、同じアカウントの別の端末からも見られます。${APP.links.length ? 'ほかの教科は、それぞれの教科の保護者画面で見られます。' : ''}</li>
        </ul>
        ${APP.links.length ? `<p class="small" style="margin:6px 0 0">ほかの教科：${APP.links.map((l) => `<a class="linkbtn" href="${esc(l.href)}">${esc(l.label)}</a>`).join('・')}</p>` : ''}
        ${!isRemote && (store.log || []).length ? '<p style="margin:10px 0 0"><button class="btn ghost" id="pclear" type="button">この端末のまちがいの記録を消す</button></p>' : ''}
      </div>`);
    onAll('[data-r]', 'click', (e) => parents(e.currentTarget.dataset.r, cid));
    onAll('[data-src]', 'click', (e) => { pSrc = e.currentTarget.dataset.src; parents(range); });
    const doSync = () => {
      const msg = $app.querySelector('#psyncmsg'), btn = $app.querySelector('#psync');
      if (!btn) return;
      btn.disabled = true; if (msg) msg.textContent = '更新しています…';
      const mine = session; // 画面が変わっていたら、かきかえない
      (viaSheet ? SHEET.sync(sheetOpt()) : SYNC.sync()).then((r) => {
        pSyncMsg = viaSheet
          ? (r.err ? (SHEET.status(sheetOpt()).lastErr || '同期できませんでした。') : `更新しました（ほかの端末の記録 ${r.count || 0} 件）`)
          : (r.err ? SYNC.message(r) : `更新しました（ほかの端末の記録 ${(r.counts && r.counts[SYNC_S]) || 0} 件）`);
        if (session === mine && $app.querySelector('#psync')) parents(range, cid, shown);
      }, () => { pSyncMsg = '同期できませんでした。'; if (session === mine && $app.querySelector('#psync')) parents(range, cid, shown); });
    };
    on('#psync', 'click', doSync);
    on('#shsave', 'click', async () => {
      const url = $app.querySelector('#shurl').value.trim();
      let sec = $app.querySelector('#shsec').value.trim();
      if (!sec && SHEET.status(sheetOpt()).configured) sec = (() => { try { return JSON.parse(localStorage.getItem('tokai-sheet-cfg')).secret; } catch (e) { return ''; } })();
      const msg = $app.querySelector('#shmsg'), btn = $app.querySelector('#shsave');
      btn.disabled = true; msg.textContent = 'ためしています…';
      const t = await SHEET.test(url, sec);
      if (t.ok) {
        SHEET.setConfig(url, sec);
        const f = await SHEET.flush(sheetOpt());
        pSheetMsg = `${t.message}${f && f.sent ? `この端末の記録 ${f.sent} 件を送りました。` : ''}`;
      } else pSheetMsg = t.message;
      if ($app.querySelector('#shsave')) parents(range, cid, shown);
    });
    on('#shoff', 'click', () => ask('スプレッドシートへの自動送信をやめますか？\nすでに送った記録は、スプレッドシートに残ります。', { ok: 'やめる' }).then((y) => { if (y) { SHEET.clearConfig(); pSheetMsg = '送信をやめました。'; parents(range, cid, shown); } }));
    if (syncOn && !pSynced) { pSynced = true; doSync(); }
    onAll('[data-pc]', 'click', (e) => { const c = e.currentTarget.dataset.pc; parents(range, c === cid ? '' : c); });
    on('#pmore', 'click', () => { const y = window.scrollY; parents(range, cid, shown + 30); window.scrollTo(0, y); });
    on('#pclear', 'click', () => ask('まちがいの記録（この画面の一覧）を消しますか？\n学習の記録や復習の予定は消えません。', { ok: '消す' }).then((y) => { if (y) { store.log = []; save(); parents(range); } }));
  }

  /* ───────── 分析 ───────── */
  function analysis() {
    reset();
    const t = totals();
    const days = store.days;
    const T = today();
    const allM = K.cats.map((c) => ({ c, m: mastery(c.id), st: store.stats[`${K.id}:${c.id}`] || { n: 0, ok: 0 } }));
    const sumM = allM.reduce((a, x) => ({ total: a.total + x.m.total, master: a.master + x.m.master, fixed: a.fixed + x.m.fixed, learn: a.learn + x.m.learn }), { total: 0, master: 0, fixed: 0, learn: 0 });
    const totalSec = Object.values(days).reduce((a, d) => a + (d.sec || 0), 0);
    const cardsTotal = Object.values(days).reduce((a, d) => a + (d.cards || 0), 0);
    const studyDays = Object.values(days).filter((d) => d.n + (d.cards || 0) > 0).length;

    // 直近 14 日
    const last14 = [...Array(14)].map((_, i) => addDays(T, i - 13));
    // 苦手な問題（まちがえた回数が多い順）
    const weakCards = Object.entries(store.cards)
      .filter(([, c]) => c.lapses > 0)
      .sort((a, b) => b[1].lapses - a[1].lapses || a[1].box - b[1].box)
      .slice(0, 10);
    // アドバイス
    const tips = advice(allM);

    h(`
      <h1>📊 学習の記録</h1>
      <p class="lead">学習の記録はこの端末のブラウザに保存されています。グラフにふれると、くわしい数字が出ます。</p>

      <div class="kpis big">
        <div class="kpi"><b>${streak()}</b><span>日連続</span></div>
        <div class="kpi"><b>${studyDays}</b><span>学習した日</span></div>
        <div class="kpi"><b>${t.n + cardsTotal}</b><span>解いた問題・カード</span></div>
        <div class="kpi"><b>${t.n ? pct(t.ok, t.n) + '%' : '―'}</b><span>クイズの正答率</span></div>
        <div class="kpi"><b>${Math.round(totalSec / 60)}</b><span>学習時間（分）</span></div>
        <div class="kpi"><b>${pct(sumM.master, sumM.total)}%</b><span>覚えた問題</span></div>
      </div>

      ${tips.length ? `<div class="card advice"><strong>💡 次にやるとよいこと</strong><ul>${tips.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}

      <div class="card">
        <div class="ch-title">学習カレンダー<span class="small">（直近 16 週・1 日に解いた数）</span></div>
        <div class="chart-box" id="cal"></div>
        <div class="legend"><span>少ない</span><i class="q0"></i><i class="q1"></i><i class="q2"></i><i class="q3"></i><i class="q4"></i><span>多い</span></div>
      </div>

      <div class="card">
        <div class="ch-title">直近 14 日の問題数<span class="small">（クイズ＋暗記カード）</span></div>
        <div class="chart-box" id="cnt"></div>
      </div>

      <div class="card">
        <div class="ch-title">正答率の推移<span class="small">（直近 14 日・クイズ）</span></div>
        <div class="chart-box" id="acc"></div>
        ${table(['日付', '問題数', '正解', '正答率', 'カード'], last14.map((d) => { const x = days[d] || { n: 0, ok: 0, cards: 0 }; return [md(d), x.n, x.ok, x.n ? pct(x.ok, x.n) + '%' : '―', x.cards || 0]; }))}
      </div>

      <div class="card">
        <div class="ch-title">分野ごとの覚えぐあい</div>
        ${stageLegend()}
        ${allM.map(({ c, m }) => `<div class="stat-row mrow"><span>${esc(c.name)}</span>${masteryBar(m, c.name)}<span class="pc">${pct(m.master, m.total)}%</span></div>`).join('')}
        <p class="small" style="margin:8px 0 0">覚えた＝2 週間以上あけても正解できた／もう少し＝数日あけて正解できた／にがて＝まちがえた</p>
      </div>

      <div class="card">
        <div class="ch-title">分野ごとの正答率<span class="small">（低い順・クイズ）</span></div>
        ${allM.slice().sort((a, b) => (a.st.n ? a.st.ok / a.st.n : 2) - (b.st.n ? b.st.ok / b.st.n : 2)).map(({ c, st }) =>
          `<div class="stat-row"><span>${esc(c.name)}</span><span class="bar">${st.n ? `<i style="width:${pct(st.ok, st.n)}%" data-tip="${esc(c.name)}：${st.ok}/${st.n} 問正解"></i>` : ''}</span><span class="pc">${st.n ? pct(st.ok, st.n) + '%' : '―'}</span></div>`).join('')}
      </div>

      <div class="card">
        <div class="ch-title">むずかしさ別の正答率</div>
        ${[2, 3].map((lv) => { const L = store.lvs[lv] || { n: 0, ok: 0 }; return `<div class="stat-row"><span class="lv" style="font-size:15px">${stars(lv)}</span><span class="bar">${L.n ? `<i style="width:${pct(L.ok, L.n)}%" data-tip="${stars(lv)}：${L.ok}/${L.n} 問正解"></i>` : ''}</span><span class="pc">${L.n ? pct(L.ok, L.n) + '%' : '―'}</span></div>`; }).join('')}
        <p class="small" style="margin:8px 0 0">★★★（東海中レベル）で 7 割をこえるのが目標です。</p>
      </div>

      <div class="card">
        <div class="ch-title">よくまちがえる問題</div>
        ${weakCards.length ? `<ol class="weak">${weakCards.map(([k, c]) => {
          const q = fromCard(k, c);
          return q ? `<li><span class="qs">${rich(q.q.split('\n')[0])}</span><span class="small">正解：${esc(q.ans)}・まちがい ${c.lapses} 回</span></li>` : '';
        }).join('')}</ol>
        <button class="btn" id="weakGo" type="button">この問題を練習する</button>` : '<p class="small">まだありません。</p>'}
      </div>

      <div class="card">
        <div class="ch-title">記録の管理</div>
        <p class="small" style="margin-top:0">記録はこの端末だけに保存されています。別の端末に移すときや、念のためのバックアップに使ってください。</p>
        <div class="row">
          <button class="btn sub" id="export" type="button">記録を書き出す</button>
          <label class="btn sub" style="display:inline-flex;align-items:center">ファイルから読みこむ<input id="import" type="file" accept="application/json,.json" hidden></label>
          <button class="btn sub" id="paste" type="button">貼りつけて読みこむ</button>
          <button class="btn ghost" id="reset" type="button">記録をすべて消す</button>
        </div>
      </div>
      <button class="btn sub" id="back" type="button">ホームへ</button>`);

    const draw = () => {
      const w = (id) => $app.querySelector(id).clientWidth;
      // カレンダー：今週の土曜日まで 16 週
      const end = addDays(T, 6 - dow(T));
      const cells = [...Array(16 * 7)].map((_, i) => {
        const d = addDays(end, i - 16 * 7 + 1);
        const x = days[d];
        const n = x ? x.n + (x.cards || 0) : 0;
        return { date: d, n, future: d > T, tip: `${md(d)}（${WEEK[dow(d)]}）${d > T ? '' : `：${n} 問${x && x.n ? `・正答率 ${pct(x.ok, x.n)}%` : ''}`}` };
      });
      $app.querySelector('#cal').innerHTML = Charts.calendar(cells, { width: w('#cal'), levels: (n) => (n === 0 ? 0 : n < 10 ? 1 : n < 20 ? 2 : n < 40 ? 3 : 4) });
      $app.querySelector('#cnt').innerHTML = Charts.columns(last14.map((d) => {
        const x = days[d] || { n: 0, ok: 0, cards: 0 };
        const n = x.n + (x.cards || 0);
        return { label: md(d), value: n, tip: `${md(d)}（${WEEK[dow(d)]}）：${n} 問（クイズ ${x.n}・カード ${x.cards || 0}）` };
      }), { width: w('#cnt') });
      $app.querySelector('#acc').innerHTML = Charts.line(last14.map((d) => {
        const x = days[d];
        return { label: md(d), value: x && x.n ? pct(x.ok, x.n) : null, tip: x && x.n ? `${md(d)}：正答率 ${pct(x.ok, x.n)}%（${x.ok}/${x.n}）` : '' };
      }), { width: w('#acc') });
    };
    draw();
    onResize = draw;

    on('#weakGo', 'click', () => start(weakCards.map(([k, c]) => fromCard(k, c)).filter(Boolean), 'よくまちがえる問題'));
    on('#back', 'click', home);
    on('#reset', 'click', () => {
      ask('成績と復習の記録をすべて消します。よろしいですか？', { ok: '消す' }).then((y) => {
        if (y) { store = blank(); save(); analysis(); }
      });
    });
    /* 書き出し：ファイルに保存できない環境もあるので、文字としてコピーもできるようにする */
    on('#export', 'click', () => {
      const json = JSON.stringify(store, (k, v) => (k === 'img' ? undefined : v));
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${APP.file}-${T}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } catch (e) { /* 保存できなくても、下のコピーで移せる */ }
      ask(`<b>記録の文字データ</b><br><span class="small">ファイルが保存されないときは、この文字を全部コピーして、メモなどに貼りつけて残してください。別の端末では「貼りつけて読みこむ」で読みこめます。</span>
        <textarea id="dataOut" class="datatext" readonly rows="5" aria-label="記録の文字データ"></textarea>`,
      { html: true, ok: 'コピーする', cancel: '閉じる', onOpen: (el) => { el.querySelector('#dataOut').value = json; } }).then((y) => {
        if (!y) return;
        const fallback = () => notice('コピーできませんでした。文字を長押し（または Ctrl+A）で選んでコピーしてください。');
        try { navigator.clipboard.writeText(json).then(() => notice('コピーしました。'), fallback); } catch (e) { fallback(); }
      });
    });
    const importText = (txt) => {
      let data;
      try { data = JSON.parse(txt); } catch (e) { data = null; }
      if (!data || typeof data !== 'object' || !data.stats || !data.cards) { notice('この記録は読みこめませんでした。書き出した文字やファイルをそのまま使ってください。'); return; }
      ask('今の記録を、読みこんだ記録で置きかえます。よろしいですか？', { ok: '置きかえる' }).then((y) => {
        if (y) { store = sanitize(data); store.seenGuide = true; save(); analysis(); }
      });
    };
    on('#import', 'change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(importText, () => notice('このファイルは読みこめませんでした。'));
    });
    on('#paste', 'click', () => {
      let box;
      ask(`<b>記録を貼りつけて読みこむ</b><br><span class="small">「記録を書き出す」でコピーした文字を、ここに貼りつけてください。</span>
        <textarea id="dataIn" class="datatext" rows="5" aria-label="貼りつける記録"></textarea>`,
      { html: true, ok: '読みこむ', onOpen: (el) => { box = el.querySelector('#dataIn'); setTimeout(() => box.focus(), 0); } }).then((y) => {
        if (y) importText(box.value.trim());
      });
    });
  }

  function table(head, rows) {
    return `<details class="tbl"><summary>表で見る</summary><table><thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
  }

  /* 記録から「次にやるとよいこと」を考える */
  function advice(allM) {
    const out = [];
    const due = dueList().length;
    if (due) out.push(`復習待ちが <b>${due} 問</b>あります。まずは「今日の学習」から。`);
    const tried = allM.filter((x) => x.st.n >= 5);
    if (tried.length) {
      const w = tried.slice().sort((a, b) => a.st.ok / a.st.n - b.st.ok / b.st.n)[0];
      if (w.st.ok / w.st.n < 0.8) out.push(`いちばん正答率が低いのは <b>${esc(w.c.name)}</b>（${pct(w.st.ok, w.st.n)}%）。「分野をえらぶ」の暗記カードで集中して覚えましょう。`);
    }
    const untouched = allM.filter((x) => !x.c.gens && x.m.new === x.m.total);
    if (untouched.length) out.push(`まだ手をつけていない分野：${untouched.map((x) => `<b>${esc(x.c.name)}</b>`).join('・')}`);
    const L3 = store.lvs[3];
    if (L3 && L3.n >= 10 && L3.ok / L3.n < 0.7) out.push(`★★★の正答率が ${pct(L3.ok, L3.n)}% です。「力だめし」の「東海中レベル」でむずかしい問題に慣れましょう。`);
    const d = store.days[today()];
    if (!d && streak() > 0) out.push(`今日はまだ学習していません。${streak()} 日連続の記録を続けよう！`);
    return out;
  }

  home();
  pushSheet(true); // 前回までに送れなかった分があれば、あらためて送る
})();
