/* 小さなグラフ部品（SVG / HTML）。ライブラリなし。
 * 色は CSS 変数（--viz, --seq1..4, --grid, --muted）を使う。
 * data-tip 属性を持つ要素にカーソル（タップ）を合わせると、ツールチップを表示する。 */
(function (global) {
  'use strict';
  const esc = global.U.esc;

  /* 上だけ角丸（4px）で、下は基準線にそろえた棒 */
  const bar = (x, y, w, h, tip, cls = 'v-bar') => {
    if (h <= 0) return '';
    const r = Math.min(4, h / 2, w / 2);
    const d = `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    return `<path class="${cls}" d="${d}" data-tip="${esc(tip)}"></path>`;
  };

  /* 縦棒グラフ。data: [{label, value, tip}] */
  function columns(data, { width, height = 170, yMax, unit = '' } = {}) {
    const padL = 30, padR = 6, padT = 10, padB = 22;
    const W = Math.max(240, width), H = height;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = yMax || Math.max(4, ...data.map((d) => d.value));
    const nice = niceMax(max);
    const step = iw / data.length;
    const bw = Math.max(4, Math.min(28, step - 4));
    const ticks = [0, nice / 2, nice];
    let s = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
    ticks.forEach((t) => {
      const y = padT + ih - (t / nice) * ih;
      s += `<line class="v-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"></line>`;
      s += `<text class="v-axis" x="${padL - 6}" y="${y + 4}" text-anchor="end">${t}${unit}</text>`;
    });
    const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 44)));
    data.forEach((d, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const h = (d.value / nice) * ih;
      // 当たり判定は棒より大きく（列全体）
      s += `<rect class="v-hit" x="${padL + i * step}" y="${padT}" width="${step}" height="${ih}" data-tip="${esc(d.tip)}"></rect>`;
      s += bar(x, padT + ih - h, bw, h, d.tip);
      if ((data.length - 1 - i) % every === 0) {
        s += `<text class="v-axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
      }
    });
    s += `<line class="v-base" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"></line></svg>`;
    return s;
  }

  /* 折れ線（0〜100%）。value が null の日は線を切る */
  function line(data, { width, height = 170 } = {}) {
    const padL = 36, padR = 10, padT = 12, padB = 22;
    const W = Math.max(240, width), H = height;
    const iw = W - padL - padR, ih = H - padT - padB;
    const step = data.length > 1 ? iw / (data.length - 1) : 0;
    const px = (i) => padL + i * step;
    const py = (v) => padT + ih - (v / 100) * ih;
    let s = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
    [0, 50, 100].forEach((t) => {
      s += `<line class="v-grid" x1="${padL}" x2="${W - padR}" y1="${py(t)}" y2="${py(t)}"></line>`;
      s += `<text class="v-axis" x="${padL - 6}" y="${py(t) + 4}" text-anchor="end">${t}%</text>`;
    });
    let path = '', pen = false;
    data.forEach((d, i) => {
      if (d.value == null) { pen = false; return; }
      path += `${pen ? 'L' : 'M'}${px(i)},${py(d.value)}`;
      pen = true;
    });
    s += `<path class="v-line" d="${path}"></path>`;
    const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 44)));
    data.forEach((d, i) => {
      if (d.value != null) {
        s += `<circle class="v-dot" cx="${px(i)}" cy="${py(d.value)}" r="4"></circle>`;
        s += `<circle class="v-hit" cx="${px(i)}" cy="${py(d.value)}" r="${Math.max(10, step / 2)}" data-tip="${esc(d.tip)}"></circle>`;
      }
      if ((data.length - 1 - i) % every === 0) {
        s += `<text class="v-axis" x="${px(i)}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
      }
    });
    return s + '</svg>';
  }

  /* 学習カレンダー（週ごとの列 × 曜日の行）。cells: [{date, n, tip}]（古い順・日曜はじまり） */
  function calendar(cells, { width, levels } = {}) {
    const weeks = Math.ceil(cells.length / 7);
    const padL = 18, padT = 16, gap = 3;
    const size = Math.max(9, Math.min(18, Math.floor((width - padL) / weeks) - gap));
    const W = padL + weeks * (size + gap), H = padT + 7 * (size + gap);
    let s = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
    ['日', '', '火', '', '木', '', '土'].forEach((d, r) => {
      if (d) s += `<text class="v-axis" x="0" y="${padT + r * (size + gap) + size - 2}">${d}</text>`;
    });
    let lastMonth = '';
    cells.forEach((c, i) => {
      const col = Math.floor(i / 7), row = i % 7;
      const x = padL + col * (size + gap), y = padT + row * (size + gap);
      const lv = levels(c.n);
      s += `<rect class="v-cell q${lv}${c.future ? ' fut' : ''}" x="${x}" y="${y}" width="${size}" height="${size}" rx="3" data-tip="${esc(c.tip)}"></rect>`;
      const m = c.date.slice(5, 7);
      if (row === 0 && m !== lastMonth) {
        s += `<text class="v-axis" x="${x}" y="11">${+m}月</text>`;
        lastMonth = m;
      }
    });
    return s + '</svg>';
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* ツールチップ（マウス・タッチ共通） */
  function initTips() {
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    const showAt = (el, x, y) => {
      tip.textContent = el.getAttribute('data-tip');
      tip.style.display = 'block';
      const r = tip.getBoundingClientRect();
      let left = x + 12, top = y - r.height - 10;
      if (left + r.width > window.innerWidth - 8) left = x - r.width - 12;
      if (top < 8) top = y + 16;
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${top}px`;
    };
    const hide = () => { tip.style.display = 'none'; };
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el && e.pointerType === 'mouse') showAt(el, e.clientX, e.clientY);
      else if (e.pointerType === 'mouse') hide();
    });
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) showAt(el, e.clientX, e.clientY); else hide();
    });
    window.addEventListener('scroll', hide, { passive: true });
    hideTip = hide;
  }
  let hideTip = () => {};

  global.Charts = { columns, line, calendar, initTips, hideTip: () => hideTip() };
})(typeof window !== 'undefined' ? window : globalThis);
