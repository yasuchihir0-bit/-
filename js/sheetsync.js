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
    return c && typeof c.url === 'string' && URL_RE.test(c.url) && typeof c.secret === 'string' && c.secret.length >= MIN_SECRET ? { url: c.url, secret: c.secret } : null;
  };
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
  function setConfig(url, secret) {
    url = String(url || '').trim(); secret = String(secret || '').trim();
    const bad = checkInput(url, secret);
    if (bad) return bad;
    ls.set(CFG_KEY, JSON.stringify({ url, secret }));
    return { ok: true };
  }
  function clearConfig() { ls.del(CFG_KEY); ls.del(ST_KEY); }

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
  };
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
    if (r.j && r.j.ok) return { ok: true, message: 'つながりました。' };
    return { err: (r.j && r.j.err) || 'fail', message: ERR[r.j && r.j.err] || REFUSED };
  }

  let running = null, timer = null;
  /* この端末の、まだ送っていない分を送る。opt: { subject, subjectName, getLog(), getDays(), catName(id) } */
  function flush(opt) {
    const c = config();
    if (!c) return Promise.resolve({ skipped: true });
    if (running) return running;
    running = (async () => {
      const dev = device(), key = `${dev}:${opt.subject}`;
      const st = state();
      const days = {};
      const all = (opt.getDays && opt.getDays()) || {};
      Object.keys(all).sort().slice(-DAYS_SENT).forEach((d) => { const v = all[d] || {}; days[d] = { n: v.n || 0, ok: v.ok || 0, cards: v.cards || 0 }; });
      let sent = 0, result = { ok: true, sent: 0 }, first = true;
      for (let i = 0; i < MAX_BATCHES; i++) {
        const after = Number.isInteger(st.acked[key]) ? st.acked[key] : -1;
        const unsent = (opt.getLog() || []).filter((e) => e && Number.isInteger(e.n) && e.n > after).sort((a, b) => a.n - b.n).slice(0, BATCH);
        if (!unsent.length && (!first || !Object.keys(days).length)) break;
        const rows = unsent.map((e) => ({ n: e.n, d: e.d, t: e.t, cat: e.cat, catName: opt.catName ? opt.catName(e.cat) : e.cat, m: e.m, g: e.g, q: e.q, ans: e.ans, given: e.given === undefined ? null : e.given }));
        const r = await send(c, { dev, subj: opt.subject, subjName: opt.subjectName, rows, days: first ? days : undefined }, true);
        first = false;
        if (r.fail) { st.lastErr = '通信できませんでした。あとでもう一度送ります。'; result = { err: 'net' }; break; }
        if (!r.read) { st.unconfirmed = true; sent += rows.length; result = { ok: true, unconfirmed: true, sent }; break; }
        if (!r.j || !r.j.ok) { st.lastErr = ERR[r.j && r.j.err] || REFUSED; result = { err: (r.j && r.j.err) || 'fail' }; break; }
        if (Number.isInteger(r.j.acked) && r.j.acked >= 0) st.acked[key] = r.j.acked; else if (unsent.length) st.acked[key] = unsent[unsent.length - 1].n;
        st.unconfirmed = false; st.lastErr = ''; st.lastOk = new Date().toISOString();
        sent += rows.length; result = { ok: true, sent };
        if (unsent.length < BATCH) break;
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
    const r = await send(c, { read: true, subj: opt.subject, exclude: device() }, false);
    const st = state();
    if (r.fail) { st.lastErr = '記録を読みこめませんでした。通信できたか、アドレスが正しいか確かめてください。'; saveState(st); return { err: 'net' }; }
    if (!r.j || !r.j.ok) { st.lastErr = ERR[r.j && r.j.err] || REFUSED; saveState(st); return { err: (r.j && r.j.err) || 'fail' }; }
    const j = r.j;
    const out = { at: typeof j.at === 'string' ? j.at : '', fetched: new Date().toISOString(), devs: Math.max(0, +j.devs || 0), log: Array.isArray(j.rows) ? j.rows : [], days: j.days && typeof j.days === 'object' ? j.days : {} };
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
    return p && p.err ? p : { ok: true, sent: (f && f.sent) || 0, count: p.count || 0, devs: p.devs || 0, unconfirmed: !!(f && f.unconfirmed) };
  }

  function status(opt) {
    const c = config(), st = state();
    const key = `${device()}:${opt.subject}`;
    const after = Number.isInteger(st.acked[key]) ? st.acked[key] : -1;
    const pending = c ? (opt.getLog() || []).filter((e) => e && Number.isInteger(e.n) && e.n > after).length : 0;
    return { configured: !!c, url: c ? c.url : '', pending, lastOk: st.lastOk, lastPull: st.lastPull || '', lastErr: st.lastErr, unconfirmed: !!st.unconfirmed };
  }

  g.SheetSync = { setConfig, clearConfig, test, flush, flushSoon, pull, sync, status, MIN_SECRET };
})(typeof window !== 'undefined' ? window : globalThis);
