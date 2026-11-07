/* 東海中 国語トレーニング：画面とロジック */
(function () {
  'use strict';
  const { pick, shuffle, esc, rich } = window.U;
  const Charts = window.Charts;

  const SUBJECTS = [window.KOKUGO];
  const SUBJ = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
  const K = SUBJECTS[0];
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
  const BANK = new Map();
  SUBJECTS.forEach((s) => (s.bank || []).forEach((item, idx) => {
    BANK.set(`${s.id}|${item.q}|${item.a ? item.a[0] : item.c[0]}`, { s, item, idx });
  }));

  /* ───────── 保存（この端末のブラウザ内のみ） ───────── */
  const KEY = 'tokai-kokugo-v1';
  const blank = () => ({ version: 2, stats: {}, cards: {}, days: {}, lvs: {}, sessions: 0 });
  let store = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* 保存できない環境でも動くようにする */ }
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
    all: { name: 'すべて', f: null },
    basic: { name: '★〜★★', f: (lv) => lv <= 2 },
    hard: { name: '★★〜★★★', f: (lv) => lv >= 2 },
    top: { name: '★★★のみ', f: (lv) => lv >= 3 },
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
        .map((item, idx) => ({ item, idx, key: `${sid}|${item.q}|${item.a ? item.a[0] : item.c[0]}` }))
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
      const pairs = (K.ANTONYMS.length + K.SYNONYMS.length) * 2;
      r.total = pairs;
      Object.values(store.cards).filter((c) => c.cat === cid).forEach((c) => { r[stageOf(c)]++; });
      r.new = Math.max(0, pairs - r.learn - r.fixed - r.master);
      return r;
    }
    K.bank.forEach((item) => {
      if (item.cat !== cid) return;
      r.total++;
      r[stageOf(store.cards[`${K.id}|${item.q}|${item.a ? item.a[0] : item.c[0]}`])]++;
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
  document.getElementById('homeBtn').addEventListener('click', () => {
    if (session && !session.done && session.idx > 0 && !confirm('とちゅうでやめてホームにもどりますか？')) return;
    home();
  });
  Charts.initTips();

  const reset = () => { session = null; setKeys(null); onResize = null; clearInterval(timerId); };

  /* 習熟度の横帯（習得・定着中・学習中・未学習） */
  function masteryBar(m, label, tips = true) {
    const seg = (n, cls, name) => (n ? `<i class="${cls}" style="flex:${n}"${tips ? ` data-tip="${esc(label)}：${name} ${n} 問（${pct(n, m.total)}%）"` : ''}></i>` : '');
    return `<span class="mbar">${seg(m.master, 'm4', '習得')}${seg(m.fixed, 'm3', '定着中')}${seg(m.learn, 'm2', '学習中')}${seg(m.new, 'm0', '未学習')}</span>`;
  }

  /* ───────── ホーム ───────── */
  function home() {
    reset();
    const t = totals();
    const due = dueList();
    const td = store.days[today()] || { n: 0, cards: 0 };
    const st = streak();
    const tiles = K.cats.map((c) => {
      const m = mastery(c.id);
      return `<button class="tile" style="--tc:${K.color}" data-c="${c.id}">
        <span class="tt">${esc(c.name)}</span>
        ${masteryBar(m, c.name, false)}
        <span class="badge">習得 ${m.master}・定着 ${m.fixed}／${m.total}</span>
      </button>`;
    }).join('');
    h(`
      <h1>きょうも 1 歩ずつ。</h1>
      <p class="lead">東海中学の入試に向けて、国語の「ことばの知識」と「文法」を練習しましょう（漢字の読み書きと文章読解は入っていません）。</p>
      <div class="card today">
        <div class="kpis">
          <div class="kpi"><b>${st}</b><span>日連続</span></div>
          <div class="kpi"><b>${td.n + td.cards}</b><span>今日の問題</span></div>
          <div class="kpi"><b>${due.length}</b><span>復習待ち</span></div>
          <div class="kpi"><b>${t.n ? pct(t.ok, t.n) + '%' : '―'}</b><span>正答率</span></div>
        </div>
        ${due.length
          ? `<button class="btn wide" data-due="1" type="button">🔁 今日の復習をする（${Math.min(due.length, 20)} 問）</button>
             <p class="small" style="margin:6px 0 0">まちがえた問題や、忘れかけたころの問題が出ます。毎日続けると、少ない時間で覚えられます。</p>`
          : `<p style="margin:4px 0 0">✅ 今日の復習はすべて終わりました。${t.n ? '新しい問題に進みましょう。' : 'まずは問題を解いてみましょう。'}</p>`}
      </div>
      <div class="grid">
        <button class="tile" style="--tc:var(--c-koku)" data-top="1">
          <span class="ic">🏯</span><span class="tt">東海レベル実戦</span>
          <span class="ds">★★〜★★★の問題だけで 15 問。記述式もあり。</span>
        </button>
        <button class="tile" style="--tc:var(--c-mix)" data-mix="1">
          <span class="ic">📝</span><span class="tt">ミニテスト</span>
          <span class="ds">全分野から 15 問。時間を計って力だめし。</span>
        </button>
        <button class="tile" style="--tc:var(--ok)" data-flash="1">
          <span class="ic">🃏</span><span class="tt">暗記カード</span>
          <span class="ds">答えを思い出してからめくる。自分で「覚えた／あやしい／まだ」をつけます。</span>
        </button>
        <button class="tile" style="--tc:var(--accent)" data-setup="1">
          <span class="ic">🎯</span><span class="tt">分野を選んで練習</span>
          <span class="ds">分野・難易度・問題数を選べます。</span>
        </button>
        <button class="tile" style="--tc:var(--muted)" data-stats="1">
          <span class="ic">📊</span><span class="tt">分析</span>
          <span class="ds">学習の記録・分野別の習熟度・苦手な問題をグラフで。</span>
        </button>
      </div>
      <h2>分野ごとに 10 問</h2>
      <p class="small" style="margin-top:-6px">復習日が来た問題 → まだ解いていない問題 の順に出ます。帯は習熟度（濃いほど身についている）。</p>
      <div class="grid cats">${tiles}</div>`);
    onAll('[data-c]', 'click', (e) => {
      const cid = e.currentTarget.dataset.c;
      start(buildSet([{ sid: K.id, cid }], 10), catOf(K.id, cid).name);
    });
    on('[data-due]', 'click', () => start(dueList().slice(0, 20), '今日の復習'));
    on('[data-setup]', 'click', setup);
    on('[data-flash]', 'click', flashSetup);
    on('[data-top]', 'click', () => {
      const targets = K.cats.map((c) => ({ sid: K.id, cid: c.id }));
      // 実戦では、文章読解で使う「気持ち」「説明文の言葉」「使い方」「慣用句」「文法」を多めに出す
      const focus = ['shinjo', 'hyoron', 'tsukai', 'kanyo', 'bunpo'].map((cid) => ({ sid: K.id, cid }));
      const set = buildSet(focus, 9, LEVELS.hard.f);
      const seenQ = new Set(set.map(qkey));
      const rest = buildSet(targets, 12, LEVELS.hard.f).filter((q) => !seenQ.has(qkey(q))).slice(0, 15 - set.length);
      start(shuffle(set.concat(rest)), '東海レベル実戦');
    });
    on('[data-mix]', 'click', () => start(buildSet(K.cats.map((c) => ({ sid: K.id, cid: c.id })), 15), 'ミニテスト'));
    on('[data-stats]', 'click', analysis);
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
        <div class="hint">記述式：ひらがなで書けば OK です。</div>`
      : `<div class="choices">${q.choices.map((c, i) => `<button class="choice" type="button" data-i="${i}"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>`;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:${s.color}">${esc(cat ? cat.name : s.name)}</span> <span class="lv" title="難易度">${stars(q.lv || 1)}</span>${q.type === 'text' ? ' <span class="small">記述</span>' : ''}${card ? (card.lapses ? ` <span class="small">・前にまちがえた</span>` : '') : ' <span class="small">・初めて</span>'}</span>
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
      $app.querySelectorAll('#input button, #input input').forEach((el) => { el.disabled = true; });
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
        <p class="small" style="margin:4px 0 0">かかった時間 ${elapsed()}${wrongs.length ? '・まちがえた問題は「今日の復習」に入りました' : ''}</p>
        ${Object.keys(byCat).length > 1 ? `<div style="margin-top:10px">${catRows}</div>` : ''}
      </div>
      <div class="row" style="margin-bottom:14px">
        ${wrongs.length ? '<button class="btn" id="redo" type="button">まちがえた問題をもう一度</button>' : ''}
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
  }

  /* ───────── 暗記カード ───────── */
  function flashSetup() {
    reset();
    const dueAll = dueList().length;
    h(`
      <h1>🃏 暗記カード</h1>
      <p class="lead">問題を見て、<b>答えを頭の中で思い出してから</b>カードをめくります。思い出せたかどうかを自分で選ぶと、忘れかけたころにまた出てきます。</p>
      <div class="card">
        <button class="btn wide" data-fc="" type="button">全分野（復習待ち ${dueAll} 問を優先）</button>
      </div>
      <div class="grid cats">
        ${K.cats.map((c) => {
          const m = mastery(c.id);
          const d = dueList(c.id).length;
          return `<button class="tile" style="--tc:var(--ok)" data-fc="${c.id}">
            <span class="tt">${esc(c.name)}</span>
            ${masteryBar(m, c.name, false)}
            <span class="badge">復習待ち ${d}・未学習 ${m.new}</span></button>`;
        }).join('')}
      </div>`);
    onAll('[data-fc]', 'click', (e) => {
      const cid = e.currentTarget.dataset.fc;
      const due = dueList(cid || undefined);
      const targets = (cid ? [cid] : K.cats.map((c) => c.id)).map((x) => ({ sid: K.id, cid: x }));
      const keys = new Set(due.map(qkey));
      const more = buildSet(targets, 20).filter((q) => !keys.has(qkey(q)));
      flashStart(due.concat(more).slice(0, 20), cid ? catOf(K.id, cid).name : '全分野');
    });
  }

  const asRecall = (s) => s.replace(/として正しいものはどれですか。/, 'は？').replace(/はどれですか。/, 'は？');

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
        <div class="qtext">${rich(q.type === 'choice' ? asRecall(q.q) : q.q)}</div>
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
          <button class="btn g-ng" data-g="ng" type="button">まだ<small>1</small></button>
          <button class="btn g-hard" data-g="hard" type="button">あやしい<small>2</small></button>
          <button class="btn g-ok" data-g="ok" type="button">覚えた<small>3</small></button>
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
          <div class="kpi"><b>${cnt('ok')}</b><span>覚えた</span></div>
          <div class="kpi"><b>${cnt('hard')}</b><span>あやしい</span></div>
          <div class="kpi"><b>${cnt('ng')}</b><span>まだ</span></div>
        </div>
        <p class="small" style="margin:8px 0 0">「まだ」は今日中に、「あやしい」は近いうちに、「覚えた」は数日〜数週間後にまた出ます。</p>
      </div>
      <div class="row">
        ${weak.length ? '<button class="btn" id="again" type="button">「まだ・あやしい」だけもう一度</button>' : ''}
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
      <h1>📊 分析</h1>
      <p class="lead">学習の記録はこの端末のブラウザに保存されています。グラフにふれると、くわしい数字が出ます。</p>

      <div class="kpis big">
        <div class="kpi"><b>${streak()}</b><span>日連続</span></div>
        <div class="kpi"><b>${studyDays}</b><span>学習した日</span></div>
        <div class="kpi"><b>${t.n + cardsTotal}</b><span>解いた問題・カード</span></div>
        <div class="kpi"><b>${t.n ? pct(t.ok, t.n) + '%' : '―'}</b><span>クイズの正答率</span></div>
        <div class="kpi"><b>${Math.round(totalSec / 60)}</b><span>学習時間（分）</span></div>
        <div class="kpi"><b>${pct(sumM.master, sumM.total)}%</b><span>習得した問題</span></div>
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
        <div class="ch-title">分野別の習熟度</div>
        <div class="legend"><i class="m4"></i>習得<i class="m3"></i>定着中<i class="m2"></i>学習中<i class="m0"></i>未学習</div>
        ${allM.map(({ c, m }) => `<div class="stat-row mrow"><span>${esc(c.name)}</span>${masteryBar(m, c.name)}<span class="pc">${pct(m.master, m.total)}%</span></div>`).join('')}
        <p class="small" style="margin:8px 0 0">習得＝14 日以上あけても正解できた／定着中＝数日あけて正解できた／学習中＝まちがえた・覚えはじめ</p>
      </div>

      <div class="card">
        <div class="ch-title">分野別の正答率<span class="small">（低い順・クイズ）</span></div>
        ${allM.slice().sort((a, b) => (a.st.n ? a.st.ok / a.st.n : 2) - (b.st.n ? b.st.ok / b.st.n : 2)).map(({ c, st }) =>
          `<div class="stat-row"><span>${esc(c.name)}</span><span class="bar">${st.n ? `<i style="width:${pct(st.ok, st.n)}%" data-tip="${esc(c.name)}：${st.ok}/${st.n} 問正解"></i>` : ''}</span><span class="pc">${st.n ? pct(st.ok, st.n) + '%' : '―'}</span></div>`).join('')}
      </div>

      <div class="card">
        <div class="ch-title">難易度別の正答率</div>
        ${[1, 2, 3].map((lv) => { const L = store.lvs[lv] || { n: 0, ok: 0 }; return `<div class="stat-row"><span class="lv" style="font-size:15px">${stars(lv)}</span><span class="bar">${L.n ? `<i style="width:${pct(L.ok, L.n)}%" data-tip="${stars(lv)}：${L.ok}/${L.n} 問正解"></i>` : ''}</span><span class="pc">${L.n ? pct(L.ok, L.n) + '%' : '―'}</span></div>`; }).join('')}
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
      a.download = `tokai-kokugo-kiroku-${T}.json`;
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
        store = Object.assign(blank(), data); save(); analysis();
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
    if (due) out.push(`復習待ちが <b>${due} 問</b>あります。まずは「今日の復習」から。`);
    const tried = allM.filter((x) => x.st.n >= 5);
    if (tried.length) {
      const w = tried.slice().sort((a, b) => a.st.ok / a.st.n - b.st.ok / b.st.n)[0];
      if (w.st.ok / w.st.n < 0.8) out.push(`いちばん正答率が低いのは <b>${esc(w.c.name)}</b>（${pct(w.st.ok, w.st.n)}%）。暗記カードで集中して覚えましょう。`);
    }
    const untouched = allM.filter((x) => !x.c.gens && x.m.new === x.m.total);
    if (untouched.length) out.push(`まだ手をつけていない分野：${untouched.map((x) => `<b>${esc(x.c.name)}</b>`).join('・')}`);
    const L3 = store.lvs[3];
    if (L3 && L3.n >= 10 && L3.ok / L3.n < 0.7) out.push(`★★★の正答率が ${pct(L3.ok, L3.n)}% です。「東海レベル実戦」で発展問題に慣れましょう。`);
    const d = store.days[today()];
    if (!d && streak() > 0) out.push(`今日はまだ学習していません。${streak()} 日連続の記録を続けよう！`);
    return out;
  }

  home();
})();
