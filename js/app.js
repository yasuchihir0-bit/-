/* 東海中 トレーニング（国語・社会 共通）：画面とロジック
 * 教科のデータは window.SUBJECT（なければ window.KOKUGO）。教科ごとのちがいは SUBJECT.app で設定する。 */
(function () {
  'use strict';
  const { pick, shuffle, esc, rich } = window.U;
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
  const ansOf = (item) => (item.a ? item.a[0] : item.ok ? item.ok.join('／') : item.c[0]);
  const bkey = (sid, item) => `${sid}|${item.q}|${ansOf(item)}`;
  const BANK = new Map();
  SUBJECTS.forEach((s) => (s.bank || []).forEach((item, idx) => {
    BANK.set(bkey(s.id, item), { s, item, idx });
  }));

  /* ───────── 保存（この端末のブラウザ内のみ） ───────── */
  const KEY = APP.key;
  const blank = () => ({ version: 2, stats: {}, cards: {}, days: {}, lvs: {}, sessions: 0 });
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
    out.sessions = int(d.sessions);
    if ([10, 20, 30, 50].includes(+d.goal)) out.goal = +d.goal;
    if (d.seenGuide === true) out.seenGuide = true;
    if (Array.isArray(d.wrong)) out.wrong = d.wrong.filter((q) => q && typeof q === 'object' && cats.has(q.cat) && typeof q.q === 'string');
    return out;
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* noop */ } };

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
  function record(q, ok, sec) {
    const k = `${q.subject}:${q.cat}`;
    const s = store.stats[k] || (store.stats[k] = { n: 0, ok: 0 });
    s.n++; if (ok) s.ok++;
    const lv = String(lvOf(q));
    const L = store.lvs[lv] || (store.lvs[lv] = { n: 0, ok: 0 });
    L.n++; if (ok) L.ok++;
    schedule(q, ok ? 'ok' : 'ng');
    logDay(ok, sec, 'quiz');
    save();
  }

  /* ───────── 問題をつくる ───────── */
  const catOf = (sid, cid) => SUBJ[sid].cats.find((c) => c.id === cid);

  function fromBank(subject, item, idx) {
    const base = { subject: subject.id, cat: item.cat, id: `${subject.id}-${idx}`, q: item.q, exp: item.exp, lv: lvOf(item) };
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
      .filter(([, c]) => c.due <= t && (!cid || c.cat === cid))
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
  const leaveOk = () => !(session && !session.done && session.idx > 0 && !confirm('とちゅうでやめますか？（答えた問題の記録は残ります）'));
  document.getElementById('homeBtn').addEventListener('click', () => { if (leaveOk()) home(); });
  Charts.initTips();
  document.getElementById('statsBtn').addEventListener('click', () => { if (leaveOk()) analysis(); });
  document.getElementById('helpBtn').addEventListener('click', () => { if (leaveOk()) help(); });

  const reset = () => { session = null; setKeys(null); onResize = null; clearInterval(timerId); };

  /* 覚えぐあいの 4 段階（色の濃さで表す） */
  const STAGE_NAMES = { master: '覚えた', fixed: 'もう少し', learn: 'にがて', new: 'まだ' };
  function masteryBar(m, label, tips = true) {
    const seg = (n, cls, name) => (n ? `<i class="${cls}" style="flex:${n}"${tips ? ` data-tip="${esc(label)}：${name} ${n} 問（${pct(n, m.total)}%）"` : ''}></i>` : '');
    return `<span class="mbar">${seg(m.master, 'm4', STAGE_NAMES.master)}${seg(m.fixed, 'm3', STAGE_NAMES.fixed)}${seg(m.learn, 'm2', STAGE_NAMES.learn)}${seg(m.new, 'm0', STAGE_NAMES.new)}</span>`;
  }
  const stageLegend = () => `<div class="legend"><i class="m4"></i>覚えた<i class="m3"></i>もう少し<i class="m2"></i>にがて<i class="m0"></i>まだ</div>`;

  const allTargets = () => K.cats.map((c) => ({ sid: K.id, cid: c.id }));
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
    const all = allTargets().map((t) => mastery(t.cid)).reduce((a, m) => ({ total: a.total + m.total, master: a.master + m.master, fixed: a.fixed + m.fixed, learn: a.learn + m.learn, new: a.new + m.new }), { total: 0, master: 0, fixed: 0, learn: 0, new: 0 });
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
      <p class="small center"><button class="linkbtn" data-help="1" type="button">❓ 使い方を見る</button></p>
      ${APP.links.length ? `<p class="small center">ほかの教科：${APP.links.map((l) => `<a class="linkbtn" href="${esc(l.href)}">${esc(l.label)}</a>`).join('・')}</p>` : ''}
      <p class="small center notice">このアプリは東海中学校の公式のものではありません。学校とは関係のない、受験勉強用の非公式アプリです。</p>`);
    on('[data-daily]', 'click', startDaily);
    on('[data-pick]', 'click', () => practice('quiz'));
    on('[data-test]', 'click', tests);
    on('[data-stats]', 'click', analysis);
    on('[data-help]', 'click', help);
    if (!store.seenGuide) guide();
  }

  /* ───────── 分野をえらぶ（クイズ／暗記カード） ───────── */
  function practice(mode) {
    reset();
    let level = 'all';
    const tiles = K.cats.map((c) => {
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
      <div class="card">
        <h2 style="margin-top:0">1 日の目標</h2>
        <div class="seg" role="group" aria-label="1 日の目標">
          ${[10, 20, 30, 50].map((n) => `<button type="button" data-goal="${n}" aria-pressed="${n === goal()}">${n} 問</button>`).join('')}
        </div>
        <p class="small" style="margin:8px 0 0">記録はこの端末のブラウザに保存されます。別の端末に移すときは 📊 のページの「記録を書き出す」を使ってください。</p>
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
          ${K.cats.map((c) => {
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
    if (!questions.length) { alert('出題できる問題がありません。'); return; }
    reset();
    session = { title, questions, idx: 0, results: [], t0: Date.now(), done: false };
    store.sessions++; save();
    show();
  }

  const elapsed = () => {
    const s = Math.floor((Date.now() - session.t0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function show() {
    const q = session.questions[session.idx];
    const s = SUBJ[q.subject], cat = catOf(q.subject, q.cat);
    const total = session.questions.length;
    const card = store.cards[qkey(q)];
    const body = q.type === 'text'
      ? `<div class="answer-row">
          <input id="ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="答え" placeholder="ここに書く">
          <button class="btn" id="submitText" type="button">答える</button>
        </div>
        <div class="err" id="err"></div>
        <div class="hint">${esc(APP.textHint)}</div>`
      : q.type === 'multi'
      ? `<div class="multi-note">✅ あてはまるものを<b>すべて</b>選んでから「答える」を押してください。</div>
        <div class="choices">${q.choices.map((c, i) => `<button class="choice mchoice" type="button" data-i="${i}" aria-pressed="false"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>
        <div class="err" id="err"></div>
        <button class="btn wide" id="submitMulti" type="button">答える</button>`
      : `<div class="choices">${q.choices.map((c, i) => `<button class="choice" type="button" data-i="${i}"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>`;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:${s.color}">${esc(cat ? cat.name : s.name)}</span> <span class="lv" title="難易度">${stars(q.lv || 1)}</span>${q.type === 'text' ? ' <span class="small">記述</span>' : q.type === 'multi' ? ' <span class="small">すべて選ぶ</span>' : ''}${card ? (card.lapses ? ` <span class="small">・前にまちがえた</span>` : '') : ' <span class="small">・初めて</span>'}</span>
        <span>${session.idx + 1} / ${total}　⏱ <span id="clock">${elapsed()}</span></span></div>
      <div class="progress"><i style="width:${(session.idx / total) * 100}%"></i></div>
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
    const finish = (ok, given) => {
      if (answered) return;
      answered = true;
      session.results.push({ q, ok, given });
      record(q, ok, (Date.now() - shownAt) / 1000);
      const c = store.cards[qkey(q)];
      const nextTxt = c.box === 0 ? 'このあと「今日の復習」でもう一度出ます。' : `次の復習：${md(c.due)}（${INTERVALS[c.box]} 日後）`;
      $app.querySelector('#skip').hidden = true;
      const nb = $app.querySelector('#next');
      nb.hidden = false;
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

    if (q.type === 'choice') {
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
        err.textContent = '';
        finish(textOk(q, v), v);
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

  /* ───────── 結果 ───────── */
  function result() {
    clearInterval(timerId);
    session.done = true;
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
    if (!cards.length) { alert('カードがありません。'); return; }
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
        <div class="qtext">${rich(q.type === 'text' ? q.q : asRecall(q.q))}</div>
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
          <label class="btn sub" style="display:inline-flex;align-items:center">記録を読みこむ<input id="import" type="file" accept="application/json,.json" hidden></label>
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
      if (!confirm('成績と復習の記録をすべて消します。よろしいですか？')) return;
      store = blank(); save(); analysis();
    });
    on('#export', 'click', () => {
      const blob = new Blob([JSON.stringify(store)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${APP.file}-${T}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    on('#import', 'change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then((txt) => {
        const data = JSON.parse(txt);
        if (!data || typeof data !== 'object' || !data.stats || !data.cards) throw new Error('format');
        if (!confirm('今の記録を、読みこんだ記録で置きかえます。よろしいですか？')) return;
        store = sanitize(data); store.seenGuide = true; save(); analysis();
      }).catch(() => alert('このファイルは読みこめませんでした。'));
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
})();
