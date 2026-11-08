(function () {
  const S = globalThis.SCHED;
  const PRESETS = globalThis.SCHOOL_PRESETS;
  const KEY = 'juken-calendar-v1';
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- 保存 ----
  const defaults = () => ({ schools: [], done: {}, notified: {}, settings: { offsets: [7, 3, 1, 0] }, view: 'home', month: null });
  function load() {
    try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaults(); }
  }
  let st = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...st, editing: null })); } catch { /* 保存できない環境 */ } };
  const today = () => new Date();
  // claude.ai の Artifact として開いているとき（.ics の保存や confirm() が使えない）
  const inArtifact = () => !!(window.claude && typeof window.claude.use === 'function');
  const gcal = (e) => `<a class="gcal" href="${esc(S.gcalUrl(e, `${S.TYPE[e.type].icon}${e.school} ${S.TYPE[e.type].label}`))}" target="_blank" rel="noopener">📅 Googleカレンダーに追加</a>`;

  // 確認のダイアログ（confirm() が使えない環境でも動くよう、画面の中に出す）
  function ask(msg, okLabel = 'はい') {
    return new Promise((resolve) => {
      const box = document.createElement('div');
      box.className = 'ask';
      box.innerHTML = `<div class="ask-card" role="alertdialog" aria-modal="true"><p></p><div class="row end"><button type="button" class="btn ghost" data-no>やめる</button><button type="button" class="btn primary" data-yes></button></div></div>`;
      box.querySelector('p').textContent = msg;
      box.querySelector('[data-yes]').textContent = okLabel;
      const done = (v) => { box.remove(); resolve(v); };
      box.querySelector('[data-yes]').onclick = () => done(true);
      box.querySelector('[data-no]').onclick = () => done(false);
      box.onclick = (ev) => { if (ev.target === box) done(false); };
      document.body.appendChild(box);
      box.querySelector('[data-no]').focus();
    });
  }

  // ---- 画面切りかえ ----
  function go(view) { st.view = view; save(); render(); window.scrollTo(0, 0); }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));

  function render() {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.view === st.view));
    const v = { home: viewHome, cal: viewCal, schools: viewSchools, settings: viewSettings }[st.view] || viewHome;
    $('#app').innerHTML = v();
    bind();
    checkReminders();
  }

  const chip = (type) => `<span class="chip t-${type}">${S.TYPE[type].icon} ${S.TYPE[type].label}</span>`;

  // ---- ホーム：次にやること ----
  function viewHome() {
    if (!st.schools.length) {
      return `<section class="card hero">
        <h1>受験スケジュール</h1>
        <p>志望校をえらぶと、<b>出願・試験・合格発表・手続き・納入</b>の日付をまとめて表示し、近づいたらお知らせします。</p>
        <button class="btn primary" data-go="schools">＋ 志望校をえらぶ</button>
      </section>`;
    }
    const events = S.buildEvents(st.schools);
    const list = S.upcoming(events, today(), st.done);
    const conflicts = S.findConflicts(st.schools);
    const late = list.filter((e) => S.urgency(e) === 'late');
    const soon = list.filter((e) => e.days >= 0 && e.days <= 7);
    const later = list.filter((e) => e.days > 7);
    const next = list.find((e) => e.days >= 0);
    const row = (e) => `<li class="ev u-${S.urgency(e)}">
        ${e.task ? `<label class="check"><input type="checkbox" data-done="${esc(e.key)}"><span></span></label>` : '<span class="check none"></span>'}
        <div class="ev-body">
          <div class="ev-top">${chip(e.type)}<span class="cd">${S.countdown(e.days)}</span></div>
          <div class="ev-title">${esc(e.school)}</div>
          <div class="ev-date">${e.third ? '<span class="badge ng">⚠️ 未確認</span> ' : ''}${S.fmtDate(e.date, e.time)}${e.note ? ' ・ ' + esc(e.note) : ''}</div>
          ${inArtifact() ? `<div class="small">${gcal(e)}</div>` : ''}
        </div></li>`;
    const group = (title, arr, cls = '') => (arr.length ? `<h2 class="${cls}">${title}<small>${arr.length}件</small></h2><ul class="evs">${arr.map(row).join('')}</ul>` : '');
    return `
      ${next ? `<section class="card next u-${S.urgency(next)}">
        <div class="next-label">いちばん近い予定</div>
        <div class="next-cd">${S.countdown(next.days)}</div>
        <div>${chip(next.type)} <b>${esc(next.school)}</b></div>
        <div class="muted">${S.fmtDate(next.date, next.time)}</div>
      </section>` : '<section class="card"><p>これからの予定はありません。おつかれさまでした！</p></section>'}
      ${icsBanner()}
      ${unverified().length ? `<button class="card banner ng" data-go="schools" type="button"><b>⚠️ 公式で未確認・未掲載の日程があります</b><div class="small">${unverified().map((x) => esc(x.name)).join('・')}：募集要項で確かめてください。</div><span class="go">確認 ›</span></button>` : ''}
      ${st.schools.some((x) => outdated(x) && !x.edited) ? '<button class="card banner" data-go="schools" type="button"><b>🔄 日程の更新があります</b><div class="small">志望校の画面で「最新の日程に更新」を押してください。</div><span class="go">更新 ›</span></button>' : ''}
      ${conflicts.length ? `<section class="card warn"><h2>⚠️ 気をつけること</h2><ul class="notes">${conflicts.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul></section>` : ''}
      ${group('🚨 期限をすぎています', late, 'red')}
      ${group('📌 1週間以内', soon)}
      ${group('🗓️ その先の予定', later)}
      <p class="muted small">チェックを入れると「済み」になり、お知らせも止まります。日付は目安なので、必ず募集要項で確認してください。</p>`;
  }

  function icsBanner() {
    if (inArtifact()) return '';
    const k = icsState();
    if (k === 'ok') return '';
    const msg = k === 'none'
      ? '<b>🔔 スマホに通知が届くようにしましょう</b><div class="small">アプリを閉じていても、締切の前に通知が届きます（1 分でできます）。</div>'
      : '<b>🔔 日程が変わりました</b><div class="small">スマホのカレンダーに、もう一度入れなおしてください。</div>';
    return `<button class="card banner" data-go="settings" type="button">${msg}<span class="go">設定する ›</span></button>`;
  }

  // ---- 月のカレンダー ----
  function viewCal() {
    const events = S.buildEvents(st.schools);
    if (!st.month) {
      const n = events.find((e) => S.daysUntil(e.date, today()) >= 0) || events[0];
      st.month = n ? n.date.slice(0, 7) : S.ymd(today()).slice(0, 7);
    }
    const [y, m] = st.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysIn = new Date(y, m, 0).getDate();
    const byDate = {};
    for (const e of events) (byDate[e.date] = byDate[e.date] || []).push(e);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push('<div class="day empty"></div>');
    const t = S.ymd(today());
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${y}-${S.pad(m)}-${S.pad(d)}`;
      const evs = byDate[ds] || [];
      const wd = new Date(y, m - 1, d).getDay();
      cells.push(`<button class="day ${ds === t ? 'today' : ''} ${evs.length ? 'has' : ''} w${wd}" data-day="${ds}" type="button">
        <span class="dn">${d}</span>
        ${evs.slice(0, 3).map((e) => `<span class="pill t-${e.type} ${st.done[e.key] ? 'is-done' : ''}">${S.TYPE[e.type].short}<i>${esc(e.school.replace(/中学校?$/, ''))}</i></span>`).join('')}
        ${evs.length > 3 ? `<span class="more">+${evs.length - 3}</span>` : ''}
      </button>`);
    }
    const sel = st.selDay && st.selDay.startsWith(st.month) ? st.selDay : null;
    const selList = sel ? (byDate[sel] || []) : events.filter((e) => e.date.startsWith(st.month));
    return `<section class="card">
      <div class="cal-head">
        <button class="btn icon" data-month="-1" aria-label="前の月">‹</button>
        <h2>${y}年 ${m}月</h2>
        <button class="btn icon" data-month="1" aria-label="次の月">›</button>
      </div>
      <div class="grid wds">${S.WD.map((w, i) => `<div class="w${i}">${w}</div>`).join('')}</div>
      <div class="grid">${cells.join('')}</div>
      <div class="legend">${S.TYPES.map((x) => `<span class="pill t-${x.id}">${x.short}</span>`).join('')}</div>
    </section>
    <section class="card">
      <h2>${sel ? S.fmtDate(sel) : `${m}月の予定`}<small>${selList.length}件</small></h2>
      ${selList.length ? `<ul class="plain">${selList.map((e) => `<li>${chip(e.type)} <b>${esc(e.school)}</b><div class="muted">${S.fmtDate(e.date, e.time)}${e.note ? ' ・ ' + esc(e.note) : ''}${st.done[e.key] ? ' ・ ✅ 済み' : ''}</div></li>`).join('')}</ul>` : '<p class="muted">予定はありません。</p>'}
    </section>`;
  }

  // ---- 日程の出どころ（公式で確認ずみか） ----
  const presetOf = (sc) => (sc.presetId ? PRESETS.find((p) => p.id === sc.presetId) : null);
  const outdated = (sc) => { const p = presetOf(sc); return !!p && JSON.stringify(sc.events) !== JSON.stringify(p.events); };
  const presetLabel = (p) => p.school + (p.round ? ' ' + p.round : '');
  const hasThird = (events) => Object.values(events || {}).some((e) => e.third);
  function badge(sc, p = presetOf(sc)) {
    const link = p && p.url ? ` <a href="${esc(p.url)}" target="_blank" rel="noopener">公式ページ ↗</a>` : '';
    if (!p) return '<span class="badge ok">✏️ 自分で入力</span>';
    if (sc && sc.edited && outdated(sc)) return `<span class="badge ok">✏️ 自分で編集ずみ</span>${link}`;
    if (!Object.keys(p.events).length) return `<span class="badge ng">📭 2027年度の日程は未掲載</span>${link}`;
    if (p.verified) return `<span class="badge ok">✅ 公式で確認ずみ（${S.fmtDate(p.checked).replace(/\(.\)/, '')}）</span>${link}`;
    const all = Object.values(p.events).every((e) => e.third);
    return `<span class="badge ng">⚠️ ${all ? '公式サイト未確認' : '一部が公式未確認'}</span>${link}`;
  }
  const unverified = () => st.schools.filter((sc) => {
    const p = presetOf(sc);
    if (!p || (sc.edited && outdated(sc))) return false;
    return hasThird(sc.events) || !Object.keys(sc.events).length;
  });

  // ---- 志望校 ----
  function viewSchools() {
    if (st.editing) return viewEdit();
    const chosen = new Set(st.schools.map((s) => s.presetId).filter(Boolean));
    const cards = st.schools.map((s) => {
      const filled = S.TYPES.filter((t) => s.events[t.id] && s.events[t.id].date);
      return `<li class="school">
        <div class="school-main"><b>${esc(s.name)}</b><div class="muted small">${esc(s.area || '')}</div>
          <div class="small">${badge(s)}</div>
          ${outdated(s) && !s.edited ? `<button class="btn small primary" data-sync="${esc(s.id)}">🔄 最新の日程に更新</button>` : ''}
          ${outdated(s) && s.edited ? `<button class="btn small ghost" data-sync="${esc(s.id)}">リストの日程にもどす</button>` : ''}
          <div class="small">${filled.map((t) => `<span class="pill t-${t.id}">${s.events[t.id].third ? '⚠️' : ''}${t.short} ${S.fmtDate(s.events[t.id].date).replace(/\(.\)/, '')}</span>`).join(' ') || '<span class="muted">日程が未登録です。公式ページで確かめて「編集」で入れてください</span>'}</div>
          ${S.TYPES.length - filled.length && filled.length ? `<div class="muted small">未登録：${S.TYPES.filter((t) => !filled.includes(t)).map((t) => t.label).join('・')}（募集要項で確かめて「編集」で入れられます）</div>` : ''}
        </div>
        <div class="school-act"><button class="btn small" data-edit="${esc(s.id)}">編集</button><button class="btn small ghost" data-del="${esc(s.id)}">削除</button></div>
      </li>`;
    }).join('');
    const f = st.filter || (st.filter = { pref: '', gender: '', q: '' });
    const match = (p) => (!f.pref || p.pref === f.pref) && (!f.gender || p.gender === f.gender)
      && (!f.q || (p.school + p.city + p.round).includes(f.q));
    const groups = [];
    for (const p of PRESETS.filter(match)) {
      let g = groups.find((x) => x.school === p.school);
      if (!g) groups.push(g = { school: p.school, first: p, rounds: [] });
      g.rounds.push(p);
    }
    const chips = (key, vals) => vals.map(([v, label]) => `<button type="button" class="fchip ${f[key] === v ? 'on' : ''}" data-filter="${key}" data-val="${v}">${label}</button>`).join('');
    return `<section class="card">
      <h2>えらんだ志望校<small>${st.schools.length}件</small></h2>
      ${st.schools.length ? `<ul class="schools">${cards}</ul>` : '<p class="muted">まだありません。下からえらんでください。</p>'}
    </section>
    <section class="card">
      <h2>東海3県の私立中学からえらぶ<small>${new Set(PRESETS.map((p) => p.school)).size}校</small></h2>
      <p class="muted small">2027年度入試の日程です。<span class="badge ok">✅ 公式で確認ずみ</span> は私学協会や学校の公式資料で確かめた日程、<span class="badge ng">⚠️ 未確認</span> は第三者サイトの情報です。入学手続き・納入の締切は、公式資料に無い学校が多いので、募集要項で確かめて「編集」で入れてください。</p>
      <div class="filters">
        <div class="fchips">${chips('pref', [['', 'すべて'], ['愛知', '愛知'], ['岐阜', '岐阜'], ['三重', '三重']])}</div>
        <div class="fchips">${chips('gender', [['', '男女とも'], ['共学', '共学'], ['男子', '男子校'], ['女子', '女子校']])}</div>
        <input type="search" class="search" data-q placeholder="学校名・市町村でさがす" value="${esc(f.q)}" aria-label="学校をさがす">
      </div>
      ${groups.length ? `<ul class="schools">${groups.map((g) => `<li class="school group">
        <div class="school-main"><b>${esc(g.school)}</b> <span class="muted small">${esc(g.first.pref)}・${esc(g.first.city)}・${esc(g.first.gender)}</span>
          <ul class="rounds">${g.rounds.map((p) => `<li>
            <div class="round-main"><span>${esc(p.round || (Object.keys(p.events).length ? '一般入試' : '入試日程'))}</span>
              ${p.events.exam ? `<span class="muted small">試験 ${S.fmtDate(p.events.exam.date)}${p.events.result ? ' → 発表 ' + S.fmtDate(p.events.result.date) : ''}</span>` : ''}
              <div class="small">${badge(null, p)}</div>
              <div class="muted tiny">出典：${p.sources.map((x) => esc(x.label)).join('／') || 'なし'}</div></div>
            <div class="school-act">${chosen.has(p.id) ? '<span class="muted small">✓ 追加ずみ</span>' : `<button class="btn small primary" data-add="${p.id}">＋ 追加</button>`}</div>
          </li>`).join('')}</ul>
        </div></li>`).join('')}</ul>` : '<p class="muted">見つかりませんでした。</p>'}
      <button class="btn" data-new>＋ リストにない学校を自分で入力する</button>
    </section>`;
  }

  function viewEdit() {
    const s = st.editing;
    return `<section class="card">
      <h2>${s.isNew ? '学校を追加' : '日程を編集'}</h2>
      <form id="editForm" class="form">
        <label>学校名<input name="name" required value="${esc(s.name)}" placeholder="例：〇〇中学校"></label>
        <label>メモ（地域・回など）<input name="area" value="${esc(s.area || '')}" placeholder="例：第1回・午前"></label>
        ${S.TYPES.map((t) => {
          const e = s.events[t.id] || {};
          return `<fieldset><legend>${t.icon} ${t.label}</legend>
            <div class="row"><input type="date" name="${t.id}.date" value="${esc(e.date || '')}" aria-label="${t.label}の日付">
            <input type="time" name="${t.id}.time" value="${esc(e.time || '')}" aria-label="${t.label}の時刻"></div>
            <input name="${t.id}.note" value="${esc(e.note || '')}" placeholder="メモ（例：郵送必着・振込先 など）" aria-label="${t.label}のメモ">
          </fieldset>`;
        }).join('')}
        <div class="row end"><button type="button" class="btn ghost" data-cancel>やめる</button><button class="btn primary">保存</button></div>
      </form>
    </section>`;
  }

  // ---- スマホのカレンダーへの書き出し状態 ----
  const icsSig = () => {
    const txt = JSON.stringify([S.buildEvents(st.schools).map((e) => [e.key, e.date, e.time, e.note, e.school]), st.settings.offsets]);
    let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
    return String(h);
  };
  // 'none'＝まだ書き出していない / 'stale'＝書き出しのあとに変わった / 'ok'
  const icsState = () => (!st.settings.icsSig ? 'none' : st.settings.icsSig === icsSig() ? 'ok' : 'stale');

  // ---- 設定 ----
  function viewSettings() {
    const offs = st.settings.offsets;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const ics = icsState();
    const evs = S.buildEvents(st.schools).filter((e) => S.daysUntil(e.date, today()) >= 0);
    const artifactCard = `<section class="card warn">
      <h2>📱 スマホに通知を届ける</h2>
      <p class="small">このページを<b>閉じていても</b>通知が届くように、予定を Google カレンダーに1件ずつ入れます。リンクを押すと Google カレンダーの追加画面が開くので、「通知」を「1日前」などにして保存してください。</p>
      ${evs.length ? `<ul class="plain gcal-list">${evs.map((e) => `<li>${chip(e.type)} <b>${esc(e.school)}</b><div class="muted small">${S.fmtDate(e.date, e.time)}</div>${gcal(e)}</li>`).join('')}</ul>` : '<p class="muted small">これからの予定はまだありません。志望校を追加してください。</p>'}
      <p class="muted small">すべての予定を通知つきでまとめて入れるファイル（.ics）は、このページからは保存できません。GitHub Pages などで公開したアプリ（calendar/index.html）の設定画面から書き出せます。</p>
    </section>`;
    if (inArtifact()) return artifactCard + settingsRest(offs, perm);
    return `<section class="card ${ics === 'ok' ? '' : 'warn'}">
      <h2>📱 スマホに通知を届ける（おすすめ）</h2>
      <p class="small">このアプリを<b>閉じていても</b>通知が届くように、すべての予定と下の「お知らせのタイミング」を、スマホのカレンダーに入れます。通知はカレンダーアプリが出します。</p>
      ${ics === 'ok' ? '<p class="small">✅ 書き出しずみです（日程を直したら、もう一度書き出してください）。</p>'
        : ics === 'stale' ? '<p class="small"><b>⚠️ 前回の書き出しのあとに日程やタイミングが変わりました。</b>もう一度書き出してください。</p>' : ''}
      <button class="btn primary" data-ics ${st.schools.length ? '' : 'disabled'}>📥 カレンダーに入れる（.ics）</button>
      <details class="howto"><summary>入れ方（iPhone）</summary><ol>
        <li>Safari で上のボタンを押す</li><li>「カレンダーに追加」→「すべてを追加」を押す</li>
        <li>入れるカレンダーをえらぶ（家族で共有しているカレンダーにすると、夫婦どちらにも通知が届きます）</li></ol></details>
      <details class="howto"><summary>入れ方（Android・Google カレンダー）</summary><ol>
        <li>上のボタンを押してファイルを保存し、通知から開く（Google カレンダーで開く）</li>
        <li>うまくいかないときは、パソコンで Google カレンダー →「設定」→「インポート / エクスポート」からファイルを読みこむ</li>
        <li>Google カレンダーは、読みこんだ予定に自分の「通知の初期設定」を使うことがあります。予定を開いて通知の時刻を確かめてください</li></ol></details>
      <p class="muted small">同じ予定を読みこみ直すと上書きされます（iPhone は重なることがあるので、そのときは古い予定を消してください）。</p>
    </section>` + settingsRest(offs, perm);
  }

  function settingsRest(offs, perm) {
    return `<section class="card">
      <h2>🔔 お知らせのタイミング</h2>
      <div class="opts">${[14, 7, 3, 2, 1, 0].map((n) => `<label class="opt"><input type="checkbox" data-off="${n}" ${offs.includes(n) ? 'checked' : ''}> ${n === 0 ? '当日' : n + '日前'}</label>`).join('')}</div>
      <p class="muted small">${inArtifact() ? 'このページを開いたときに、この日にあたる予定をお知らせします。' : 'スマホのカレンダーの通知と、このアプリを開いたときのお知らせの両方に使います。'}</p>
      ${perm === 'unsupported' ? '<p class="muted small">このブラウザは、アプリからの通知に対応していません。</p>'
        : perm === 'granted' ? '<p class="small">✅ アプリを開いたときに、ブラウザの通知でもお知らせします。</p>'
        : perm === 'denied' ? '<p class="muted small">ブラウザの通知はブロックされています（ブラウザの設定から許可できます）。</p>'
        : `<button class="btn" data-perm>アプリを開いたときにブラウザ通知も出す</button>`}
    </section>
    <section class="card">
      <h2>💾 データ</h2>
      <p class="muted small">データはこの端末のブラウザにだけ保存されます。別の端末に移すときは書き出し・読みこみを使います。</p>
      <div class="row wrap"><button class="btn" data-export>書き出す（JSON）</button>
      <label class="btn">読みこむ<input type="file" accept="application/json" data-import hidden></label>
      <button class="btn ghost danger" data-reset>すべて消す</button></div>
    </section>`;
  }

  // ---- イベント ----
  function bind() {
    const on = (sel, fn, ev = 'click') => document.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
    on('[data-go]', (el) => go(el.dataset.go));
    on('[data-done]', (el) => {
      if (el.checked) st.done[el.dataset.done] = true; else delete st.done[el.dataset.done];
      save(); setTimeout(render, 250);
    }, 'change');
    on('[data-month]', (el) => {
      const [y, m] = st.month.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(el.dataset.month), 1);
      st.month = S.ymd(d).slice(0, 7); st.selDay = null; save(); render();
    });
    on('[data-day]', (el) => { st.selDay = st.selDay === el.dataset.day ? null : el.dataset.day; save(); render(); });
    on('[data-add]', (el) => {
      const p = PRESETS.find((x) => x.id === el.dataset.add);
      st.schools.push({ id: p.id + '-' + Date.now().toString(36), presetId: p.id, name: presetLabel(p), area: `${p.pref}・${p.city}（${p.gender}）`, events: clone(p.events) });
      if (!Object.keys(p.events).length) toast(`📭 ${p.school} の2027年度の日程は、まだ公式で見つかっていません。公式ページで確かめて「編集」で入れてください`);
      else if (!p.verified) toast(`⚠️ ${presetLabel(p)} の日程には公式で未確認の項目があります。募集要項で確かめてください`);
      save(); render();
    });
    on('[data-new]', () => { st.editing = { id: 'c-' + Date.now().toString(36), name: '', area: '', events: {}, isNew: true }; render(); });
    on('[data-filter]', (el) => { st.filter[el.dataset.filter] = el.dataset.val; save(); render(); });
    on('[data-q]', (el) => {
      st.filter.q = el.value.trim(); save();
      clearTimeout(bind.qt); bind.qt = setTimeout(() => { render(); const q = document.querySelector('[data-q]'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 300);
    }, 'input');
    on('[data-sync]', async (el) => {
      const sc = st.schools.find((x) => x.id === el.dataset.sync);
      const p = presetOf(sc);
      if (sc.edited && !(await ask(`${sc.name} の日程を、リストの日程にもどしますか？（自分で直した内容は消えます）`, 'もどす'))) return;
      sc.events = clone(p.events); sc.name = presetLabel(p); sc.area = `${p.pref}・${p.city}（${p.gender}）`; delete sc.edited;
      save(); render(); toast(`${sc.name} の日程を更新しました`);
    });
    on('[data-edit]', (el) => { st.editing = clone(st.schools.find((s) => s.id === el.dataset.edit)); render(); });
    on('[data-cancel]', () => { st.editing = null; render(); });
    on('[data-del]', async (el) => {
      const s = st.schools.find((x) => x.id === el.dataset.del);
      if (!(await ask(`${s.name} を削除しますか？`, '削除する'))) return;
      st.schools = st.schools.filter((x) => x !== s); save(); render();
    });
    on('#editForm', (form, e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const s = st.editing;
      s.name = fd.get('name').trim(); s.area = fd.get('area').trim();
      s.events = {};
      for (const t of S.TYPES) {
        const date = fd.get(t.id + '.date');
        if (date) s.events[t.id] = { date, time: fd.get(t.id + '.time') || '', note: fd.get(t.id + '.note').trim() };
      }
      const isNew = s.isNew; delete s.isNew;
      if (s.presetId) s.edited = true;
      if (isNew) st.schools.push(s); else st.schools = st.schools.map((x) => (x.id === s.id ? s : x));
      st.editing = null; save(); render();
    }, 'submit');
    on('[data-off]', (el) => {
      const n = Number(el.dataset.off);
      const set = new Set(st.settings.offsets);
      el.checked ? set.add(n) : set.delete(n);
      st.settings.offsets = [...set].sort((a, b) => b - a); save(); render();
    }, 'change');
    on('[data-perm]', () => Notification.requestPermission().then(render));
    on('[data-ics]', () => {
      download('juken-schedule.ics', S.toICS(S.buildEvents(st.schools), st.settings.offsets, new Date()), 'text/calendar');
      st.settings.icsSig = icsSig(); save(); render();
    });
    on('[data-export]', () => download('juken-schedule.json', JSON.stringify({ schools: st.schools, done: st.done, settings: st.settings }, null, 2), 'application/json'));
    on('[data-import]', (el) => {
      const f = el.files[0]; if (!f) return;
      f.text().then((txt) => {
        const d = JSON.parse(txt);
        if (!Array.isArray(d.schools)) throw new Error();
        st = { ...defaults(), ...d, view: 'schools' }; save(); render(); toast('読みこみました');
      }).catch(() => toast('読みこめませんでした'));
    }, 'change');
    on('[data-reset]', async () => { if (await ask('すべてのデータを消しますか？', 'すべて消す')) { st = defaults(); save(); render(); } });
  }

  async function download(name, text, type) {
    if (inArtifact()) {
      const dl = await window.claude.use('downloads');
      if (!dl) { toast('このページからはファイルを保存できません'); return; }
      try { await dl.save({ filename: name, data: text }); toast('保存しました'); } catch (err) {
        toast(err && err.code === 'declined' ? '保存をやめました' : 'ファイルを保存できませんでした');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 4000);
  }

  // ---- リマインド ----
  function checkReminders() {
    const due = S.dueReminders(S.buildEvents(st.schools), today(), st.done, st.settings.offsets, st.notified);
    if (!due.length) return;
    const lines = due.map((d) => `${d.event.school} ${S.TYPE[d.event.type].label}：${S.countdown(d.days)}（${S.fmtDate(d.event.date, d.event.time)}）`);
    if ('Notification' in window && Notification.permission === 'granted') {
      for (const l of lines) showNotice(l);
    }
    toast('🔔 ' + lines.join(' / '));
    for (const d of due) st.notified[d.id] = Date.now();
    save();
  }
  // Android の Chrome などは new Notification が使えないので、service worker から出す
  const swReady = ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    ? navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).catch(() => null)
    : Promise.resolve(null);
  function showNotice(body) {
    const opt = { body, icon: 'icon.svg', tag: body };
    swReady.then((reg) => {
      if (reg) return reg.showNotification('受験スケジュール', opt);
      new Notification('受験スケジュール', opt);
    }).catch(() => { /* このブラウザでは出せない */ });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  setInterval(checkReminders, 60 * 60 * 1000);

  render();
})();
