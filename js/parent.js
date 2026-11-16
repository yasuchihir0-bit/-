/* 保護者の画面（parent.html）：ようす・申請・応援・ご褒美・設定
 *   受け口（保護者の Google）に、保護者の合言葉でたずねて表示する。合言葉は、この端末に設定されたものを使う
 *   （受け口づくりの案内を終えた端末、または「保護者の端末用リンク」で設定した端末）。 */
(function () {
  'use strict';
  const S = window.SheetSync;
  const esc = window.U.esc;
  const $app = document.getElementById('app');
  const h = (html) => { $app.innerHTML = html; };
  const $ = (sel) => $app.querySelector(sel);
  const $$ = (sel) => [...$app.querySelectorAll(sel)];
  const num = (v) => (Number.isFinite(+v) ? Math.floor(+v) : 0);
  const pct = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);
  const mins = (sec) => Math.round(num(sec) / 60);
  const SUBJ = { kokugo: '📖 国語', shakai: '🗾 社会', rika: '🔬 理科' };
  const PAGES = { kokugo: 'kokugo.html', shakai: 'shakai.html', rika: 'rika.html' };
  const STAMPS = ['💮 よくできました', '👍 いいね！', '🔥 がんばってるね', '🌸 すごい！', '💪 ファイト！', '🍀 その調子', '🎉 おめでとう', '📚 コツコツえらい'];
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtTime = (iso) => { const d = new Date(iso); return iso && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}` : '—'; };
  const ERR = {
    secret: '合言葉が受け付けられませんでした。この端末の設定を確かめてください。',
    need_split: 'この受け口は、合言葉が 1 つだけの設定です。ごほうびの承認などには、保護者の合言葉（READ_SECRET）を分けた受け口が必要です。教科の「👪 保護者の方へ」→「🔧 受け口を新しくする」の案内で作りなおしてください。',
    net: '受け口に届きませんでした。ネットにつながっているか確かめてください。',
    notfound: 'もう見つかりません（ほかの端末で変わったのかもしれません）。',
    done: 'もう処理されています。',
    format: '入力の形がちがいます。',
  };
  let kids = [];
  let kid = '';
  const kidName = (dev) => { const k = kids.find((x) => x.dev === dev); return (k && k.label) || `端末 ${String(dev || '').slice(0, 4)}`; };

  async function api(act, extra) {
    const r = await S.parentCall(act, extra).catch(() => ({ ok: false, err: 'net' }));
    if (r && r.ok && Number.isInteger(r.ver) && r.ver < S.MIN_VER) return { ok: false, err: 'old' };
    return r || { ok: false, err: 'fail' };
  }
  const errText = (r) => (r && r.err === 'old' ? '受け口（Code.gs）が古いようです。教科の「👪 保護者の方へ」→「🔧 受け口を新しくする」で新しくしてください。' : ERR[r && r.err] || 'うまくいきませんでした。');
  function alertBox(t) { const el = $('#p-msg'); if (el) el.textContent = t; }

  /* ───────── この端末が保護者の端末として設定されていないとき ───────── */
  function notSet() {
    const st = S.status({ subject: 'shakai', getLog: () => [] });
    h(`<h1>👪 保護者の画面</h1>
      <div class="card">
        <p style="margin-top:0">${st.configured ? 'この端末は、<b>お子さんの端末</b>として設定されています。保護者の画面は、保護者の端末で開いてください。' : 'この端末は、まだ<b>保護者の端末</b>として設定されていません。'}</p>
        <ol class="steps">
          <li>まだ受け口がないとき：教科を開いて、いちばん下の「👪 保護者の方へ」→「🛠 受け口をつくる」の案内で作ります。終わると、この端末が保護者の端末になります。</li>
          <li>受け口はあり、もう 1 台の保護者の端末にしたいとき：保護者の端末で作った「保護者の端末用リンク」を、この端末で開きます。</li>
        </ol>
        <p><a class="btn" href="shakai.html#parents">保護者の方へ（受け口をつくる）</a></p>
      </div>
      <div class="card">
        <label class="small" for="plink">保護者の端末用リンクを、ここに貼りつけても設定できます（ホーム画面のアイコンから開いているときや、リンクを開いても設定されないとき）</label>
        <input id="plink" class="p-field" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/index.html#setup=…">
        <button class="btn" id="plinkgo" type="button">設定する</button>
        <p class="small p-err" id="p-msg" role="alert"></p>
      </div>`);
    $('#plinkgo').addEventListener('click', async () => {
      const raw = $('#plink').value.trim();
      let hash = '';
      try { hash = new URL(raw).hash; } catch (e) { hash = raw.startsWith('#') ? raw : ''; }
      const link = S.readLink(hash);
      if (!link || link.err) return alertBox((link && link.err) || '設定リンクを、そのまま全部貼りつけてください。');
      if (link.role !== 'parent') return alertBox('これはお子さんの端末用のリンクです。保護者の端末用のリンクを貼りつけてください。');
      alertBox('受け口に確かめています…');
      const r = await S.applyLink(link);
      if (r.ok) main('look'); else alertBox(r.message || '設定できませんでした。');
    });
  }

  /* ───────── タブ ───────── */
  const TABS = [['look', 'ようす'], ['req', '申請'], ['msg', '応援'], ['reward', 'ご褒美'], ['set', '設定']];
  async function main(tab) {
    h('<p class="small">読みこんでいます…</p>');
    const [kr, sm] = await Promise.all([api('kids'), api('summary', { today: today(), kid })]);
    if (!kr.ok || !sm.ok) {
      h(`<h1>👪 保護者の画面</h1><div class="card"><p class="p-err">${esc(errText(kr.ok ? sm : kr))}</p><button class="btn sub" id="retry" type="button">もう一度</button></div>`);
      $('#retry').addEventListener('click', () => main(tab));
      return;
    }
    kids = kr.kids || [];
    if (kid && !kids.some((k) => k.dev === kid)) kid = '';
    h(`<nav class="p-tabs" role="tablist">${TABS.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}">${name}${id === 'req' && num(sm.pending) ? `<span class="p-count">${num(sm.pending)}</span>` : ''}</button>`).join('')}</nav>
      ${kids.length > 1 ? `<div class="row" style="margin-bottom:10px"><span class="small">お子さん</span><div class="seg" role="group" aria-label="お子さん">
        <button type="button" data-kid="" aria-pressed="${!kid}">ぜんいん</button>${kids.map((k) => `<button type="button" data-kid="${esc(k.dev)}" aria-pressed="${k.dev === kid}">${esc(k.label || `端末 ${k.dev.slice(0, 4)}`)}</button>`).join('')}</div></div>` : ''}
      <div id="tab"></div><p class="small p-err" id="p-msg" role="alert"></p>`);
    $$('[data-tab]').forEach((b) => b.addEventListener('click', () => main(b.dataset.tab)));
    $$('[data-kid]').forEach((b) => b.addEventListener('click', () => { kid = b.dataset.kid; main(tab); }));
    const view = { look: () => look(sm), req, msg, reward, set }[tab] || (() => look(sm));
    try { await view(); } catch (e) { alertBox(ERR.net); }
  }
  const tabHtml = (html) => { $('#tab').innerHTML = html; };

  /* ようす */
  function look(s) {
    const t = s.today || {}, w = s.week || {};
    tabHtml(`
      <div class="card hero">
        <div class="small">きょう${kid ? `（${esc(kidName(kid))}）` : ''}</div>
        <div class="kpis">
          <div class="kpi"><b class="p-num">${num(t.solved)}</b><span>問</span></div>
          <div class="kpi"><b class="p-num">${pct(t.ok, t.solved)}%</b><span>正答率</span></div>
          <div class="kpi"><b class="p-num">${mins(t.sec)}</b><span>分</span></div>
          <div class="kpi"><b class="p-num">${num(s.streak)}</b><span>日連続</span></div>
        </div>
        <p class="small" style="margin:0">${Object.entries(SUBJ).map(([k, n]) => `${n} ${num(t.bySubject && t.bySubject[k])} 問`).join('・')}</p>
      </div>
      <div class="card">
        <div class="small">今週（月曜から）</div>
        <div class="kpis">
          <div class="kpi"><b class="p-num">${num(w.solved)}</b><span>問</span></div>
          <div class="kpi"><b class="p-num">${pct(w.ok, w.solved)}%</b><span>正答率</span></div>
          <div class="kpi"><b class="p-num">${mins(w.sec)}</b><span>分</span></div>
          <div class="kpi"><b class="p-num">+${num(w.gained)}</b><span>pt</span></div>
        </div>
        <p style="margin:0">💰 いまのポイント <b class="p-num">${num(s.balance)}</b> pt</p>
      </div>
      <div class="card"><strong>苦手そうな分野</strong> <span class="small">（直近 14 日・10 問以上）</span>
        ${s.weak && s.weak.length ? `<ul class="p-list">${s.weak.map((x) => `<li><span class="p-main">${esc(SUBJ[x.subject] || '')} ${esc(x.catName)}</span><span class="p-num">${pct(x.ok, x.n)}%（${num(x.ok)}/${num(x.n)}）</span></li>`).join('')}</ul>`
          : '<p class="small">まだデータが足りません。</p>'}
      </div>
      <div class="card"><strong>まちがえた問題と答えた内容</strong>
        <p class="small" style="margin:4px 0 8px">教科ごとの保護者画面で見られます。</p>
        <div class="row">${Object.entries(PAGES).map(([k, p]) => `<a class="btn sub" href="${p}#parents">${SUBJ[k]}</a>`).join('')}</div>
      </div>
      <p class="small center">最後に記録が届いた時刻：${esc(fmtTime(s.lastSeen))}</p>`);
  }

  /* 申請 */
  async function req() {
    const r = await api('requests', { status: 'all', kid });
    if (!r.ok) return alertBox(errText(r));
    const all = r.requests || [];
    const pend = all.filter((x) => x.status === 'pending');
    const done = all.filter((x) => x.status !== 'pending').slice(0, 10);
    const label = { approved: '✅ 承認', rejected: '🙅 見送り' };
    tabHtml(`
      <div class="card"><strong>確認待ち</strong>
        ${pend.length ? `<ul class="p-list">${pend.map((x) => `<li><span class="p-main">🎁 <b>${esc(x.name)}</b>（${num(x.cost)} pt）${kids.length > 1 ? `・${esc(kidName(x.dev))}` : ''}<br><span class="small">${esc(fmtTime(x.createdAt))}</span>
          <input class="p-field" data-note="${num(x.id)}" maxlength="100" placeholder="ひとこと（なくてもOK）" aria-label="ひとこと"></span>
          <span class="p-row-btns"><button class="btn" type="button" data-ok="${num(x.id)}">承認</button><button class="btn ghost" type="button" data-ng="${num(x.id)}">見送り</button></span></li>`).join('')}</ul>`
          : '<p class="small">確認待ちの申請はありません。</p>'}
        <p class="small">見送ると、ポイントはお子さんに戻ります。</p>
      </div>
      ${done.length ? `<div class="card"><strong>これまで</strong><ul class="p-list">${done.map((x) => `<li><span class="p-main">${esc(x.name)}（${num(x.cost)} pt）${kids.length > 1 ? `・${esc(kidName(x.dev))}` : ''}${x.note ? `<br><span class="small">${esc(x.note)}</span>` : ''}</span><span>${label[x.status] || ''}</span></li>`).join('')}</ul></div>` : ''}`);
    const decide = async (id, approve) => {
      const note = ($(`[data-note="${id}"]`) || {}).value || '';
      $$('[data-ok],[data-ng]').forEach((b) => { b.disabled = true; });
      const d = await api('decide', { id: +id, approve, note });
      if (!d.ok) alertBox(errText(d));
      main('req');
    };
    $$('[data-ok]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.ok, true)));
    $$('[data-ng]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.ng, false)));
  }

  /* 応援 */
  async function msg() {
    const r = await api('messages');
    if (!r.ok) return alertBox(errText(r));
    const list = r.messages || [];
    let stamp = '';
    tabHtml(`
      <div class="card"><strong>スタンプ</strong>
        <div class="p-stamps" style="margin-top:8px">${STAMPS.map((x, i) => `<button type="button" data-stamp="${i}" aria-pressed="false">${esc(x)}</button>`).join('')}</div>
        <label class="small" for="txt" style="display:block;margin-top:10px">ひとこと（100 文字まで・なくてもOK）</label>
        <textarea id="txt" class="p-field" maxlength="100" rows="2"></textarea>
        ${kids.length > 1 ? `<label class="small" for="to">だれに</label><select id="to" class="p-field"><option value="*">ぜんいん</option>${kids.map((k) => `<option value="${esc(k.dev)}" ${k.dev === kid ? 'selected' : ''}>${esc(kidName(k.dev))}</option>`).join('')}</select>` : ''}
        <button class="btn" id="send" type="button">送る</button>
        <p class="small">お子さんが次にアプリのホームを開いたとき、ホームに出ます。</p>
      </div>
      <div class="card"><strong>送ったもの</strong>
        ${list.length ? `<ul class="p-list">${list.map((m) => `<li><span class="p-main">${m.stamp ? `<b>${esc(m.stamp)}</b> ` : ''}${esc(m.text)}<br><span class="small">${esc(fmtTime(m.createdAt))}${kids.length > 1 ? `・${m.to === '*' ? 'ぜんいん' : esc(kidName(m.to))}あて` : ''}</span></span>
          <span class="small">${m.readBy && m.readBy.length ? `👀 読んだ${kids.length > 1 ? `（${m.readBy.map((d) => esc(kidName(d))).join('・')}）` : ''}` : 'まだ'}</span></li>`).join('')}</ul>` : '<p class="small">まだありません。</p>'}
      </div>`);
    $$('[data-stamp]').forEach((b) => b.addEventListener('click', () => {
      const x = STAMPS[+b.dataset.stamp];
      stamp = stamp === x ? '' : x;
      $$('[data-stamp]').forEach((y) => y.setAttribute('aria-pressed', String(STAMPS[+y.dataset.stamp] === stamp)));
    }));
    $('#send').addEventListener('click', async () => {
      const text = $('#txt').value.trim();
      if (!stamp && !text) return alertBox('スタンプかひとことを選んでください。');
      const to = $('#to') ? $('#to').value : '*';
      $('#send').disabled = true;
      const d = await api('send', { stamp, text, to });
      if (d.ok) main('msg'); else { alertBox(errText(d)); $('#send').disabled = false; }
    });
  }

  /* ご褒美 */
  async function reward() {
    const r = await api('rewards');
    if (!r.ok) return alertBox(errText(r));
    const list = r.rewards || [];
    tabHtml(`
      <div class="card"><strong>ご褒美を追加</strong>
        <div class="row" style="align-items:flex-end">
          <label style="flex:0 0 5em"><span class="small">絵文字</span><input id="em" class="p-field" maxlength="4" placeholder="🎮"></label>
          <label style="flex:1 1 10em"><span class="small">名前（30 文字まで）</span><input id="nm" class="p-field" maxlength="30" placeholder="ゲーム30分"></label>
          <label style="flex:0 0 7em"><span class="small">ポイント</span><input id="ct" class="p-field" type="number" min="1" max="100000" inputmode="numeric" placeholder="300"></label>
        </div>
        <button class="btn" id="add" type="button">追加する</button>
        <p class="small">目安：毎日 20 問くらい学習すると、1 か月でおよそ 2,000〜3,000pt たまります（正解の数やバッジで変わります）。</p>
      </div>
      <div class="card"><strong>登録したご褒美</strong>
        ${list.length ? `<ul class="p-list">${list.map((x, i) => `<li><span class="p-main" style="${x.hidden ? 'opacity:.5' : ''}">${esc(x.emoji || '🎁')} ${esc(x.name)}${x.hidden ? '（非表示）' : ''}</span>
          <input class="p-field" style="width:7em;margin:0" type="number" min="1" max="100000" value="${num(x.cost)}" data-cost="${num(x.id)}" aria-label="必要なポイント">
          <span class="p-row-btns">
            <button class="btn ghost" type="button" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">↑</button>
            <button class="btn ghost" type="button" data-hide="${num(x.id)}" data-hidden="${x.hidden ? 1 : 0}">${x.hidden ? '表示する' : '非表示'}</button>
          </span></li>`).join('')}</ul>` : '<p class="small">まだありません。</p>'}
      </div>`);
    const put = async (id, body) => { const d = await api('reward_update', Object.assign({ id: +id }, body)); if (!d.ok) alertBox(d.err === 'format' ? 'ポイントは 1〜100000 にしてください。' : errText(d)); return d.ok; };
    $('#add').addEventListener('click', async () => {
      const body = { emoji: $('#em').value.trim(), name: $('#nm').value.trim(), cost: Math.floor(+$('#ct').value) };
      if (!body.name || !(body.cost >= 1)) return alertBox('名前とポイント（1 以上）を入れてください。');
      $('#add').disabled = true;
      const d = await api('reward_add', body);
      if (d.ok) main('reward'); else { alertBox(d.err === 'format' ? '名前は 30 文字、ポイントは 1〜100000 にしてください。' : errText(d)); $('#add').disabled = false; }
    });
    $$('[data-cost]').forEach((inp) => inp.addEventListener('change', async () => { if (await put(inp.dataset.cost, { cost: Math.floor(+inp.value) })) alertBox('ポイントを変えました。'); }));
    $$('[data-hide]').forEach((b) => b.addEventListener('click', async () => { await put(b.dataset.hide, { hidden: b.dataset.hidden !== '1' }); main('reward'); }));
    $$('[data-up]').forEach((b) => b.addEventListener('click', async () => {
      const i = +b.dataset.up;
      const order = list.slice();
      [order[i - 1], order[i]] = [order[i], order[i - 1]];
      for (let k = 0; k < order.length; k++) if (order[k].sort !== k) await put(order[k].id, { sort: k });
      main('reward');
    }));
  }

  /* 設定：端末・端末の追加（設定リンク）・ポイントの履歴 */
  async function set() {
    const r = await api('ledger', { limit: 50, kid });
    if (!r.ok) return alertBox(errText(r));
    const pair = S.getPair();
    tabHtml(`
      <div class="card"><strong>お子さんの端末</strong>
        ${kids.length ? `<ul class="p-list">${kids.map((k) => `<li><span class="p-main">${esc(kidName(k.dev))}${k.blocked ? '（外しています）' : ''}<br><span class="small">ポイント ${num(k.balance)} pt・最後の通信 ${esc(fmtTime(k.lastSeen))}</span></span>
          <button class="btn ghost" type="button" data-block="${esc(k.dev)}" data-blocked="${k.blocked ? 1 : 0}">${k.blocked ? '戻す' : '外す'}</button></li>`).join('')}</ul>` : '<p class="small">まだ記録が届いた端末はありません。</p>'}
        <p class="small">「外す」と、その端末からの記録・申請を受け付けなくなります（なくした端末など）。</p>
      </div>
      <div class="card"><strong>端末を追加する</strong>
        ${pair ? `<p class="small" style="margin:4px 0 8px">お子さんの端末（またはもう 1 台の保護者の端末）で開く「設定リンク」を作ります。</p>
          <label class="small" for="lklabel">お子さんの呼び名（例：たろう）</label><input id="lklabel" class="p-field" maxlength="20">
          <div class="row"><button class="btn" id="lkchild" type="button">お子さんの端末用リンク</button><button class="btn sub" id="lkparent" type="button">保護者の端末用リンク</button></div>
          <div id="lkout" hidden><input id="lklink" class="p-field" readonly aria-label="設定リンク"><button class="btn sub" id="lkcopy" type="button">リンクをコピー</button> <span class="small" id="lkmsg"></span><div class="qrbox" id="lkqr"></div>
          <p class="small p-warn">このリンクには合言葉が入っています。設定する端末にだけ送ってください。</p></div>`
          : '<p class="small">この端末には、リンクを作るための合言葉がありません。受け口を作った端末で作ってください。</p>'}
      </div>
      <div class="card"><strong>ポイントの履歴</strong>（新しい順に 50 件）
        ${(r.ledger || []).length ? `<ul class="p-list">${r.ledger.map((l) => `<li><span class="p-main">${esc(l.text)}${kids.length > 1 && !kid ? `・${esc(kidName(l.dev))}` : ''}<br><span class="small">${esc(fmtTime(l.at))}</span></span><b class="p-num">${num(l.pts) > 0 ? '+' : ''}${num(l.pts)}</b></li>`).join('')}</ul>` : '<p class="small">まだありません。</p>'}
      </div>
      <p class="small center"><a class="linkbtn" href="shakai.html#parents">受け口の設定・新しくする（教科の保護者画面）</a></p>`);
    $$('[data-block]').forEach((b) => b.addEventListener('click', async () => {
      const d = await api('block', { kid: b.dataset.block, block: b.dataset.blocked !== '1' });
      if (!d.ok) alertBox(errText(d));
      main('set');
    }));
    const show = (role) => {
      const link = S.makeLink(new URL('index.html', location.href).href, role, role === 'child' ? $('#lklabel').value : '');
      if (!link) return;
      $('#lkout').hidden = false; $('#lklink').value = link;
      const qrEl = $('#lkqr'); qrEl.textContent = '';
      try { const qr = window.qrcode(0, 'M'); qr.addData(link); qr.make(); const img = document.createElement('img'); img.src = qr.createDataURL(4, 4); img.alt = '設定リンクの QR コード'; qrEl.appendChild(img); } catch (e) { qrEl.textContent = 'QR コードを作れませんでした。リンクを送ってください。'; }
      $('#lkcopy').onclick = async () => { try { await navigator.clipboard.writeText(link); $('#lkmsg').textContent = 'コピーしました。'; } catch (e) { $('#lklink').select(); $('#lkmsg').textContent = '長押し（右クリック）でコピーしてください。'; } };
    };
    if (pair) { $('#lkchild').addEventListener('click', () => show('child')); $('#lkparent').addEventListener('click', () => show('parent')); }
  }

  /* ───────── はじめ ───────── */
  if (!S || !S.parentOn()) notSet(); else main('look');
})();
