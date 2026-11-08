import * as srs from './srs.js';
import { db, getSetting, setSetting, saveImage, imageBlob, imageURL, deleteImages, uid } from './db.js';
import { normalizePhoto, cropImage, blobToDataURL, dataURLToBlob } from './image.js';
import { analyzeSheets, getApiKey, setApiKey, MODEL } from './ai.js';

// ---------------------------------------------------------------- 定数・状態
const REASONS = {
  careless: 'ケアレスミス',
  understand: '理解不足',
  memory: '暗記不足',
  time: '時間切れ・空欄',
  other: 'その他',
};

const DEFAULT_SUBJECTS = [
  { id: 'kokugo', name: '国語', color: '#c0392b', units: ['漢字', '語句・ことわざ', '文法', '説明文の読解', '物語文の読解', '記述'] },
  { id: 'sansu', name: '算数', color: '#1f6feb', units: ['計算', '数の性質', '割合と比', '速さ', '平面図形', '立体図形', '場合の数', '規則性', '特殊算（文章題）', 'グラフ・水量'] },
  { id: 'rika', name: '理科', color: '#138a72', units: ['植物', '動物・人体', '天体・気象', '地層・流水', '水溶液・気体', '燃焼・熱', '力・てこ・ばね', '電気・磁石', '光・音'] },
  { id: 'shakai', name: '社会', color: '#c05b12', units: ['日本の地理', '世界の地理', '歴史（古代〜中世）', '歴史（近世）', '歴史（近現代）', '政治・憲法', '経済・国際', '時事'] },
  { id: 'eigo', name: '英語', color: '#7a3fd1', units: ['単語', '文法', '長文読解', 'リスニング'] },
];

const S = {
  subjects: [],
  intervals: srs.DEFAULT_INTERVALS,
  pickGrid: { big: 5, small: 6 },
  problems: [],
  tests: [],
};

const app = document.getElementById('app');
// Claude のアーティファクトなど、ほかのページに埋めこまれて開いているか（その場合 AI 読み取りとファイルの書き出しは使えない）
const EMBEDDED = (() => { try { return window.self !== window.top; } catch { return true; } })();
let view = { name: 'home' };
let importState = null;
let session = null;

// ---------------------------------------------------------------- 小道具
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => srs.today();
const subjectOf = (id) => S.subjects.find((s) => s.id === id) || { id, name: id || '（教科なし）', color: '#888', units: [] };
const testOf = (id) => S.tests.find((t) => t.id === id);
const fmtDate = (d) => (d ? d.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日') : '');
const shortDate = (d) => (d ? d.replace(/^\d+-0?(\d+)-0?(\d+)$/, '$1/$2') : '');
const activeProblems = () => S.problems.filter((p) => !p.srs.mastered);
const dueProblems = (subjectId) =>
  S.problems
    .filter((p) => srs.isDue(p.srs, todayStr()) && (!subjectId || p.subject === subjectId))
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due) || a.addedOn.localeCompare(b.addedOn) || String(a.testId).localeCompare(String(b.testId)) || (a.label || '').localeCompare(b.label || '', 'ja', { numeric: true }));

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// ブラウザの alert / confirm / prompt の代わり（埋めこみ表示ではそれらが使えないため）
// 戻り値：OK なら true（input ありなら入力した文字列）、キャンセルなら null
function ask(message, { ok = 'OK', cancel = 'キャンセル', input = null, danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = document.getElementById('askDialog');
    dlg.innerHTML = `
      <form method="dialog" class="ask">
        <p>${esc(message)}</p>
        ${input != null ? `<input id="askInput" value="${esc(input)}" autocomplete="off">` : ''}
        <div class="row end">
          ${cancel ? `<button type="button" class="btn" data-ask="cancel">${esc(cancel)}</button>` : ''}
          <button class="btn ${danger ? 'danger-fill' : 'primary'}" value="ok">${esc(ok)}</button>
        </div>
      </form>`;
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input != null ? dlg.querySelector('#askInput').value : true;
      dlg.close();
      finish(v);
    });
    dlg.querySelector('[data-ask=cancel]')?.addEventListener('click', () => { dlg.close(); finish(null); });
    dlg.onclose = () => finish(cancel ? null : true);
    dlg.showModal();
    (dlg.querySelector('#askInput') || dlg.querySelector('[value=ok]')).focus();
  });
}

function chip(subjectId) {
  const s = subjectOf(subjectId);
  return `<span class="chip" style="--c:${esc(s.color)}">${esc(s.name)}</span>`;
}

function subjectOptions(selected) {
  return S.subjects.map((s) => `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

function unitOptions(subjectId, selected) {
  const units = [...subjectOf(subjectId).units];
  if (selected && !units.includes(selected)) units.unshift(selected);
  return `<option value="">（単元をえらぶ）</option>${units.map((u) => `<option ${u === selected ? 'selected' : ''}>${esc(u)}</option>`).join('')}<option value="__new">＋ 新しい単元…</option>`;
}

async function hydrateImages(root = app) {
  for (const img of root.querySelectorAll('img[data-img]')) {
    const url = await imageURL(img.dataset.img);
    if (url) img.src = url;
    else img.replaceWith(Object.assign(document.createElement('span'), { className: 'muted', textContent: '（画像なし）' }));
  }
}

async function go(name, params = {}) {
  if (view.name === 'import' && name !== 'import' && importState && importState.drafts.length && !importState.saved) {
    if (!(await ask('取りこみ中の内容は保存されていません。移動しますか？', { ok: '移動する', danger: true }))) return;
    importState = null;
  }
  view = { name, ...params };
  render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- 読みこみ・保存
async function load() {
  S.subjects = await getSetting('subjects', DEFAULT_SUBJECTS);
  S.intervals = await getSetting('intervals', srs.DEFAULT_INTERVALS);
  S.pickGrid = await getSetting('pickGrid', S.pickGrid);
  S.problems = await db.all('problems');
  S.tests = await db.all('tests');
}

async function saveProblem(p) {
  await db.put('problems', p);
  const i = S.problems.findIndex((x) => x.id === p.id);
  if (i >= 0) S.problems[i] = p;
  else S.problems.push(p);
}

async function addUnit(subjectId, unit) {
  const s = S.subjects.find((x) => x.id === subjectId);
  if (!s || !unit || s.units.includes(unit)) return;
  s.units.push(unit);
  await setSetting('subjects', S.subjects);
}

// ---------------------------------------------------------------- 描画
function render() {
  document.querySelectorAll('.tabbar [data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === view.name || (b.dataset.go === 'list' && view.name === 'detail')));
  const fn = { home: renderHome, import: renderImport, review: renderReview, list: renderList, detail: renderDetail, stats: renderStats, settings: renderSettings, edit: renderEdit }[view.name] || renderHome;
  fn();
  hydrateImages();
}

// ---- ホーム
function renderHome() {
  const t = todayStr();
  const due = dueProblems();
  const active = activeProblems();
  const mastered = S.problems.length - active.length;
  const bySubject = S.subjects.map((s) => ({ s, n: due.filter((p) => p.subject === s.id).length })).filter((x) => x.n);
  const week = [];
  for (let i = 1; i <= 7; i++) {
    const d = srs.addDays(t, i);
    week.push({ d, n: active.filter((p) => p.srs.due === d).length });
  }
  const maxWeek = Math.max(1, ...week.map((w) => w.n));

  if (!S.problems.length) {
    app.innerHTML = `
      <section class="card hero">
        <h1>解き直しノート</h1>
        <p>テストでまちがえた問題を写真で取りこみ、<b>忘れかけたころ</b>にもう一度解き直すためのノートです。</p>
        <ol class="steps">
          <li><b>取りこむ</b>：採点された解答用紙と問題用紙を写真にとる</li>
          <li><b>切り抜く</b>：まちがえた問題をかこんで、教科・単元をつける（AI で自動読み取りもできます）</li>
          <li><b>解き直す</b>：翌日 → 3日後 → 1週間後 → 2週間後 → 1か月後 → 2か月後 に出てきます</li>
        </ol>
        <button class="btn primary big" data-go="import">📷 テストを取りこむ</button>
      </section>`;
    return;
  }

  app.innerHTML = `
    <section class="card hero">
      <div class="due-count"><span class="num">${due.length}</span><span>問</span></div>
      <p class="muted">${due.length ? '今日解き直す問題があります' : '今日の解き直しはありません 🎉'}</p>
      ${due.length ? `<button class="btn primary big" data-act="startReview">▶ 解き直しをはじめる</button>` : ''}
      ${bySubject.length > 1 ? `<div class="row wrap center">${bySubject.map(({ s, n }) => `<button class="btn small" data-act="startReview" data-subject="${esc(s.id)}">${esc(s.name)}だけ（${n}）</button>`).join('')}</div>` : ''}
    </section>

    <section class="card">
      <h2>これから 1 週間の予定</h2>
      <div class="bars" role="list">
        ${week.map((w) => `<div class="bar" role="listitem" aria-label="${shortDate(w.d)} ${w.n}問"><span class="v">${w.n || ''}</span><span class="b" style="height:${(w.n / maxWeek) * 100}%"></span><span class="l">${shortDate(w.d)}</span></div>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2>ノートの中身</h2>
      <div class="stats3">
        <div><b>${S.problems.length}</b><span>登録した問題</span></div>
        <div><b>${active.length}</b><span>解き直し中</span></div>
        <div><b>${mastered}</b><span>卒業</span></div>
      </div>
      <div class="row wrap">
        <button class="btn" data-go="import">📷 テストを取りこむ</button>
        <button class="btn" data-go="list">📒 ノートを見る</button>
      </div>
    </section>`;
}

// ---- 取りこみ
function newImportState() {
  return { step: 1, title: '', date: todayStr(), subject: S.subjects[0]?.id || '', answer: [], question: [], drafts: [], aiNotes: '', busy: '', saved: false, grid: { ...S.pickGrid }, picked: new Set(), pickUnit: '' };
}

function renderImport() {
  if (!importState) importState = newImportState();
  const st = importState;
  const steps = ['テスト', '写真', 'まちがい'];
  const head = `<ol class="wizard">${steps.map((s, i) => `<li class="${st.step === i + 1 ? 'on' : st.step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</li>`).join('')}</ol>`;

  if (st.step === 1) {
    app.innerHTML = `${head}
      <section class="card form">
        <label>テストの名前<input data-imp="title" value="${esc(st.title)}" placeholder="例：第3回 合判模試"></label>
        <label>実施日<input type="date" data-imp="date" value="${esc(st.date)}"></label>
        <label>教科<select data-imp="subject">${subjectOptions(st.subject)}</select></label>
        <p class="muted small">教科ごとに取りこみます。4 教科のテストなら、教科ごとに 1 回ずつ取りこんでください。</p>
        <div class="row end"><button class="btn primary" data-act="impStep" data-step="2">次へ →</button></div>
      </section>`;
    return;
  }

  if (st.step === 2) {
    const pageList = (kind, label, hint) => `
      <section class="card">
        <h2>${label}</h2>
        <p class="muted small">${hint}</p>
        <div class="thumbs">
          ${st[kind].map((p, i) => `<figure><img src="${p.url}" alt="${label} ${i + 1}枚目"><figcaption>${i + 1}枚目 <button class="link" data-act="impRemovePage" data-kind="${kind}" data-i="${i}">削除</button></figcaption></figure>`).join('')}
        </div>
        <div class="row wrap photo-actions">
          <label class="btn primary">📷 撮影する<input type="file" accept="image/*" capture="environment" data-act-change="impAddPages" data-kind="${kind}" hidden></label>
          <label class="btn">🖼 写真を読み込む<input type="file" accept="image/*" multiple data-act-change="impAddPages" data-kind="${kind}" hidden></label>
        </div>
      </section>`;
    app.innerHTML = `${head}
      ${pageList('answer', '① 採点済みの解答用紙', '○×がついた解答用紙です。撮影するか、とってある写真を読み込んでください（何枚でも）。')}
      ${pageList('question', '② 問題用紙', 'まちがえた問題がのっているページだけで大丈夫です。')}
      ${st.busy ? `<p class="busy">${esc(st.busy)}</p>` : ''}
      ${st.answer.length || st.question.length ? '' : `<p class="muted small">問題用紙か解答用紙の写真を 1 枚以上入れると、次へ進めます。</p>`}
      <div class="row between">
        <button class="btn" data-act="impStep" data-step="1">← もどる</button>
        <button class="btn primary" data-act="impStep" data-step="3" ${st.answer.length || st.question.length ? '' : 'disabled'}>次へ →</button>
      </div>`;
    return;
  }

  // step 3
  const hasKey = !!getApiKey() && !EMBEDDED;
  app.innerHTML = `${head}
    ${pickPanel(st)}
    ${EMBEDDED ? '' : `
    <section class="card">
      <h2>AI で読み取る</h2>
      ${hasKey
        ? `<p class="muted small">番号をタップするかわりに、写真から × の問題を AI に見つけてもらうこともできます。</p>
           <button class="btn accent" data-act="impAnalyze" ${st.busy || !st.answer.length ? 'disabled' : ''}>✨ AI でまちがいを読み取る</button>`
        : `<p class="muted small">設定で API キーを入れると、写真から × の問題を AI で読み取れます。</p>`}
      ${st.busy ? `<p class="busy">${esc(st.busy)}</p>` : ''}
      ${st.aiNotes ? `<p class="note">AI のメモ：${esc(st.aiNotes)}</p>` : ''}
    </section>`}
    ${st.drafts.map((d, i) => draftCard(d, i)).join('')}
    <div class="row between">
      <button class="btn" data-act="impStep" data-step="2">← 写真にもどる</button>
      <button class="btn primary" data-act="impSave" ${st.drafts.length && !st.busy ? '' : 'disabled'}>✔ ${st.drafts.length} 問をノートに保存</button>
    </div>`;
}

function draftCard(d, i, { subject = importState?.subject, editing = false } = {}) {
  const attr = `data-draft="${i}"`;
  const crop = (kind, label) => {
    const c = d[kind];
    const img = c.url ? `<img src="${c.url}" alt="${label}">` : `<span class="muted small">まだ切り抜いていません</span>`;
    return `<div class="cropbox"><div class="cropprev">${img}</div><button class="btn small" data-act="cropDraft" data-kind="${kind}" ${attr}>✂ ${label}を切り抜く</button></div>`;
  };
  return `
    <section class="card draft">
      <div class="row between"><h3>${editing ? '問題の編集' : `問題 ${i + 1}`}</h3>${editing ? '' : `<button class="link danger" data-act="impRemoveDraft" ${attr}>この問題を消す</button>`}</div>
      <div class="grid2">
        <label>問題番号<input ${attr} data-f="label" value="${esc(d.label)}" placeholder="例：大問2 (3)"></label>
        <label>単元<select ${attr} data-f="unit">${unitOptions(subject, d.unit)}</select></label>
      </div>
      <fieldset class="reasons"><legend>まちがえた理由</legend>
        ${Object.entries(REASONS).map(([k, v]) => `<label class="pill"><input type="radio" name="reason-${i}" value="${k}" ${attr} data-f="reason" ${d.reason === k ? 'checked' : ''}>${v}</label>`).join('')}
      </fieldset>
      <details class="more" ${attr} ${d.open !== false || editing ? 'open' : ''}>
      <summary>写真の切り抜き・答え・メモ <span class="muted small">（あとからでも入れられます）</span></summary>
      <div class="crops">${crop('q', '問題')}${crop('a', '解答')}</div>
      <div class="grid2">
        <label>自分の答え<input ${attr} data-f="myAnswer" value="${esc(d.myAnswer)}"></label>
        <label>正しい答え<input ${attr} data-f="correctAnswer" value="${esc(d.correctAnswer)}"></label>
      </div>
      <label>問題のメモ（写真がないときは問題文を書く）<textarea ${attr} data-f="questionText" rows="2">${esc(d.questionText)}</textarea></label>
      <label>解き方のポイント・次に気をつけること<textarea ${attr} data-f="memo" rows="2">${esc(d.memo)}</textarea></label>
      </details>
    </section>`;
}

// ---- 問題番号の表から、まちがえた番号をタップで選ぶ
function gridLabels(grid) {
  const rows = [];
  for (let b = 1; b <= grid.big; b++) {
    if (grid.small >= 2) {
      const row = [];
      for (let k = 1; k <= grid.small; k++) row.push({ label: `大問${b} (${k})`, text: `(${k})` });
      rows.push({ head: `大問${b}`, items: row });
    } else {
      rows.push({ head: '', items: [{ label: `問${b}`, text: `${b}` }] });
    }
  }
  // 小問がないときは 1 行にまとめる
  return grid.small >= 2 ? rows : [{ head: '問', items: rows.flatMap((r) => r.items) }];
}

function pickPanel(st) {
  const added = new Set(st.drafts.map((d) => d.label));
  const n = [...st.picked].filter((l) => !added.has(l)).length;
  return `
    <section class="card pick">
      <h2>まちがえた番号をタップ</h2>
      <p class="muted small">× や減点の問題の番号をタップして、まとめて追加します。写真の切り抜きはあとからでもかまいません。</p>
      <div class="row wrap">
        <label class="inline">大問の数<input type="number" min="1" max="20" inputmode="numeric" id="gridBig" data-grid="big" value="${st.grid.big}"></label>
        <label class="inline">小問の数<input type="number" min="0" max="20" inputmode="numeric" id="gridSmall" data-grid="small" value="${st.grid.small}"></label>
      </div>
      <p class="muted small">小問がないテストは、小問の数を 0 にしてください（問1、問2… になります）。</p>
      <div class="pickgrid">
        ${gridLabels(st.grid).map((r) => `
          <div class="pickrow">${r.head ? `<span class="pickhead">${esc(r.head)}</span>` : ''}<div class="pickbtns">
            ${r.items.map((it) => added.has(it.label)
              ? `<button type="button" class="pickbtn added" disabled aria-label="${esc(it.label)}（追加ずみ）">${esc(it.text)}</button>`
              : `<button type="button" class="pickbtn ${st.picked.has(it.label) ? 'on' : ''}" data-act="pickToggle" data-label="${esc(it.label)}" aria-pressed="${st.picked.has(it.label)}" aria-label="${esc(it.label)}">${esc(it.text)}</button>`).join('')}
          </div></div>`).join('')}
      </div>
      <label class="inline">単元（まとめて）<select id="pickUnit" data-imp="pickUnit">${unitOptions(st.subject, st.pickUnit).replace('（単元をえらぶ）', '（あとで選ぶ）').replace('<option value="__new">＋ 新しい単元…</option>', '')}</select></label>
      <div class="row end"><button class="btn primary" data-act="pickAdd" ${n ? '' : 'disabled'}>選んだ ${n} 問を追加</button></div>
    </section>`;
}

function newDraft(extra = {}) {
  return { key: uid(), label: '', unit: '', reason: 'understand', myAnswer: '', correctAnswer: '', questionText: '', memo: '', q: { page: -1, box: null, url: null }, a: { page: -1, box: null, url: null }, ...extra };
}

async function refreshCropPreview(c, pages) {
  if (c.page < 0 || !pages[c.page]) { c.url = null; return; }
  if (c.url && c.url.startsWith('blob:') && c.ownUrl) URL.revokeObjectURL(c.url);
  const blob = await cropImage(pages[c.page].blob, c.box, 900);
  c.url = URL.createObjectURL(blob);
  c.ownUrl = true;
}

// ---- 切り抜きダイアログ
function openCropper({ title, pages, page, box }) {
  return new Promise((resolve) => {
    const dlg = document.getElementById('cropDialog');
    let cur = page >= 0 && pages[page] ? page : 0;
    let rect = box ? { ...box } : null;
    const draw = () => {
      dlg.innerHTML = `
        <form method="dialog" class="crop-ui">
          <div class="row between"><b>${esc(title)}</b><button class="link" value="cancel">✕ 閉じる</button></div>
          ${pages.length > 1 ? `<div class="row wrap">${pages.map((p, i) => `<button type="button" class="btn small ${i === cur ? 'primary' : ''}" data-page="${i}">${esc(p.label)}</button>`).join('')}</div>` : ''}
          <p class="muted small">指（マウス）でなぞって、問題をかこんでください。</p>
          <div class="crop-stage"><img src="${pages[cur].url}" alt="" draggable="false"><div class="crop-rect" hidden></div></div>
          <div class="row between">
            <button type="button" class="btn small" data-whole>ページ全体を使う</button>
            <button type="button" class="btn primary" data-ok>決定</button>
          </div>
        </form>`;
      const stage = dlg.querySelector('.crop-stage');
      const rectEl = dlg.querySelector('.crop-rect');
      const show = () => {
        if (!rect) { rectEl.hidden = true; return; }
        rectEl.hidden = false;
        Object.assign(rectEl.style, { left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' });
      };
      show();
      let start = null;
      const pos = (e) => {
        const r = stage.getBoundingClientRect();
        return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
      };
      let prev = null;
      stage.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        stage.setPointerCapture(e.pointerId);
        start = pos(e);
        prev = rect;
      });
      stage.addEventListener('pointermove', (e) => {
        if (!start) return;
        const p = pos(e);
        rect = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
        show();
      });
      const end = () => {
        if (!start) return;
        start = null;
        if (!rect || rect.w < 0.02 || rect.h < 0.02) rect = prev;
        show();
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      dlg.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { cur = Number(b.dataset.page); rect = null; draw(); }));
      dlg.querySelector('[data-whole]').addEventListener('click', () => { finish({ page: cur, box: null }); });
      dlg.querySelector('[data-ok]').addEventListener('click', () => { finish({ page: cur, box: rect }); });
    };
    const finish = (v) => { dlg.onclose = null; dlg.close(); resolve(v); };
    dlg.onclose = () => resolve(null);
    draw();
    dlg.showModal();
  });
}

function pagesForImport(kind) {
  const st = importState;
  const list = kind === 'q' ? st.question : st.answer;
  const name = kind === 'q' ? '問題用紙' : '解答用紙';
  return list.map((p, i) => ({ ...p, label: `${name} ${i + 1}枚目` }));
}

async function saveImport() {
  const st = importState;
  st.busy = '保存しています…';
  render();
  try {
    const test = { id: uid(), title: st.title || `${subjectOf(st.subject).name}のテスト`, date: st.date, subject: st.subject, answerPages: [], questionPages: [], createdAt: Date.now() };
    for (const p of st.answer) test.answerPages.push(await saveImage(p.blob));
    for (const p of st.question) test.questionPages.push(await saveImage(p.blob));
    const added = todayStr();
    const problems = [];
    for (const d of st.drafts) {
      const qPages = st.question;
      const aPages = st.answer;
      const p = {
        id: uid(), testId: test.id, subject: st.subject, unit: d.unit, label: d.label, reason: d.reason,
        myAnswer: d.myAnswer, correctAnswer: d.correctAnswer, questionText: d.questionText, memo: d.memo,
        questionImg: d.q.page >= 0 && qPages[d.q.page] ? await saveImage(await cropImage(qPages[d.q.page].blob, d.q.box)) : null,
        answerImg: d.a.page >= 0 && aPages[d.a.page] ? await saveImage(await cropImage(aPages[d.a.page].blob, d.a.box)) : null,
        crop: { q: { page: d.q.page, box: d.q.box }, a: { page: d.a.page, box: d.a.box } },
        addedOn: added,
        srs: srs.newSchedule(added, S.intervals),
      };
      problems.push(p);
      if (d.unit) await addUnit(st.subject, d.unit);
    }
    await db.put('tests', test);
    S.tests.push(test);
    await db.putMany('problems', problems);
    S.problems.push(...problems);
    st.saved = true;
    importState = null;
    toast(`${problems.length} 問をノートに保存しました。明日から解き直しに出てきます。`);
    go('list');
  } catch (err) {
    st.busy = '';
    render();
    await ask(`保存できませんでした：${err.message}`, { cancel: null });
  }
}

// 切り抜きがない問題：テストの紙を見るよう案内し、写真があればページごと開けるようにする
function noCropHint(p, t, kind) {
  const pages = (kind === 'q' ? t?.questionPages : t?.answerPages) || [];
  const name = kind === 'q' ? '問題用紙' : '解答用紙';
  const msg = kind === 'q'
    ? `<p class="paperhint">📄 ${esc(t?.title || 'テスト')} の<b>${esc(p.label || 'この問題')}</b>を、テストの紙を見て解いてください。</p>`
    : '';
  const btns = pages.map((id, i) => `<button class="btn small" data-act="zoom" data-id="${id}">${name} ${i + 1}枚目を見る</button>`).join('');
  return msg + (btns ? `<div class="row wrap">${btns}</div>` : '');
}

// ---- 解き直し
function startReview({ subject, ids, practice = false } = {}) {
  const list = ids ? ids.map((id) => S.problems.find((p) => p.id === id)).filter(Boolean) : dueProblems(subject);
  if (!list.length) { toast('解き直す問題はありません'); return; }
  session = { ids: list.map((p) => p.id), i: 0, revealed: false, practice, results: { again: 0, hard: 0, good: 0 } };
  go('review');
}

function renderReview() {
  if (!session) { go('home'); return; }
  if (session.i >= session.ids.length) {
    const r = session.results;
    app.innerHTML = `
      <section class="card hero">
        <h1>おつかれさま！</h1>
        <p>${session.ids.length} 問を解き直しました。</p>
        <div class="stats3"><div><b>${r.good}</b><span>○ 解けた</span></div><div><b>${r.hard}</b><span>△ あやしい</span></div><div><b>${r.again}</b><span>× 解けない</span></div></div>
        <p class="muted small">× の問題は明日また出てきます。ノートの「解き方のポイント」を見直しておきましょう。</p>
        <div class="row center wrap">
          ${dueProblems().length ? `<button class="btn primary" data-act="startReview">残りの解き直し（${dueProblems().length}）</button>` : ''}
          <button class="btn" data-go="home">ホームへ</button>
        </div>
      </section>`;
    session = null;
    return;
  }
  const p = S.problems.find((x) => x.id === session.ids[session.i]);
  if (!p) { session.i++; renderReview(); return; }
  const t = testOf(p.testId);
  const days = p.srs.lastReviewed ? srs.daysBetween(p.srs.lastReviewed, todayStr()) : srs.daysBetween(p.addedOn, todayStr());
  const btn = (k) => {
    const n = srs.previewInterval(p.srs, k, S.intervals);
    const due = srs.isDue(p.srs, todayStr());
    const sub = session.practice && !due && k !== 'again' ? '予定は変えない' : srs.intervalLabel(n);
    return `<button class="btn grade ${k}" data-act="grade" data-r="${k}"><b>${srs.RESULTS[k].label}</b><small>次は ${sub}</small></button>`;
  };
  app.innerHTML = `
    <div class="progress"><span style="width:${(session.i / session.ids.length) * 100}%"></span></div>
    <p class="muted small center">${session.i + 1} / ${session.ids.length} 問目 ${session.practice ? '（練習）' : ''}</p>
    <section class="card">
      <div class="row wrap">${chip(p.subject)}<span class="tag">${esc(p.unit || '単元なし')}</span><span class="tag">${esc(srs.stageLabel(p.srs, S.intervals))}</span></div>
      <h2>${esc(p.label || '問題')}</h2>
      <p class="muted small">${esc(t ? `${t.title}（${fmtDate(t.date)}）` : '')}・前に解いてから ${days} 日</p>
      ${p.questionImg ? `<button class="imgbtn" data-act="zoom" data-id="${p.questionImg}"><img data-img="${p.questionImg}" alt="問題"></button>` : noCropHint(p, t, 'q')}
      ${p.questionText ? `<p class="qtext">${esc(p.questionText)}</p>` : ''}
    </section>
    ${session.revealed ? `
      <section class="card answer">
        <h2>答え・ふり返り</h2>
        <dl class="kv">
          ${p.correctAnswer ? `<dt>正しい答え</dt><dd class="ok">${esc(p.correctAnswer)}</dd>` : ''}
          ${p.myAnswer ? `<dt>テストでの答え</dt><dd class="ng">${esc(p.myAnswer)}</dd>` : ''}
          <dt>まちがえた理由</dt><dd>${esc(REASONS[p.reason] || '')}</dd>
          ${p.memo ? `<dt>ポイント</dt><dd>${esc(p.memo)}</dd>` : ''}
        </dl>
        ${p.answerImg ? `<button class="imgbtn" data-act="zoom" data-id="${p.answerImg}"><img data-img="${p.answerImg}" alt="採点済みの解答"></button>` : noCropHint(p, t, 'a')}
      </section>
      <div class="grades">${btn('again')}${btn('hard')}${btn('good')}</div>
      <p class="muted small center">キーボード：1・2・3 で評価</p>`
    : `<p class="muted center">ノートに解いてから、答えを見ましょう。</p>
       <div class="row center"><button class="btn primary big" data-act="reveal">答えを見る（スペース）</button></div>`}
    <div class="row center"><button class="link" data-act="endReview">ここでやめる</button></div>`;
}

async function grade(result) {
  const p = S.problems.find((x) => x.id === session.ids[session.i]);
  const t = todayStr();
  let next;
  if (session.practice && !srs.isDue(p.srs, t) && result !== 'again') {
    next = { ...p.srs, history: [...p.srs.history, { date: t, result, stage: p.srs.stage, practice: true }] };
  } else {
    next = srs.review(p.srs, result, t, S.intervals);
  }
  await saveProblem({ ...p, srs: next });
  session.results[result]++;
  session.i++;
  session.revealed = false;
  if (next.mastered) toast('🎓 卒業！この問題はもう大丈夫です');
  render();
  window.scrollTo(0, 0);
}

// ---- ノート（一覧）
function renderList() {
  const f = view.filter || (view.filter = { subject: '', state: 'active', unit: '' });
  const t = todayStr();
  let list = S.problems.filter((p) => (!f.subject || p.subject === f.subject) && (!f.unit || p.unit === f.unit));
  if (f.state === 'active') list = list.filter((p) => !p.srs.mastered);
  if (f.state === 'due') list = list.filter((p) => srs.isDue(p.srs, t));
  if (f.state === 'mastered') list = list.filter((p) => p.srs.mastered);
  list.sort((a, b) => (testOf(b.testId)?.date || '').localeCompare(testOf(a.testId)?.date || '') || (a.label || '').localeCompare(b.label || '', 'ja', { numeric: true }));
  const groups = new Map();
  for (const p of list) {
    const k = `${p.subject}\u0000${p.unit || '単元なし'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const [sa] = a.split('\u0000');
    const [sb] = b.split('\u0000');
    const ia = S.subjects.findIndex((s) => s.id === sa);
    const ib = S.subjects.findIndex((s) => s.id === sb);
    return ia - ib || groups.get(b).length - groups.get(a).length;
  });
  const units = f.subject ? [...new Set(S.problems.filter((p) => p.subject === f.subject).map((p) => p.unit || '単元なし'))] : [];
  app.innerHTML = `
    <section class="card filters">
      <div class="row wrap">
        <button class="btn small ${!f.subject ? 'primary' : ''}" data-act="filter" data-k="subject" data-v="">すべて</button>
        ${S.subjects.map((s) => `<button class="btn small ${f.subject === s.id ? 'primary' : ''}" data-act="filter" data-k="subject" data-v="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
      </div>
      ${units.length > 1 ? `<label class="inline">単元<select data-act-change="filterUnit"><option value="">すべて</option>${units.map((u) => `<option ${u === f.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>` : ''}
      <div class="seg">
        ${[['active', '解き直し中'], ['due', '今日やる'], ['mastered', '卒業'], ['all', 'すべて']].map(([k, v]) => `<button class="${f.state === k ? 'on' : ''}" data-act="filter" data-k="state" data-v="${k}">${v}</button>`).join('')}
      </div>
    </section>
    ${keys.length ? '' : `<p class="muted center">問題がありません。</p>`}
    ${keys.map((k) => {
      const items = groups.get(k);
      const [sub, unit] = k.split('\u0000');
      return `
        <section class="card group">
          <div class="row between">
            <h2>${chip(sub)} ${esc(unit)} <span class="muted">${items.length}問</span></h2>
            ${f.state !== 'mastered' ? `<button class="btn small" data-act="practiceGroup" data-ids="${items.map((p) => p.id).join(',')}">まとめて解く</button>` : ''}
          </div>
          <ul class="plist">
            ${items.map((p) => `
              <li><button data-act="open" data-id="${p.id}">
                ${p.questionImg ? `<img data-img="${p.questionImg}" alt="">` : `<span class="noimg">📝</span>`}
                <span class="pmain"><b>${esc(p.label || p.questionText || '問題')}</b><small>${esc(testOf(p.testId)?.title || '')}</small></span>
                <span class="due ${srs.isDue(p.srs, t) ? 'now' : ''}">${esc(srs.dueLabel(p.srs, t))}</span>
              </button></li>`).join('')}
          </ul>
        </section>`;
    }).join('')}`;
}

// ---- 問題の詳細
function curveSVG(p) {
  const pts = srs.curvePoints(p.srs, p.addedOn, todayStr(), S.intervals);
  if (pts.length < 2) return '';
  const W = 320, H = 120, pad = 22;
  const maxDay = Math.max(1, pts[pts.length - 1].day);
  const X = (d) => pad + (d / maxDay) * (W - pad - 6);
  const Y = (r) => 6 + (1 - r) * (H - pad - 6);
  const todayX = X(srs.daysBetween(p.addedOn, todayStr()));
  const path = pts.map((q, i) => `${i ? 'L' : 'M'}${X(q.day).toFixed(1)},${Y(q.r).toFixed(1)}`).join('');
  const marks = pts.filter((q) => q.event).map((q) => `<circle cx="${X(q.day)}" cy="${Y(1)}" r="4" class="ev ${q.event}"/>`).join('');
  return `
    <figure class="curve">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="記憶の残り具合の目安のグラフ">
        <line x1="${pad}" y1="${Y(0.7)}" x2="${W - 6}" y2="${Y(0.7)}" class="guide"/>
        <text x="2" y="${Y(1) + 4}" class="ax">100%</text><text x="2" y="${Y(0.7) + 4}" class="ax">70%</text>
        <line x1="${todayX}" y1="4" x2="${todayX}" y2="${H - pad}" class="today"/>
        <text x="${todayX}" y="${H - 6}" class="ax" text-anchor="middle">今日</text>
        <path d="${path}" class="line"/>
        ${marks}
      </svg>
      <figcaption class="muted small">忘却曲線の目安。記憶が 70% くらいまで下がるころに解き直すと、のびる間隔で定着します。</figcaption>
    </figure>`;
}

function renderDetail() {
  const p = S.problems.find((x) => x.id === view.id);
  if (!p) { go('list'); return; }
  const t = testOf(p.testId);
  const today = todayStr();
  const ret = Math.round(srs.retention(p.srs, today, S.intervals) * 100);
  app.innerHTML = `
    <div class="row"><button class="link" data-go="list">← ノートへ</button></div>
    <section class="card">
      <div class="row wrap">${chip(p.subject)}<span class="tag">${esc(p.unit || '単元なし')}</span><span class="tag">${esc(REASONS[p.reason] || '')}</span></div>
      <h1>${esc(p.label || '問題')}</h1>
      <p class="muted small">${esc(t ? `${t.title}（${fmtDate(t.date)}）` : '')}</p>
      ${p.questionImg ? `<button class="imgbtn" data-act="zoom" data-id="${p.questionImg}"><img data-img="${p.questionImg}" alt="問題"></button>` : noCropHint(p, t, 'q')}
      ${p.questionText ? `<p class="qtext">${esc(p.questionText)}</p>` : ''}
      <details><summary>答えを見る</summary>
        <dl class="kv">
          ${p.correctAnswer ? `<dt>正しい答え</dt><dd class="ok">${esc(p.correctAnswer)}</dd>` : ''}
          ${p.myAnswer ? `<dt>テストでの答え</dt><dd class="ng">${esc(p.myAnswer)}</dd>` : ''}
          ${p.memo ? `<dt>ポイント</dt><dd>${esc(p.memo)}</dd>` : ''}
        </dl>
        ${p.answerImg ? `<button class="imgbtn" data-act="zoom" data-id="${p.answerImg}"><img data-img="${p.answerImg}" alt="採点済みの解答"></button>` : noCropHint(p, t, 'a')}
      </details>
    </section>
    <section class="card">
      <h2>復習の予定</h2>
      <dl class="kv">
        <dt>次の解き直し</dt><dd>${p.srs.mastered ? '🎓 卒業しました' : `${fmtDate(p.srs.due)}（${esc(srs.dueLabel(p.srs, today))}）`}</dd>
        <dt>段階</dt><dd>${esc(srs.stageLabel(p.srs, S.intervals))}（間隔：${S.intervals.map(srs.intervalLabel).join(' → ').replace(/明日/, '1日後')}）</dd>
        <dt>記憶の目安</dt><dd>${ret}%</dd>
        <dt>解けなかった回数</dt><dd>${p.srs.lapses || 0} 回</dd>
      </dl>
      ${curveSVG(p)}
      ${p.srs.history.length ? `<h3>これまでの記録</h3><ul class="hist">${p.srs.history.map((h) => `<li>${shortDate(h.date)}　${srs.RESULTS[h.result].short}${h.practice ? '（練習）' : ''}</li>`).join('')}</ul>` : ''}
    </section>
    <div class="row wrap center">
      <button class="btn primary" data-act="practiceOne" data-id="${p.id}">今すぐ解く</button>
      <button class="btn" data-act="edit" data-id="${p.id}">編集</button>
      ${p.srs.mastered ? `<button class="btn" data-act="revive" data-id="${p.id}">もう一度復習する</button>` : `<button class="btn" data-act="graduate" data-id="${p.id}">卒業させる</button>`}
      <button class="btn danger" data-act="deleteProblem" data-id="${p.id}">削除</button>
    </div>`;
}

// ---- 編集
async function prepareEdit(id) {
  const p = S.problems.find((x) => x.id === id);
  const t = testOf(p.testId);
  const loadPages = async (ids, name) => {
    const out = [];
    for (let i = 0; i < (ids || []).length; i++) {
      const blob = await imageBlob(ids[i]);
      if (blob) out.push({ blob, url: await imageURL(ids[i]), label: `${name} ${i + 1}枚目` });
    }
    return out;
  };
  const pages = { q: await loadPages(t?.questionPages, '問題用紙'), a: await loadPages(t?.answerPages, '解答用紙') };
  const d = newDraft({
    label: p.label, unit: p.unit, reason: p.reason, myAnswer: p.myAnswer, correctAnswer: p.correctAnswer, questionText: p.questionText, memo: p.memo,
    q: { page: p.crop?.q?.page ?? -1, box: p.crop?.q?.box ?? null, url: p.questionImg ? await imageURL(p.questionImg) : null, changed: false },
    a: { page: p.crop?.a?.page ?? -1, box: p.crop?.a?.box ?? null, url: p.answerImg ? await imageURL(p.answerImg) : null, changed: false },
  });
  view = { name: 'edit', id, draft: d, pages, subject: p.subject };
  render();
}

function renderEdit() {
  const p = S.problems.find((x) => x.id === view.id);
  if (!p || !view.draft) { go('list'); return; }
  app.innerHTML = `
    <div class="row"><button class="link" data-act="open" data-id="${p.id}">← もどる</button></div>
    <section class="card form"><label>教科<select data-act-change="editSubject">${subjectOptions(view.subject)}</select></label></section>
    ${draftCard(view.draft, 0, { subject: view.subject, editing: true })}
    ${view.pages.q.length || view.pages.a.length ? '' : `<p class="muted small">このテストの写真がないため、切り抜きはやり直せません。</p>`}
    <div class="row end"><button class="btn primary" data-act="saveEdit">保存</button></div>`;
}

async function saveEdit() {
  const p = S.problems.find((x) => x.id === view.id);
  const d = view.draft;
  const next = { ...p, subject: view.subject, label: d.label, unit: d.unit, reason: d.reason, myAnswer: d.myAnswer, correctAnswer: d.correctAnswer, questionText: d.questionText, memo: d.memo, crop: { q: { page: d.q.page, box: d.q.box }, a: { page: d.a.page, box: d.a.box } } };
  const old = [];
  for (const [kind, field] of [['q', 'questionImg'], ['a', 'answerImg']]) {
    const c = d[kind];
    if (!c.changed) continue;
    const page = view.pages[kind][c.page];
    if (!page) continue;
    if (p[field]) old.push(p[field]);
    next[field] = await saveImage(await cropImage(page.blob, c.box));
  }
  await saveProblem(next);
  await deleteImages(old);
  if (d.unit) await addUnit(view.subject, d.unit);
  toast('保存しました');
  go('detail', { id: p.id });
}

// ---- 記録
function renderStats() {
  const t = todayStr();
  const active = activeProblems();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = srs.addDays(t, i);
    days.push({ d, n: active.filter((p) => (i === 0 ? p.srs.due <= d : p.srs.due === d)).length });
  }
  const maxDay = Math.max(1, ...days.map((x) => x.n));
  const reasonCount = Object.keys(REASONS).map((k) => ({ k, n: S.problems.filter((p) => p.reason === k).length }));
  const maxReason = Math.max(1, ...reasonCount.map((x) => x.n));
  const reviews = S.problems.flatMap((p) => p.srs.history);
  const last30 = reviews.filter((h) => srs.daysBetween(h.date, t) < 30);
  const goodRate = last30.length ? Math.round((last30.filter((h) => h.result === 'good').length / last30.length) * 100) : null;

  const subjectRows = S.subjects.map((s) => {
    const ps = S.problems.filter((p) => p.subject === s.id);
    if (!ps.length) return '';
    const units = new Map();
    for (const p of ps) {
      const u = p.unit || '単元なし';
      const e = units.get(u) || { n: 0, lapses: 0, mastered: 0 };
      e.n++; e.lapses += p.srs.lapses || 0; if (p.srs.mastered) e.mastered++;
      units.set(u, e);
    }
    const ranked = [...units.entries()].sort((a, b) => (b[1].n - b[1].mastered + b[1].lapses) - (a[1].n - a[1].mastered + a[1].lapses));
    const max = Math.max(1, ...ranked.map(([, e]) => e.n));
    return `
      <section class="card">
        <h2>${chip(s.id)} 単元ごとのまちがい</h2>
        <p class="muted small">${ps.length} 問登録・${ps.filter((p) => p.srs.mastered).length} 問卒業。上ほど「にがて」（残っている問題とくり返しまちがえた回数が多い）です。</p>
        <table class="utable">
          <thead><tr><th>単元</th><th>問題数</th><th>くり返し×</th></tr></thead>
          <tbody>${ranked.map(([u, e]) => `
            <tr><th scope="row"><button class="link" data-act="openUnit" data-s="${esc(s.id)}" data-u="${esc(u)}">${esc(u)}</button></th>
              <td><span class="hbar"><span class="m" style="width:${(e.mastered / max) * 100}%"></span><span class="r" style="width:${((e.n - e.mastered) / max) * 100}%"></span></span>${e.n}</td>
              <td>${e.lapses}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>`;
  }).join('');

  app.innerHTML = `
    <section class="card">
      <h2>全体</h2>
      <div class="stats3">
        <div><b>${S.problems.length}</b><span>登録</span></div>
        <div><b>${reviews.length}</b><span>解き直した回数</span></div>
        <div><b>${goodRate == null ? '—' : goodRate + '%'}</b><span>直近30日の ○ の割合</span></div>
      </div>
    </section>
    <section class="card">
      <h2>これから 2 週間の解き直し</h2>
      <div class="bars wide" role="list">
        ${days.map((x, i) => `<div class="bar" role="listitem" aria-label="${i ? shortDate(x.d) : '今日まで'} ${x.n}問"><span class="v">${x.n || ''}</span><span class="b" style="height:${(x.n / maxDay) * 100}%"></span><span class="l">${i ? shortDate(x.d) : '今日'}</span></div>`).join('')}
      </div>
    </section>
    <section class="card">
      <h2>まちがえた理由</h2>
      <ul class="hlist">${reasonCount.map((x) => `<li><span>${REASONS[x.k]}</span><span class="hbar"><span class="r" style="width:${(x.n / maxReason) * 100}%"></span></span><b>${x.n}</b></li>`).join('')}</ul>
    </section>
    ${subjectRows || '<p class="muted center">まだ問題がありません。</p>'}`;
}

// ---- 設定
function renderSettings() {
  const key = getApiKey();
  app.innerHTML = `
    <section class="card form">
      <h2>教科と単元</h2>
      <p class="muted small">単元は 1 行に 1 つ書きます。取りこみのときに選べるようになります。</p>
      ${S.subjects.map((s, i) => `
        <details><summary>${chip(s.id)} ${s.units.length} 単元</summary>
          <label>教科の名前<input data-subj="${i}" data-sf="name" value="${esc(s.name)}"></label>
          <label>単元<textarea data-subj="${i}" data-sf="units" rows="6">${esc(s.units.join('\n'))}</textarea></label>
        </details>`).join('')}
      <div class="row between"><button class="btn small" data-act="addSubject">＋ 教科を追加</button><button class="btn primary small" data-act="saveSubjects">教科と単元を保存</button></div>
    </section>

    <section class="card form">
      <h2>復習の間隔</h2>
      <p class="muted small">○（自力で解けた）のたびに、次の日数あとに出てきます。最後まで ○ なら卒業です。× なら最初にもどり、△ ならその段階の半分の日数あとにもう一度出ます。</p>
      <label>日数（カンマ区切り）<input id="intervals" value="${esc(S.intervals.join(', '))}" inputmode="numeric"></label>
      <div class="row end"><button class="btn small" data-act="resetIntervals">元にもどす</button><button class="btn primary small" data-act="saveIntervals">保存</button></div>
    </section>

    <section class="card form">
      <h2>AI で読み取り（任意）</h2>
      <p class="muted small">Claude（${esc(MODEL)}）が、採点済みの解答用紙から ×・減点の問題を見つけ、問題番号・答え・位置を下書きします。
      使うには Anthropic の API キーが必要です（<a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> で作成、利用料がかかります）。</p>
      <p class="note small">キーはこの端末のブラウザにだけ保存され、写真といっしょに Anthropic にだけ送られます。家族で共有する端末や、他の人が使うパソコンには入れないでください。</p>
      ${EMBEDDED ? `<p class="note small">いまの表示（ほかのページに埋めこまれた表示）では、AI の読み取りは使えません。GitHub Pages などで直接開いたときに使えます。</p>` : ''}
      <label>API キー<input id="apiKey" type="password" autocomplete="off" value="${esc(key)}" placeholder="sk-ant-..."></label>
      <div class="row end">${key ? `<button class="btn small danger" data-act="clearKey">キーを消す</button>` : ''}<button class="btn primary small" data-act="saveKey">保存</button></div>
    </section>

    <section class="card form">
      <h2>バックアップ</h2>
      <p class="muted small">記録と写真はこの端末のブラウザにだけ保存されています。機種変更のときや、ときどき書き出しておくと安心です。</p>
      ${EMBEDDED ? `<p class="note small">いまの表示ではファイルを書き出せません。書き出すときは GitHub Pages などで直接開いてください（読みこみはできます）。</p>` : ''}
      <div class="row wrap">
        ${EMBEDDED ? '' : `<button class="btn" data-act="export">⬇ 書き出す</button>`}
        <label class="btn">⬆ 読みこむ<input type="file" accept="application/json,.json" data-act-change="importBackup" hidden></label>
        <button class="btn danger" data-act="wipe">すべて削除</button>
      </div>
    </section>`;
}

async function exportBackup() {
  toast('書き出しの準備をしています…');
  const images = [];
  for (const row of await db.all('images')) images.push({ id: row.id, data: await blobToDataURL(row.blob) });
  const data = { app: 'tokinaoshi-note', version: 1, exportedAt: new Date().toISOString(), subjects: S.subjects, intervals: S.intervals, tests: S.tests, problems: S.problems, images };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `解き直しノート_${todayStr()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { await ask('ファイルを読めませんでした', { cancel: null }); return; }
  if (data.app !== 'tokinaoshi-note') { await ask('解き直しノートのバックアップではありません', { cancel: null }); return; }
  if (!(await ask(`問題 ${data.problems.length} 問を読みこみます。同じ問題は上書きされます。`, { ok: '読みこむ' }))) return;
  for (const im of data.images || []) await db.put('images', { id: im.id, blob: await dataURLToBlob(im.data), type: 'image/jpeg' });
  await db.putMany('tests', data.tests || []);
  await db.putMany('problems', data.problems || []);
  if (data.subjects) await setSetting('subjects', data.subjects);
  if (data.intervals) await setSetting('intervals', data.intervals);
  await load();
  toast('読みこみました');
  go('home');
}

// ---------------------------------------------------------------- イベント
const actions = {
  startReview: (el) => startReview({ subject: el.dataset.subject }),
  reveal: () => { session.revealed = true; render(); },
  grade: (el) => grade(el.dataset.r),
  endReview: () => { session = null; go('home'); },
  practiceGroup: (el) => startReview({ ids: el.dataset.ids.split(','), practice: true }),
  practiceOne: (el) => startReview({ ids: [el.dataset.id], practice: true }),
  open: (el) => go('detail', { id: el.dataset.id }),
  openUnit: (el) => { go('list'); view.filter = { subject: el.dataset.s, unit: el.dataset.u, state: 'all' }; render(); },
  edit: (el) => prepareEdit(el.dataset.id),
  saveEdit,
  filter: (el) => { view.filter[el.dataset.k] = el.dataset.v; if (el.dataset.k === 'subject') view.filter.unit = ''; render(); },
  zoom: async (el) => {
    const dlg = document.getElementById('zoomDialog');
    dlg.innerHTML = `<form method="dialog"><button class="link close">✕ 閉じる</button><img src="${await imageURL(el.dataset.id)}" alt=""></form>`;
    dlg.showModal();
  },
  async revive(el) {
    const p = S.problems.find((x) => x.id === el.dataset.id);
    await saveProblem({ ...p, srs: srs.revive(p.srs, todayStr(), S.intervals) });
    toast('明日から、また解き直しに出てきます');
    render();
  },
  async graduate(el) {
    if (!(await ask('この問題を卒業させますか？（解き直しに出てこなくなります）', { ok: '卒業させる' }))) return;
    const p = S.problems.find((x) => x.id === el.dataset.id);
    await saveProblem({ ...p, srs: { ...p.srs, mastered: true, due: null } });
    render();
  },
  async deleteProblem(el) {
    if (!(await ask('この問題を削除しますか？', { ok: '削除する', danger: true }))) return;
    const p = S.problems.find((x) => x.id === el.dataset.id);
    await db.delete('problems', p.id);
    await deleteImages([p.questionImg, p.answerImg]);
    S.problems = S.problems.filter((x) => x.id !== p.id);
    toast('削除しました');
    go('list');
  },

  // 取りこみ
  impStep: (el) => { importState.step = Number(el.dataset.step); render(); window.scrollTo(0, 0); },
  impRemovePage: (el) => {
    const list = importState[el.dataset.kind];
    const [removed] = list.splice(Number(el.dataset.i), 1);
    URL.revokeObjectURL(removed.url);
    const kind = el.dataset.kind === 'question' ? 'q' : 'a';
    for (const d of importState.drafts) if (d[kind].page >= list.length) { d[kind].page = -1; d[kind].url = null; }
    render();
  },
  pickToggle: (el) => {
    const st = importState;
    const l = el.dataset.label;
    if (st.picked.has(l)) st.picked.delete(l); else st.picked.add(l);
    el.classList.toggle('on', st.picked.has(l));
    el.setAttribute('aria-pressed', st.picked.has(l));
    const added = new Set(st.drafts.map((d) => d.label));
    const n = [...st.picked].filter((x) => !added.has(x)).length;
    const btn = app.querySelector('[data-act=pickAdd]');
    btn.textContent = `選んだ ${n} 問を追加`;
    btn.disabled = !n;
  },
  pickAdd: () => {
    const st = importState;
    const added = new Set(st.drafts.map((d) => d.label));
    // 表の順番どおりに追加する
    const order = gridLabels(st.grid).flatMap((r) => r.items.map((it) => it.label));
    const labels = order.filter((l) => st.picked.has(l) && !added.has(l));
    for (const l of labels) st.drafts.push(newDraft({ label: l, unit: st.pickUnit, open: false }));
    st.picked.clear();
    render();
    toast(`${labels.length} 問を追加しました。単元と理由をえらんで保存してください。`);
  },
  impRemoveDraft: (el) => { importState.drafts.splice(Number(el.dataset.draft), 1); render(); },
  impSave: () => saveImport(),
  async impAnalyze() {
    const st = importState;
    const setBusy = (m) => { st.busy = m; const b = app.querySelector('.busy'); if (b) b.textContent = m; else render(); };
    setBusy('準備しています…');
    try {
      const res = await analyzeSheets({
        subject: subjectOf(st.subject).name, title: st.title, units: subjectOf(st.subject).units,
        answerPages: st.answer.map((p) => p.blob), questionPages: st.question.map((p) => p.blob), onProgress: setBusy,
      });
      const drafts = res.problems.map((r) => newDraft({
        label: r.label, unit: r.unit, reason: r.reason, myAnswer: r.myAnswer, correctAnswer: r.correctAnswer, questionText: r.questionText,
        q: { page: r.questionPage, box: r.questionBox, url: null }, a: { page: r.answerPage, box: r.answerBox, url: null },
      }));
      for (const d of drafts) {
        await refreshCropPreview(d.q, st.question);
        await refreshCropPreview(d.a, st.answer);
      }
      st.drafts.push(...drafts);
      st.aiNotes = res.notes;
      st.busy = '';
      toast(drafts.length ? `${drafts.length} 問見つかりました。切り抜きの位置と内容を確かめてください。` : 'まちがえた問題は見つかりませんでした');
    } catch (err) {
      st.busy = '';
      await ask(err.message, { cancel: null });
    }
    render();
  },
  async cropDraft(el) {
    const kind = el.dataset.kind;
    const editing = view.name === 'edit';
    const d = editing ? view.draft : importState.drafts[Number(el.dataset.draft)];
    const pages = editing ? view.pages[kind] : pagesForImport(kind);
    if (!pages.length) { await ask(kind === 'q' ? '問題用紙の写真がありません。' : '解答用紙の写真がありません。', { cancel: null }); return; }
    const res = await openCropper({ title: kind === 'q' ? '問題をかこむ' : '解答（採点のあと）をかこむ', pages, page: d[kind].page, box: d[kind].box });
    if (!res) return;
    d[kind].page = res.page;
    d[kind].box = res.box;
    d[kind].changed = true;
    await refreshCropPreview(d[kind], pages);
    render();
  },

  // 設定
  async addSubject() {
    const name = (await ask('教科の名前', { input: '', ok: '追加' }))?.trim();
    if (!name) return;
    S.subjects.push({ id: uid(), name, color: ['#5b6b8c', '#a33ea1', '#2d7d46', '#9c6b1e'][S.subjects.length % 4], units: [] });
    setSetting('subjects', S.subjects).then(render);
  },
  async saveSubjects() {
    app.querySelectorAll('[data-subj]').forEach((el) => {
      const s = S.subjects[Number(el.dataset.subj)];
      if (el.dataset.sf === 'name') s.name = el.value.trim() || s.name;
      else s.units = [...new Set(el.value.split('\n').map((u) => u.trim()).filter(Boolean))];
    });
    await setSetting('subjects', S.subjects);
    toast('保存しました');
    render();
  },
  async saveIntervals() {
    const list = srs.parseIntervals(document.getElementById('intervals').value);
    if (!list) { await ask('1 以上の日数を、小さい順にカンマで区切って入れてください', { cancel: null }); return; }
    S.intervals = list;
    await setSetting('intervals', list);
    toast('保存しました（次の解き直しから使われます）');
    render();
  },
  async resetIntervals() {
    S.intervals = srs.DEFAULT_INTERVALS;
    await setSetting('intervals', S.intervals);
    render();
  },
  saveKey: () => { setApiKey(document.getElementById('apiKey').value.trim()); toast('保存しました'); render(); },
  clearKey: () => { setApiKey(''); render(); },
  export: exportBackup,
  async wipe() {
    if (!(await ask('すべての問題・写真・設定を削除します。元にもどせません。', { ok: 'すべて削除', danger: true }))) return;
    for (const s of ['problems', 'tests', 'images', 'kv']) await db.clear(s);
    await load();
    go('home');
  },
};

const changeActions = {
  async impAddPages(el) {
    const st = importState;
    const files = [...el.files];
    st.busy = `写真を読みこんでいます…（${files.length} 枚）`;
    render();
    for (const f of files) {
      try {
        const blob = await normalizePhoto(f);
        st[el.dataset.kind].push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        toast(`${f.name} を読みこめませんでした`);
      }
    }
    st.busy = '';
    render();
  },
  filterUnit: (el) => { view.filter.unit = el.value; render(); },
  editSubject: (el) => { view.subject = el.value; view.draft.unit = ''; render(); },
  importBackup: (el) => el.files[0] && importBackup(el.files[0]),
};

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act] && !a.disabled) { e.preventDefault(); actions[a.dataset.act](a); }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.actChange && changeActions[el.dataset.actChange]) { changeActions[el.dataset.actChange](el); return; }
  if (el.dataset.f === 'unit' && el.value === '__new') {
    const name = (await ask('新しい単元の名前', { input: '', ok: '追加' }))?.trim();
    const d = draftFor(el);
    if (name) {
      d.unit = name;
      await addUnit(view.name === 'edit' ? view.subject : importState.subject, name);
    }
    render();
    return;
  }
  handleField(el);
});
document.addEventListener('input', (e) => handleField(e.target));
// 番号の表の大きさを変えたら表を作り直す（入力中ではなく確定したとき）
document.addEventListener('change', (e) => { if (e.target.dataset.grid && view.name === 'import') render(); });
// 下書きの「くわしく」の開け閉めを覚えておく
document.addEventListener('toggle', (e) => {
  const el = e.target;
  if (el.matches?.('details.more[data-draft]') && view.name === 'import') {
    const d = importState?.drafts[Number(el.dataset.draft)];
    if (d) d.open = el.open;
  }
}, true);

function draftFor(el) {
  return view.name === 'edit' ? view.draft : importState?.drafts[Number(el.dataset.draft)];
}

function handleField(el) {
  if (el.dataset.grid && importState) {
    const v = Math.min(20, Math.max(el.dataset.grid === 'big' ? 1 : 0, Math.round(Number(el.value)) || 0));
    if (el.type === 'number' && el.value === '') return;
    importState.grid[el.dataset.grid] = v;
    S.pickGrid = { ...importState.grid };
    setSetting('pickGrid', S.pickGrid);
    return;
  }
  if (el.dataset.imp && importState) { importState[el.dataset.imp] = el.value; return; }
  if (el.dataset.f && el.dataset.draft != null) {
    const d = draftFor(el);
    if (!d) return;
    if (el.type === 'radio') { if (el.checked) d.reason = el.value; } else if (el.value !== '__new') d[el.dataset.f] = el.value;
  }
}

document.addEventListener('keydown', (e) => {
  if (view.name !== 'review' || !session || e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
  if (e.key === ' ' && !session.revealed) { e.preventDefault(); actions.reveal(); }
  else if (session.revealed && ['1', '2', '3'].includes(e.key)) grade({ 1: 'again', 2: 'hard', 3: 'good' }[e.key]);
});

// ---------------------------------------------------------------- 起動
(async function boot() {
  try {
    await load();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch (err) {
    app.innerHTML = `<section class="card"><p>データを読みこめませんでした（${esc(err.message)}）。プライベートブラウズでは使えないことがあります。</p></section>`;
    return;
  }
  render();
})();
