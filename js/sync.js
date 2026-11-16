/* 記録の同期（保護者の端末から見るため）
 *   claude.ai の公開ページで開いたときだけ動きます。まちがいの記録を、ログイン中のアカウントだけが読める場所
 *   （data/users/<自分の id>/）に保存し、同じアカウントでログインした別の端末で読みこみます。
 *   ・この端末の記録 → アップロード（変わった部分だけ）
 *   ・ほかの端末の記録 → ダウンロードして localStorage の「tokai-<教科>-remote」に置く（保護者画面が読む）
 *   パソコンでファイルを直接開いたとき（window.claude がないとき）は何もしません。
 */
(function (g) {
  'use strict';
  const SUBJ = [
    { s: 'kokugo', key: 'tokai-kokugo-v1', id: 'koku', name: '国語' },
    { s: 'shakai', key: 'tokai-shakai-v1', id: 'shakai', name: '社会' },
    { s: 'rika', key: 'tokai-rika-v1', id: 'rika', name: '理科' },
  ];
  const DEV_KEY = 'tokai-device', HASH_KEY = 'tokai-sync-hash', AT_KEY = 'tokai-sync-at';
  const LOG_SYNC = 600;   // 同期する、新しいまちがいの件数（教科・端末ごと）
  const IMG_SYNC = 40;    // 同期する、新しい手書き画像の件数
  const PACK = 150000;    // 画像 1 まとまりの大きさの目安（文字数）
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
  const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return `${str.length}:${h}`; };
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);

  /* claude.ai の保存場所につなぐ。つながらないときは { err } */
  let ctxP = null;
  function ctx() {
    if (!ctxP) {
      ctxP = (async () => {
        if (!g.claude || typeof g.claude.use !== 'function') return { err: 'nohost' };
        const [db, user] = await Promise.all([g.claude.use('db'), g.claude.use('user')]);
        if (!db || !user) return { err: 'nodb' };
        const uid = await user.id();
        if (!uid) return { err: 'nouser' };
        return { db, uid, col: db.collection(`data/users/${uid}`) };
      })().catch(() => ({ err: 'nodb' }));
    }
    return ctxP;
  }
  const errOf = (e) => ({ err: e && e.code === 'invalid_argument' ? 'denied' : (e && e.code) || 'fail' });

  /* 1 教科ぶんの、保存する文書をつくる：{ 文書名: 中身 } */
  function build(sub, raw, D) {
    const docs = {};
    const log = raw.log.slice(-LOG_SYNC);
    const boxOf = (e) => {
      const c = e.m === 'kanji' ? (raw.kanji || {})[e.ans] : (raw.cards || {})[`${sub.id}|${e.q}|${e.ans}`];
      return c ? c.box : -1;
    };
    const chunks = {};
    log.forEach((e) => {
      const o = { n: e.n, d: e.d, t: e.t, cat: e.cat, q: e.q, ans: e.ans, g: e.g, m: e.m, b: boxOf(e) };
      if (e.given !== undefined) o.given = e.given;
      if (e.exp) o.exp = e.exp;
      (chunks[Math.floor(e.n / 100)] || (chunks[Math.floor(e.n / 100)] = [])).push(o);
    });
    Object.entries(chunks).forEach(([c, list]) => {
      let body = { k: 'log', s: sub.s, dev: D, c: +c, e: list };
      // 1 文書は 256KiB まで。大きすぎるときは問題文を短くする
      if (JSON.stringify(body).length * 3 > 230000) body = Object.assign({}, body, { e: list.map((x) => { const y = Object.assign({}, x, { q: x.q.slice(0, 200) }); delete y.exp; return y; }) });
      docs[`${sub.s}_${D}_log${c}`] = body;
    });
    // 手書きの画像：新しいものから IMG_SYNC 件を、いくつかのまとまりに分ける
    const imgs = log.filter((e) => e.img).slice(-IMG_SYNC);
    let pack = {}, size = 0, pi = 0;
    const flush = () => { if (size) { docs[`${sub.s}_${D}_img${pi}`] = { k: 'img', s: sub.s, dev: D, i: pi, m: pack }; pi++; pack = {}; size = 0; } };
    imgs.forEach((e) => { if (size + e.img.length > PACK) flush(); pack[`n${e.n}`] = e.img; size += e.img.length; });
    flush();
    const days = {};
    Object.keys(raw.days || {}).sort().slice(-90).forEach((d) => { const v = raw.days[d]; days[d] = { n: v.n || 0, ok: v.ok || 0, cards: v.cards || 0 }; });
    docs[`${sub.s}_${D}_meta`] = { k: 'meta', s: sub.s, dev: D, logs: Object.keys(chunks).map(Number), imgs: pi, total: raw.log.length, days };
    return docs;
  }

  /* この端末の記録を保存する（変わった文書だけ書く） */
  async function upload(only) {
    const c = await ctx();
    if (c.err) return c;
    const D = device();
    const hashes = parse(ls.get(HASH_KEY)) || {};
    let wrote = 0;
    try {
      for (const sub of SUBJ) {
        if (only && only !== sub.s) continue;
        const raw = parse(ls.get(sub.key));
        if (!raw || !Array.isArray(raw.log)) continue;
        if (raw.log.some((e) => !e || !Number.isInteger(e.n))) continue; // 番号がまだない古い記録は、教科を一度開くと番号がつく
        const prefix = `${sub.s}_${D}_`;
        const had = Object.keys(hashes).some((k) => k.startsWith(prefix));
        if (!raw.log.length && !had) continue;
        const docs = build(sub, raw, D);
        for (const [name, body] of Object.entries(docs)) {
          const h = hash(JSON.stringify(body));
          if (hashes[name] === h) continue;
          await timeout(c.col.doc(name).set(Object.assign({ at: new Date().toISOString() }, body)), 20000);
          hashes[name] = h; wrote++;
        }
        for (const name of Object.keys(hashes)) {
          if (name.startsWith(prefix) && !docs[name]) { await timeout(c.col.doc(name).delete(), 20000); delete hashes[name]; }
        }
      }
    } catch (e) {
      ls.set(HASH_KEY, JSON.stringify(hashes));
      return errOf(e);
    }
    ls.set(HASH_KEY, JSON.stringify(hashes));
    ls.set(AT_KEY, new Date().toISOString());
    return { ok: true, wrote };
  }

  /* ほかの端末の記録を読みこんで、この端末に置く */
  async function download() {
    const c = await ctx();
    if (c.err) return c;
    const D = device();
    let all;
    try { all = (await timeout(c.col.get(), 20000)).docs.map((d) => d.data()).filter((x) => x && typeof x === 'object'); } catch (e) { return errOf(e); }
    const counts = {};
    SUBJ.forEach((sub) => {
      const mine = all.filter((x) => x.s === sub.s && typeof x.dev === 'string' && x.dev !== D);
      const metas = mine.filter((x) => x.k === 'meta');
      if (!metas.length) { ls.del(remoteKey(sub.s)); counts[sub.s] = 0; return; }
      const log = [], days = {};
      let at = '';
      metas.forEach((m) => {
        if (typeof m.at === 'string' && m.at > at) at = m.at;
        const imgs = {};
        mine.filter((x) => x.k === 'img' && x.dev === m.dev && x.i < (m.imgs || 0)).forEach((x) => Object.assign(imgs, x.m || {}));
        const want = new Set(Array.isArray(m.logs) ? m.logs : []);
        mine.filter((x) => x.k === 'log' && x.dev === m.dev && want.has(x.c)).forEach((x) => (Array.isArray(x.e) ? x.e : []).forEach((e) => {
          if (!e || typeof e !== 'object') return;
          const o = Object.assign({}, e);
          if (imgs[`n${e.n}`]) o.img = imgs[`n${e.n}`];
          log.push(o);
        }));
        Object.entries(m.days || {}).forEach(([d, v]) => {
          const t = days[d] || (days[d] = { n: 0, ok: 0, cards: 0 });
          t.n += (v && v.n) || 0; t.ok += (v && v.ok) || 0; t.cards += (v && v.cards) || 0;
        });
      });
      log.sort((a, b) => (`${a.d} ${a.t}` < `${b.d} ${b.t}` ? -1 : `${a.d} ${a.t}` > `${b.d} ${b.t}` ? 1 : (a.n || 0) - (b.n || 0)));
      const out = { at, fetched: new Date().toISOString(), devs: metas.length, log, days };
      if (!ls.set(remoteKey(sub.s), JSON.stringify(out))) {
        // 入りきらないときは、画像なしで置く
        out.log = log.map((e) => { const o = Object.assign({}, e); delete o.img; return o; });
        ls.set(remoteKey(sub.s), JSON.stringify(out));
      }
      counts[sub.s] = log.length;
    });
    return { ok: true, counts };
  }

  let running = null;
  function sync(only) {
    if (running) return running;
    running = (async () => {
      const u = await upload(only);
      if (u.err) return u;
      const d = await download();
      return d.err ? d : { ok: true, wrote: u.wrote, counts: d.counts };
    })();
    const done = () => { running = null; };
    running.then(done, done);
    return running;
  }

  const MESSAGES = {
    nohost: 'この開き方では同期できません（claude.ai の公開ページで開いたときだけ同期します）。',
    nodb: '同期できませんでした。claude.ai にログインした状態で、このページを開いてください。',
    nouser: '同期できませんでした。claude.ai にログインした状態で、このページを開いてください。',
    denied: 'このアカウントでは記録を保存できません。このページを作ったアカウントでログインしてください。',
    quota_exceeded: '保存場所がいっぱいです。',
    timeout: '通信に時間がかかっています。あとでもう一度ためしてください。',
  };
  const message = (r) => (r && r.err ? (MESSAGES[r.err] || '同期できませんでした。あとでもう一度ためしてください。') : '');

  g.TokaiSync = { SUBJ, sync, upload, download, message, remoteKey, available: () => !!(g.claude && typeof g.claude.use === 'function') };
})(typeof window !== 'undefined' ? window : globalThis);
