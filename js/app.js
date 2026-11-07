/* 東海中 受験トレーニング：画面とロジック */
(function () {
  'use strict';
  const { pick, shuffle, R, req, fmt, parseAnswer, esc, rich } = window.U;

  const SUBJECTS = [window.MATH, window.SCIENCE, window.SOCIAL];
  const SUBJ = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
  const $app = document.getElementById('app');

  /* ───────── 保存（この端末のブラウザ内のみ） ───────── */
  const KEY = 'tokai-prep-v1';
  const blank = () => ({ stats: {}, wrong: [], sessions: 0 });
  let store = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* 保存できない環境でも動くようにする */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* noop */ } };

  const statKey = (q) => `${q.subject}:${q.cat}`;
  const record = (q, ok) => {
    const k = statKey(q);
    const s = store.stats[k] || (store.stats[k] = { n: 0, ok: 0 });
    s.n++; if (ok) s.ok++;
    const sig = q.subject + '|' + q.q;
    store.wrong = store.wrong.filter((w) => w.subject + '|' + w.q !== sig);
    if (!ok) {
      store.wrong.unshift(q);
      if (store.wrong.length > 150) store.wrong.length = 150;
    }
    save();
  };

  /* ───────── 問題をつくる ───────── */
  const catOf = (sid, cid) => SUBJ[sid].cats.find((c) => c.id === cid);

  function fromBank(subject, item, idx) {
    return {
      subject: subject.id, cat: item.cat, id: `${subject.id}-${idx}`,
      type: 'choice', q: item.q, choices: shuffle(item.c), ans: item.c[0], exp: item.exp,
    };
  }

  function fromGen(subject, cat) {
    const g = pick(cat.gens)();
    return Object.assign({ subject: subject.id, cat: cat.id, type: g.choices ? 'choice' : 'input' }, g);
  }

  /* targets: [{sid, cid}] の中から n 問。知識問題は重ならないように選ぶ */
  function buildSet(targets, n) {
    const pools = targets.map(({ sid, cid }) => {
      const subject = SUBJ[sid], cat = catOf(sid, cid);
      const bank = (subject.bank || [])
        .map((item, idx) => ({ item, idx }))
        .filter((x) => x.item.cat === cid);
      return { subject, cat, bank: shuffle(bank) };
    });
    const out = [], seen = new Set();
    let guard = 0;
    while (out.length < n && guard++ < n * 50) {
      const live = pools.filter((p) => p.cat.gens || p.bank.length);
      if (!live.length) break;
      const p = pick(live);
      let q;
      if (p.cat.gens && (!p.bank.length || Math.random() < 0.5)) q = fromGen(p.subject, p.cat);
      else { const { item, idx } = p.bank.pop(); q = fromBank(p.subject, item, idx); }
      if (seen.has(q.q)) continue;
      seen.add(q.q);
      out.push(q);
    }
    return out;
  }

  /* ───────── 画面共通 ───────── */
  const h = (html) => { $app.innerHTML = html; window.scrollTo(0, 0); };
  const on = (sel, ev, fn) => { const el = $app.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
  const onAll = (sel, ev, fn) => $app.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  let keyHandler = null;
  const setKeys = (fn) => { keyHandler = fn; };
  document.addEventListener('keydown', (e) => { if (keyHandler) keyHandler(e); });
  document.getElementById('homeBtn').addEventListener('click', () => {
    if (session && !session.done && session.idx > 0 && !confirm('とちゅうでやめてホームにもどりますか？')) return;
    home();
  });

  const pct = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);
  const ansText = (q) => (q.type === 'choice' ? esc(q.ans) : rich(fmt(q.ans, { fraction: q.fracAns })) + (q.unit ? ' ' + esc(q.unit) : ''));
  const subjTotals = (sid) => Object.entries(store.stats)
    .filter(([k]) => k.startsWith(sid + ':'))
    .reduce((a, [, v]) => ({ n: a.n + v.n, ok: a.ok + v.ok }), { n: 0, ok: 0 });

  /* ───────── ホーム ───────── */
  function home() {
    session = null; setKeys(null);
    const tiles = SUBJECTS.map((s) => {
      const t = subjTotals(s.id);
      return `<button class="tile" style="--tc:${s.color}" data-s="${s.id}">
        <span class="ic">${s.icon}</span><span class="tt">${s.name}</span>
        <span class="ds">${s.cats.map((c) => esc(c.name)).join('・')}</span>
        <span class="badge">${t.n ? `これまで ${t.n} 問・正答率 ${pct(t.ok, t.n)}%` : 'まだ解いていません'}</span>
      </button>`;
    }).join('');
    const wn = store.wrong.length;
    h(`
      <h1>きょうも 1 歩ずつ。</h1>
      <p class="lead">東海中学の入試に向けて、算数・理科・社会の問題を練習しましょう。算数と理科の計算問題は、毎回数字が変わります。</p>
      <div class="grid">${tiles}
        <button class="tile" style="--tc:var(--c-mix)" data-mix="1">
          <span class="ic">📝</span><span class="tt">ミニ模試</span>
          <span class="ds">3 教科から 15 問。時間を計って本番の練習。</span>
        </button>
        <button class="tile" style="--tc:var(--ng)" data-review="1" ${wn ? '' : 'disabled'}>
          <span class="ic">🔁</span><span class="tt">まちがい復習</span>
          <span class="ds">${wn ? `まちがえた問題が ${wn} 問あります。` : 'まちがえた問題はまだありません。'}</span>
        </button>
        <button class="tile" style="--tc:var(--muted)" data-stats="1">
          <span class="ic">📊</span><span class="tt">成績</span>
          <span class="ds">分野ごとの正答率を見て、苦手を見つけよう。</span>
        </button>
      </div>`);
    onAll('[data-s]', 'click', (e) => setup(e.currentTarget.dataset.s));
    on('[data-mix]', 'click', () => {
      const targets = [];
      SUBJECTS.forEach((s) => s.cats.forEach((c) => targets.push({ sid: s.id, cid: c.id })));
      const per = SUBJECTS.map((s) => buildSet(targets.filter((t) => t.sid === s.id), 5));
      start(per.flat(), 'ミニ模試');
    });
    on('[data-review]', 'click', () => start(shuffle(store.wrong).slice(0, 10).map((q) => {
      const c = Object.assign({}, q, { review: true });
      if (c.type === 'choice') c.choices = shuffle(c.choices);
      return c;
    }), 'まちがい復習'));
    on('[data-stats]', 'click', stats);
  }

  /* ───────── 出題設定 ───────── */
  function setup(sid) {
    setKeys(null);
    const s = SUBJ[sid];
    let count = 10;
    h(`
      <h1>${s.icon} ${s.name}</h1>
      <p class="lead">練習したい分野を選んでください。</p>
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <strong>分野</strong>
          <span class="row"><button class="btn ghost" id="all" type="button">すべて</button><button class="btn ghost" id="none" type="button">解除</button></span>
        </div>
        <div class="checks">
          ${s.cats.map((c) => {
            const st = store.stats[`${sid}:${c.id}`];
            const size = c.gens ? '自動生成' : `${(s.bank || []).filter((b) => b.cat === c.id).length} 問`;
            return `<label class="check"><input type="checkbox" value="${c.id}" checked>
              <span>${esc(c.name)}<br><span class="small">${size}${st ? `・正答率 ${pct(st.ok, st.n)}%` : ''}</span></span></label>`;
          }).join('')}
        </div>
        <div style="margin-top:16px"><strong>問題数</strong></div>
        <div class="seg" role="group" aria-label="問題数" style="margin-top:6px">
          ${[5, 10, 20].map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === count}">${n} 問</button>`).join('')}
        </div>
        <div style="margin-top:20px"><button class="btn wide" id="go" type="button">スタート</button></div>
      </div>
      <p class="small">知識問題が足りないときは、選んだ分野の問題数までになります。</p>`);
    const boxes = () => [...$app.querySelectorAll('.checks input')];
    const sync = () => { $app.querySelector('#go').disabled = !boxes().some((b) => b.checked); };
    onAll('.checks input', 'change', sync);
    on('#all', 'click', () => { boxes().forEach((b) => { b.checked = true; }); sync(); });
    on('#none', 'click', () => { boxes().forEach((b) => { b.checked = false; }); sync(); });
    onAll('[data-n]', 'click', (e) => {
      count = +e.currentTarget.dataset.n;
      $app.querySelectorAll('[data-n]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === count)));
    });
    on('#go', 'click', () => {
      const targets = boxes().filter((b) => b.checked).map((b) => ({ sid, cid: b.value }));
      const set = buildSet(targets, count);
      if (set.length) start(set, s.name);
    });
  }

  /* ───────── 出題 ───────── */
  let session = null;
  let timerId = null;

  function start(questions, title) {
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
    const body = q.type === 'choice'
      ? `<div class="choices">${q.choices.map((c, i) => `<button class="choice" type="button" data-i="${i}"><span class="no">${i + 1}</span><span>${rich(c)}</span></button>`).join('')}</div>`
      : `<div class="answer-row">
          <input id="ans" type="text" inputmode="decimal" autocomplete="off" aria-label="答え" placeholder="答え">
          ${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}
        </div>
        <div class="err" id="err"></div>
        <div class="keypad" aria-label="入力パッド">
          ${['7', '8', '9', '⌫', '4', '5', '6', '/', '1', '2', '3', 'と', '0', '.', 'C'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}
          <button type="button" class="k-ok" data-k="OK">答える</button>
        </div>
        <div class="hint">分数は「3/4」、帯分数は「1と3/4」のように入力します。小数でも OK。</div>`;
    h(`
      <div class="qhead"><span><span class="tag" style="--tc:${s.color}">${s.name}</span> ${esc(cat ? cat.name : '')}</span>
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

    let answered = false;
    const finish = (ok, given) => {
      if (answered) return;
      answered = true;
      session.results.push({ q, ok, given });
      record(q, ok);
      $app.querySelector('#skip').hidden = true;
      const nb = $app.querySelector('#next');
      nb.hidden = false;
      $app.querySelector('#fb').innerHTML = `
        <div class="feedback ${ok ? 'ok' : 'ng'}">
          <div class="mark">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
          ${ok ? '' : `<div>正解：<strong>${ansText(q)}</strong></div>`}
          <div class="exp-title">解説</div>
          <div class="exp">${rich(q.exp)}</div>
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
        const i = +e.key - 1;
        const b = $app.querySelector(`.choice[data-i="${i}"]`);
        if (b) b.click();
      });
    } else {
      const input = $app.querySelector('#ans');
      const err = $app.querySelector('#err');
      const submit = () => {
        if (answered) return;
        const v = input.value.trim();
        if (!v) { err.textContent = '答えを入力してください。'; return; }
        const r = parseAnswer(v);
        if (!r) { err.textContent = '数字・小数・分数（3/4、1と3/4）で入力してください。'; return; }
        err.textContent = '';
        const ok = req(r, q.ans);
        input.classList.add(ok ? 'ok' : 'ng');
        finish(ok, v);
      };
      onAll('[data-k]', 'click', (e) => {
        const k = e.currentTarget.dataset.k;
        if (k === 'OK') return submit();
        if (k === '⌫') input.value = input.value.slice(0, -1);
        else if (k === 'C') input.value = '';
        else input.value += k;
        err.textContent = '';
      });
      setKeys((e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (answered) next(); else submit();
      });
      // スマホではキーボードが画面をかくすので、自動フォーカスは広い画面だけ
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
    h(`
      <h1>${esc(session.title)} の結果</h1>
      <div class="card">
        <div class="score">${ok}<small> / ${rs.length} 問</small>　${p}<small>%</small></div>
        <p style="margin:6px 0 0">${msg}</p>
        <p class="small" style="margin:4px 0 0">かかった時間 ${elapsed()}</p>
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
              <div>正解：<strong>${ansText(r.q)}</strong>${!r.ok ? `　あなたの答え：${r.given == null ? 'わからない' : rich(r.given)}` : ''}</div>
              <div class="exp">${rich(r.q.exp)}</div>
            </div></details></li>`).join('')}
        </ul>
      </div>`);
    on('#redo', 'click', () => start(wrongs.map((q) => Object.assign({}, q, { choices: q.choices && shuffle(q.choices) })), 'もう一度'));
    on('#home2', 'click', home);
  }

  /* ───────── 成績 ───────── */
  function stats() {
    setKeys(null);
    const rows = SUBJECTS.map((s) => {
      const t = subjTotals(s.id);
      const weakest = s.cats
        .map((c) => ({ c, st: store.stats[`${s.id}:${c.id}`] }))
        .filter((x) => x.st && x.st.n >= 3)
        .sort((a, b) => a.st.ok / a.st.n - b.st.ok / b.st.n)[0];
      return `<div class="card" style="--tc:${s.color}">
        <div class="row" style="justify-content:space-between"><strong>${s.icon} ${s.name}</strong>
          <span class="small">${t.n} 問・正答率 ${pct(t.ok, t.n)}%</span></div>
        ${s.cats.map((c) => {
          const st = store.stats[`${s.id}:${c.id}`] || { n: 0, ok: 0 };
          return `<div class="stat-row"><span>${esc(c.name)}</span>
            <span class="bar"><i style="width:${pct(st.ok, st.n)}%"></i></span>
            <span class="pc">${st.n ? pct(st.ok, st.n) + '%' : '―'}</span></div>`;
        }).join('')}
        ${weakest ? `<p class="small" style="margin:8px 0 0">いちばん苦手：<strong>${esc(weakest.c.name)}</strong>（${pct(weakest.st.ok, weakest.st.n)}%）</p>` : ''}
      </div>`;
    }).join('');
    h(`
      <h1>📊 成績</h1>
      <p class="lead">これまでに解いた問題の正答率です（この端末のブラウザに保存されます）。</p>
      ${rows}
      <div class="row"><button class="btn sub" id="back" type="button">ホームへ</button>
      <button class="btn ghost" id="reset" type="button">記録をすべて消す</button></div>`);
    on('#back', 'click', home);
    on('#reset', 'click', () => {
      if (!confirm('成績とまちがえた問題の記録をすべて消します。よろしいですか？')) return;
      store = blank(); save(); stats();
    });
  }

  home();
})();
