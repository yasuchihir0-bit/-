/* まちがえた問題を、保護者の Google アカウントにためて、保護者の端末のアプリで見る（お子さんのログインはいりません）
 *   ・受け口は、保護者が自分の Google アカウントに作る小さなプログラム（tools/apps-script/Code.gs）です。
 *   ・お子さんの端末：まだ送っていない分だけ送る（端末ごとの通し番号で管理）。同じ記録が二度届いても二重には書かれません。
 *   ・保護者の端末：受け口から「ほかの端末の記録」を読みこみ、保護者画面で見る。
 *   ・受け口のアドレスと合言葉は、保護者画面で一度だけ設定します（この端末のブラウザに保存。アプリのファイルには入れません）。
 *   ・claude.ai の公開ページでは、外への通信が禁止されているので使えません（ほかの場所に置いたアプリで使います）。
 */
(function (g) {
  'use strict';
  const CFG_KEY = 'tokai-sheet-cfg', ST_KEY = 'tokai-sheet-state', DEV_KEY = 'tokai-device';
  const URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{10,}\/exec$/;
  const MIN_SECRET = 12;
  const MIN_VER = 2;  // 受け口（Code.gs）の版番号が、これより古いときは、新しくしてもらう（版 2：ごほうびのしくみ）
  const LABEL_KEY = 'tokai-sheet-label';
  const PAIR_KEY = 'tokai-sheet-pair';    // 保護者の端末だけ：受け口のアドレスと 2 つの合言葉（ほかの端末の設定リンクを作るため）
  const DRAFT_KEY = 'tokai-sheet-draft';  // 受け口づくりの案内のとちゅう
  const EV_KEY = 'tokai-sheet-ev';        // お子さんの端末：まだ送っていない「解いた記録」（ポイントの計算用。3 教科で共通）
  const FAM_KEY = 'tokai-sheet-fam';      // お子さんの端末：受け口から届いたポイント・ごほうび・応援
  const MAX_EV = 3000, EV_BATCH = 500;
  const BATCH = 150, MAX_BATCHES = 6, TIMEOUT = 25000, DAYS_SENT = 30;
  const remoteKey = (s) => `tokai-${s}-remote`;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } },
  };
  const parse = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };
  function device() {
    let d = ls.get(DEV_KEY);
    if (!/^[a-z0-9]{8}$/.test(d || '')) {
      d = Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
      ls.set(DEV_KEY, d);
    }
    return d;
  }

  const config = () => {
    const c = parse(ls.get(CFG_KEY));
    return c && typeof c.url === 'string' && URL_RE.test(c.url) && typeof c.secret === 'string' && c.secret.length >= MIN_SECRET
      ? { url: c.url, secret: c.secret, can: { write: !(c.can && c.can.write === false), read: !(c.can && c.can.read === false) } } : null;
  };
  /* お子さんの呼び名（保護者画面に出る。端末ごと） */
  const getLabel = () => String(ls.get(LABEL_KEY) || '').slice(0, 20);
  const setLabel = (v) => { v = String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20); if (v) ls.set(LABEL_KEY, v); else ls.del(LABEL_KEY); return v; };
  const state = () => {
    const s = parse(ls.get(ST_KEY));
    return { acked: {}, lastOk: '', lastErr: '', unconfirmed: false, ...(s && typeof s === 'object' ? s : {}) };
  };
  const saveState = (s) => ls.set(ST_KEY, JSON.stringify(s));

  const checkInput = (url, secret) => {
    if (!URL_RE.test(url)) return { err: 'url', message: 'アドレスの形がちがいます。「https://script.google.com/macros/s/…/exec」で終わるアドレスを貼りつけてください。' };
    if (secret.length < MIN_SECRET) return { err: 'secret', message: `合言葉は ${MIN_SECRET} 文字以上です。Code.gs に書いた合言葉と同じものを入れてください。` };
    return null;
  };
  function setConfig(url, secret, can) {
    url = String(url || '').trim(); secret = String(secret || '').trim();
    const bad = checkInput(url, secret);
    if (bad) return bad;
    ls.set(CFG_KEY, JSON.stringify({ url, secret, can: { write: !(can && can.write === false), read: !(can && can.read === false) } }));
    return { ok: true };
  }
  /* 受け口が「この合言葉では書けない／読めない」と答えたとき、この端末の役わりを覚えておく */
  function setCan(patch) {
    const c = parse(ls.get(CFG_KEY));
    if (!c) return;
    c.can = { ...(c.can || {}), ...patch };
    ls.set(CFG_KEY, JSON.stringify(c));
  }
  function clearConfig() { [CFG_KEY, ST_KEY, PAIR_KEY, DRAFT_KEY, EV_KEY, FAM_KEY].forEach((k) => ls.del(k)); } // 合言葉をこの端末に残さない

  async function post(url, payload, noCors) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
    try {
      const opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined };
      if (noCors) opt.mode = 'no-cors';
      return await fetch(url, opt);
    } finally { if (timer) clearTimeout(timer); }
  }
  /* 返事が読めればその中身、読めなければ「送れたが確認できない」、通信できなければ失敗 */
  async function send(c, payload, canGuess) {
    try {
      const res = await post(c.url, { secret: c.secret, ...payload }, false);
      return { read: true, j: await res.json() };
    } catch (e1) {
      if (!canGuess) return { fail: true };
      try { await post(c.url, { secret: c.secret, ...payload }, true); return { read: false }; } catch (e2) { return { fail: true }; }
    }
  }
  const ERR = {
    secret: '合言葉がちがいます。Code.gs に書いた合言葉と同じか確かめてください。',
    format: '受け口が記録の形を受け取れませんでした。',
    config: '受け口の合言葉の設定がまちがっています。Code.gs の SECRET と READ_SECRET（12 文字以上で、たがいにちがうもの）を確かめてください。',
  };
  const OLD = '受け口（Code.gs）が古いようです。最新の Code.gs に貼りかえて、デプロイを更新してください。';
  const verOf = (j) => (j && Number.isInteger(j.ver) ? j.ver : 0);
  const NET = '通信できませんでした。ネットにつながっているか確かめてください。';
  const REFUSED = '受け口が受け付けませんでした。デプロイの設定（アクセスできるユーザー：全員）と、アドレスを確かめてください。';

  /* つながるか試す（記録は送らない） */
  async function test(url, secret) {
    url = String(url || '').trim(); secret = String(secret || '').trim();
    const bad = checkInput(url, secret);
    if (bad) return bad;
    const r = await send({ url, secret }, { ping: true }, true);
    if (r.fail) return { err: 'net', message: NET };
    if (!r.read) return { ok: true, unknown: true, message: '送れましたが、返事は確認できませんでした。記録の送受信がうまくいくか、あとで確かめてください。' };
    if (r.j && r.j.ok) {
      if (verOf(r.j) < MIN_VER) return { err: 'old', message: OLD };
      const can = r.j.can || { write: true, read: true };
      const what = can.write && can.read ? '記録を送ることも、見ることもできます' : can.write ? 'この合言葉では、記録を送れます（見ることはできません）' : 'この合言葉では、記録を見られます（送ることはできません）';
      return { ok: true, can, message: `つながりました。${what}。` };
    }
    return { err: (r.j && r.j.err) || 'fail', message: ERR[r.j && r.j.err] || REFUSED };
  }

  let running = null, timer = null;
  /* この端末の、まだ送っていない分を送る。opt: { subject, subjectName, getLog(), getDays(), catName(id) } */
  function flush(opt) {
    const c = config();
    if (!c) return Promise.resolve({ skipped: true });
    if (!c.can.write) return Promise.resolve({ skipped: true, readonly: true }); // 見る専用の合言葉の端末は、送らない
    if (running) return running;
    running = (async () => {
      const dev = device(), key = `${dev}:${opt.subject}`;
      const st = state();
      const days = {};
      const all = (opt.getDays && opt.getDays()) || {};
      Object.keys(all).sort().slice(-DAYS_SENT).forEach((d) => { const v = all[d] || {}; days[d] = { n: v.n || 0, ok: v.ok || 0, cards: v.cards || 0 }; });
      let sent = 0, result = { ok: true, sent: 0, awards: [] }, first = true;
      const awards = [];
      for (let i = 0; i < MAX_BATCHES; i++) {
        const after = Number.isInteger(st.acked[key]) ? st.acked[key] : -1;
        const unsent = (opt.getLog() || []).filter((e) => e && Number.isInteger(e.n) && e.n > after).sort((a, b) => a.n - b.n).slice(0, BATCH);
        const evq = evLoad().q.slice(0, EV_BATCH);
        if (!unsent.length && !evq.length && (!first || !Object.keys(days).length)) break;
        const rows = unsent.map((e) => ({ n: e.n, d: e.d, t: e.t, cat: e.cat, catName: opt.catName ? opt.catName(e.cat) : e.cat, m: e.m, g: e.g, q: e.q, ans: e.ans, given: e.given === undefined ? null : e.given }));
        const r = await send(c, { v: MIN_VER, dev, subj: opt.subject, subjName: opt.subjectName, label: getLabel(), rows, days: first ? days : undefined, events: evq }, true);
        first = false;
        if (r.fail) { st.lastErr = '通信できませんでした。あとでもう一度送ります。'; result = { err: 'net' }; break; }
        if (!r.read) { st.unconfirmed = true; sent += rows.length; result = { ok: true, unconfirmed: true, sent }; break; }
        if (r.j && r.j.err === 'readonly') { setCan({ write: false }); st.lastErr = ''; result = { skipped: true, readonly: true }; break; }
        if (!r.j || !r.j.ok) { st.lastErr = ERR[r.j && r.j.err] || REFUSED; result = { err: (r.j && r.j.err) || 'fail' }; break; }
        if (verOf(r.j) < MIN_VER) { st.lastErr = OLD; result = { err: 'old' }; break; }
        if (Number.isInteger(r.j.acked) && r.j.acked >= 0) st.acked[key] = r.j.acked; else if (unsent.length) st.acked[key] = unsent[unsent.length - 1].n;
        if (Number.isInteger(r.j.evAcked)) evAck(r.j.evAcked);
        if (r.j.fam) { famSave(r.j.fam.state); if (Array.isArray(r.j.fam.awards)) awards.push(...r.j.fam.awards); }
        st.unconfirmed = false; st.lastErr = ''; st.lastOk = new Date().toISOString();
        sent += rows.length; result = { ok: true, sent, awards };
        if (unsent.length < BATCH && evLoad().q.length === 0) break;
      }
      saveState(st);
      return result;
    })();
    const done = () => { running = null; };
    running.then(done, done);
    return running;
  }
  /* 少し待ってからまとめて送る（まちがいが続いたときに、何度も送らない） */
  function flushSoon(opt, ms) {
    if (!config()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { flush(opt).catch(() => {}); }, ms == null ? 3000 : ms);
  }

  /* 保護者の端末：ほかの端末の記録を読みこみ、この端末に置く（保護者画面が読む） */
  async function pull(opt) {
    const c = config();
    if (!c) return { skipped: true };
    if (!c.can.read) return { skipped: true, writeonly: true }; // 送る専用の合言葉の端末は、読まない
    const r = await send(c, { v: MIN_VER, read: true, subj: opt.subject, exclude: device() }, false);
    const st = state();
    if (r.fail) { st.lastErr = '記録を読みこめませんでした。通信できたか、アドレスが正しいか確かめてください。'; saveState(st); return { err: 'net' }; }
    if (r.j && r.j.err === 'secret') { st.lastErr = ERR.secret; saveState(st); return { err: 'secret' }; }
    if (!r.j || !r.j.ok) { st.lastErr = ERR[r.j && r.j.err] || REFUSED; saveState(st); return { err: (r.j && r.j.err) || 'fail' }; }
    const j = r.j;
    if (verOf(j) < MIN_VER) { st.lastErr = OLD; saveState(st); return { err: 'old' }; }
    const out = { at: typeof j.at === 'string' ? j.at : '', fetched: new Date().toISOString(), devs: Math.max(0, +j.devs || 0), log: Array.isArray(j.rows) ? j.rows : [], days: j.days && typeof j.days === 'object' ? j.days : {}, daysBy: j.daysBy && typeof j.daysBy === 'object' ? j.daysBy : {}, kids: Array.isArray(j.kids) ? j.kids : [] };
    out.log.sort((a, b) => (`${a.d} ${a.t}` < `${b.d} ${b.t}` ? -1 : `${a.d} ${a.t}` > `${b.d} ${b.t}` ? 1 : (a.n || 0) - (b.n || 0)));
    if (!ls.set(remoteKey(opt.subject), JSON.stringify(out))) { out.log = out.log.slice(-200); ls.set(remoteKey(opt.subject), JSON.stringify(out)); }
    st.lastPull = out.fetched; st.lastErr = '';
    saveState(st);
    return { ok: true, count: out.log.length, devs: out.devs };
  }

  /* 送ってから読みこむ（「更新する」ボタン） */
  async function sync(opt) {
    const f = await flush(opt);
    if (f && f.err) return f;
    const p = await pull(opt);
    if (p && p.skipped) return { skipped: true, sent: (f && f.sent) || 0 };
    return p && p.err ? p : { ok: true, sent: (f && f.sent) || 0, count: p.count || 0, devs: p.devs || 0, unconfirmed: !!(f && f.unconfirmed) };
  }

  function status(opt) {
    const c = config(), st = state();
    const key = `${device()}:${opt.subject}`;
    const after = Number.isInteger(st.acked[key]) ? st.acked[key] : -1;
    const pending = c ? (opt.getLog() || []).filter((e) => e && Number.isInteger(e.n) && e.n > after).length : 0;
    return { configured: !!c, url: c ? c.url : '', can: c ? c.can : { write: false, read: false }, label: getLabel(), pending, lastOk: st.lastOk, lastPull: st.lastPull || '', lastErr: st.lastErr, unconfirmed: !!st.unconfirmed };
  }

  /* ───────── 受け口づくりの案内（保護者の端末） ───────── */
  /* 読みまちがえにくい文字だけで、合言葉をつくる（0/O・1/l/I などは使わない） */
  function makeSecret(n = 20) {
    const A = 'abcdefghjkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(n);
    (g.crypto || {}).getRandomValues ? g.crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 2 ** 32); });
    return Array.from(buf, (x) => A[x % A.length]).join('');
  }
  const SECRET_LINE = "const SECRET = 'ここを合言葉に書きかえる';";
  const READ_LINE = "const READ_SECRET = '';";
  /* Code.gs のひな形に、2 つの合言葉を書きこむ。ひな形の形がちがうときは null */
  function buildCode(template, write, read) {
    const t = String(template || '');
    if (t.split(SECRET_LINE).length !== 2 || t.split(READ_LINE).length !== 2) return null;
    if (!/^[a-z0-9]{12,40}$/.test(write) || !/^[a-z0-9]{12,40}$/.test(read) || write === read) return null;
    return t.replace(SECRET_LINE, `const SECRET = '${write}';`).replace(READ_LINE, `const READ_SECRET = '${read}';`);
  }
  const getDraft = () => { const d = parse(ls.get(DRAFT_KEY)); return d && typeof d === 'object' ? d : null; };
  const setDraft = (d) => (d ? ls.set(DRAFT_KEY, JSON.stringify(d)) : ls.del(DRAFT_KEY));
  const getPair = () => {
    const p = parse(ls.get(PAIR_KEY));
    return p && URL_RE.test(p.url || '') && typeof p.write === 'string' && typeof p.read === 'string' ? { url: p.url, write: p.write, read: p.read } : null;
  };
  const setPair = (p) => (p ? ls.set(PAIR_KEY, JSON.stringify({ url: p.url, write: p.write, read: p.read })) : ls.del(PAIR_KEY));

  /* できあがった受け口を、2 つの合言葉で確かめる（送る合言葉は「送るだけ」、見る合言葉は「見るだけ」になっているか） */
  async function checkPair(url, write, read) {
    url = String(url || '').trim();
    if (!URL_RE.test(url)) return { err: 'url', message: 'アドレスの形がちがいます。「https://script.google.com/macros/s/…/exec」で終わるアドレスを貼りつけてください。' };
    const w = await test(url, write);
    if (!w.ok) return w;
    if (w.unknown) return { ok: true, unknown: true, message: w.message };
    const r = await test(url, read);
    if (!r.ok) return r.err === 'secret' ? { err: 'mismatch', message: '見る合言葉が受け付けられませんでした。貼りつけたプログラムが、この画面でコピーしたものか確かめてください（コピーし直して、貼りつけ・保存・デプロイの更新をやり直します）。' } : r;
    if (!(w.can && w.can.write && !w.can.read && r.can && r.can.read && !r.can.write)) return { err: 'mismatch', message: '合言葉の分け方が想定とちがいます。この画面でコピーしたプログラムを、そのまま貼りつけたか確かめてください。' };
    return { ok: true, message: 'つながりました。送る合言葉・見る合言葉とも、正しく動いています。' };
  }

  /* ───────── 設定リンク（ほかの端末に、アドレス・合言葉・呼び名を渡す） ───────── */
  const b64u = {
    enc: (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))); },
  };
  /* role: 'child'（送る合言葉）／'parent'（見る合言葉） */
  function makeLink(base, role, label) {
    const p = getPair();
    if (!p) return null;
    const body = { v: 1, r: role, u: p.url, s: role === 'child' ? p.write : p.read };
    const l = String(label || '').trim().slice(0, 20);
    if (role === 'child' && l) body.l = l;
    return `${String(base).split('#')[0]}#setup=${b64u.enc(JSON.stringify(body))}`;
  }
  /* location.hash から設定リンクの中身を取り出す。なければ null、形がおかしければ { err } */
  function readLink(hash) {
    const m = /^#setup=([A-Za-z0-9_-]{20,2000})$/.exec(String(hash || ''));
    if (!m) return /^#setup=/.test(String(hash || '')) ? { err: 'リンクが途中で切れているか、形がちがいます。もう一度コピーして開いてください。' } : null;
    let o;
    try { o = JSON.parse(b64u.dec(m[1])); } catch (e) { return { err: 'リンクの中身が読めませんでした。もう一度コピーして開いてください。' }; }
    if (!o || o.v !== 1 || !['child', 'parent'].includes(o.r) || !URL_RE.test(o.u || '') || typeof o.s !== 'string' || o.s.length < MIN_SECRET) return { err: 'このアプリの設定リンクではないようです。' };
    return { role: o.r, url: o.u, secret: o.s, label: typeof o.l === 'string' ? o.l.slice(0, 20) : '' };
  }
  /* 設定リンクの内容を、この端末に入れる（受け口に確かめてから） */
  async function applyLink(link) {
    const t = await test(link.url, link.secret);
    if (!t.ok) return t;
    if (!t.unknown) {
      if (link.role === 'child' && !(t.can && t.can.write)) return { err: 'role', message: 'このリンクの合言葉では、記録を送れません。保護者の端末で、お子さん用のリンクを作り直してください。' };
      if (link.role === 'parent' && !(t.can && t.can.read)) return { err: 'role', message: 'このリンクの合言葉では、記録を見られません。保護者用のリンクを作り直してください。' };
    }
    setConfig(link.url, link.secret, t.can);
    if (link.role === 'child') setLabel(link.label);
    return { ok: true, message: t.unknown ? t.message : '' };
  }

  /* ───────── ごほうびのしくみ（お子さんの端末） ───────── */
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function evLoad() {
    const d = parse(ls.get(EV_KEY));
    return { seq: d && Number.isInteger(d.seq) ? d.seq : 0, q: d && Array.isArray(d.q) ? d.q.filter((e) => e && Number.isInteger(e.s)) : [] };
  }
  /* 解いた記録を 1 つためる（送る合言葉が入っている端末だけ）。3 教科のページで共通の通し番号をつける */
  function track(e) {
    const c = config();
    if (!c || !c.can.write) return;
    const d = evLoad();
    const ev = e.k === 'review' ? { s: d.seq, d: today(), k: 'review' }
      : { s: d.seq, d: today(), subj: String(e.subject || '').slice(0, 20), cat: String(e.cat || '').slice(0, 20), catName: String(e.catName || '').slice(0, 30), ok: !!e.ok, lv: Math.max(1, Math.min(3, e.lv | 0)), sec: Math.max(0, Math.min(600, Math.round(e.sec || 0))) };
    d.q.push(ev); d.seq += 1;
    if (d.q.length > MAX_EV) d.q.splice(0, d.q.length - MAX_EV);
    ls.set(EV_KEY, JSON.stringify(d));
  }
  function evAck(n) { const d = evLoad(); d.q = d.q.filter((e) => e.s > n); ls.set(EV_KEY, JSON.stringify(d)); }
  function famSave(state) { if (state && typeof state === 'object') ls.set(FAM_KEY, JSON.stringify({ state, at: new Date().toISOString() })); }
  /* 受け口から届いた、ポイント・バッジ・ごほうび・応援（届いたことがなければ null） */
  function famState() { const f = parse(ls.get(FAM_KEY)); return f && f.state && typeof f.state === 'object' ? f.state : null; }
  const famOn = () => { const c = config(); return !!(c && c.can.write); };
  async function famCall(act, extra) {
    const c = config();
    if (!c || !c.can.write) return { err: 'off' };
    const r = await send(c, Object.assign({ v: MIN_VER, act, dev: device(), label: getLabel() }, extra || {}), false);
    if (r.fail) return { err: 'net' };
    if (!r.j) return { err: 'fail' };
    if (r.j.ok && r.j.state) famSave(r.j.state);
    return r.j;
  }
  /* 保護者の端末：保護者の合言葉で、ようす・申請・応援・ごほうびをあつかう */
  const parentOn = () => { const c = config(); return !!(c && c.can.read); };
  async function parentCall(act, extra) {
    const c = config();
    if (!c || !c.can.read) return { ok: false, err: 'off' };
    const r = await send(c, Object.assign({ v: MIN_VER, act }, extra || {}), false);
    if (r.fail) return { ok: false, err: 'net' };
    return r.j || { ok: false, err: 'fail' };
  }

  /* つながりを確かめる：この端末の設定・受け口の版・送れていない記録・最後のエラーをまとめる */
  async function diagnose(opt) {
    const c = config(), st = state(), ev = evLoad();
    const out = { configured: !!c, role: c ? (c.can.write && c.can.read ? 'both' : c.can.write ? 'child' : 'parent') : '', label: getLabel(),
      pending: 0, events: ev.q.length, lastOk: st.lastOk, lastPull: st.lastPull || '', lastErr: st.lastErr, unconfirmed: !!st.unconfirmed, fam: !!famState() };
    if (!c) return out;
    out.host = new URL(c.url).host;
    out.pending = status(opt).pending;
    const t = await test(c.url, c.secret);
    out.test = t.ok ? (t.unknown ? 'unknown' : 'ok') : t.err;
    out.testMsg = t.message;
    if (t.ok && !t.unknown) {
      if (c.can.write) { const f = await flush(opt); out.flush = f.err ? f.err : `ok（${f.sent || 0} 件）`; out.awards = (f.awards || []).length; const fs = await famCall('state'); out.famNow = fs && fs.ok ? `${(fs.state || {}).balance} pt` : (fs && fs.err) || 'fail'; }
      if (c.can.read) { const p = await pull(opt); out.pull = p.err ? p.err : `ok（${p.count || 0} 件・${p.devs || 0} 台）`; const ps = await parentCall('kids'); out.kids = ps && ps.ok ? ps.kids.length : (ps && ps.err) || 'fail'; }
    }
    const st2 = state();
    out.pendingAfter = status(opt).pending; out.eventsAfter = evLoad().q.length; out.lastErrAfter = st2.lastErr;
    return out;
  }

  g.SheetSync = { diagnose, track, famState, famOn, famCall, parentOn, parentCall, device, setConfig, clearConfig, getLabel, setLabel, test, flush, flushSoon, pull, sync, status, MIN_SECRET, MIN_VER,
    makeSecret, buildCode, getDraft, setDraft, getPair, setPair, checkPair, makeLink, readLink, applyLink, URL_RE };
})(typeof window !== 'undefined' ? window : globalThis);
