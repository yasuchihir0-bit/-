/* 社会：位置も覚える
 *   1) 地理の問題の解説に「📍 位置」を自動でつける（問題・答え・解説に出てくる都道府県や地形の位置メモ）
 *   2) 日本地図を見て答える問題（分野「地図で位置を覚える」、出題のたびに作る）
 *   位置メモは js/data/japan-geo.js、地図は js/jmap.js。
 */
(function (global) {
  'use strict';
  const S = global.SHAKAI, G = global.JGEO, U = global.U;
  if (!S || !G) return;
  const { pick, shuffle } = U;
  const P = G.P, F = G.F;
  const PIDS = Object.keys(P);
  const nameOf = (id) => P[id][0];
  const regionOf = (id) => P[id][1];
  const inRegion = (r) => PIDS.filter((id) => regionOf(id) === r);
  /* となりの地方（ちがう地方から選ぶとき、近いところを優先する） */
  const NEAR = { 北海道: ['東北'], 東北: ['北海道', '関東', '中部'], 関東: ['東北', '中部'], 中部: ['関東', '近畿', '東北'], 近畿: ['中部', '中国・四国'], '中国・四国': ['近畿', '九州'], 九州: ['中国・四国'] };

  /* ───────── 1) 解説に位置メモをつける ───────── */
  const GEO_CATS = new Set(['kokudo', 'nogyo', 'kogyo', 'boeki', 'chiho', 'tokai', 'saigai']);
  const NAMES = PIDS.map((id) => [nameOf(id), id, true]).concat(Object.keys(F).map((n) => [n, n, false]))
    .sort((a, b) => b[0].length - a[0].length);
  function placesIn(text) {
    const found = [];
    let t = String(text || '');
    NAMES.forEach(([name, key, isPref]) => {
      const i = t.indexOf(name);
      if (i < 0) return;
      found.push([i, key, isPref]);
      t = t.split(name).join('　'.repeat(name.length)); // 長い名前を先に取り、重なって数えないようにする
    });
    return found.sort((a, b) => a[0] - b[0]).map((x) => [x[1], x[2]]);
  }
  S.bank.forEach((item) => {
    if (!GEO_CATS.has(item.cat) || item.k) return;
    const ans = item.c ? item.c[0] : item.a ? item.a[0] : item.ok ? item.ok.join('、') : '';
    const seen = new Set(), loc = [];
    [ans, item.q, item.exp].forEach((t) => placesIn(t).forEach(([key, isPref]) => {
      if (seen.has(key) || loc.length >= 3) return;
      seen.add(key);
      loc.push(isPref ? [nameOf(key), P[key][3], [key]] : [key, F[key][1], F[key][0].split(',')]);
    }));
    if (loc.length) item.loc = loc;
  });

  /* ───────── 2) 地図の問題 ───────── */
  const L = global.JMap ? global.JMap.LABELS : ['ア', 'イ', 'ウ', 'エ'];
  const kind = (id) => (id === 'hokkaido' ? '道' : id === 'tokyo' ? '都' : id === 'osaka' || id === 'kyoto' ? '府' : '県');
  /* x とまぎらわしい県を n 個（同じ地方 → となりの地方 → そのほか） */
  function others(x, n, sameFirst = true) {
    const same = shuffle(inRegion(regionOf(x)).filter((id) => id !== x));
    const near = shuffle(NEAR[regionOf(x)].flatMap(inRegion));
    const rest = shuffle(PIDS.filter((id) => id !== x));
    const order = sameFirst ? same.concat(near, rest) : rest;
    /* 沖縄県は答えのときだけ（まちがいの選択肢に入れると地図が広がりすぎる）。印が重ならないよう、はなれた県を選ぶ */
    const C = global.JMap ? global.JMap.center : null;
    const far = (a, b) => !C || Math.hypot(C(a)[0] - C(b)[0], C(a)[1] - C(b)[1]) >= 22;
    const out = [];
    [...new Set(order)].forEach((id) => {
      if (out.length >= n || id === x || id === 'okinawa') return;
      if ([x].concat(out).every((o) => far(o, id))) out.push(id);
    });
    [...new Set(order)].forEach((id) => { if (out.length < n && id !== x && id !== 'okinawa' && !out.includes(id)) out.push(id); });
    return out;
  }
  /* 地図に ア〜エ の印をつけた問題 */
  function markQ(x, q, lv, exp, sameFirst = true) {
    const ids = shuffle([x].concat(others(x, 3, sameFirst)));
    const marks = ids.map((id, i) => [id, L[i]]);
    const ans = L[ids.indexOf(x)];
    return { q, ans, choices: L.slice(0, 4), lv, map: { marks }, exp: `答えは ${ans}（${nameOf(x)}）。${exp || ''}\n📍 ${nameOf(x)}：${P[x][3]}` };
  }
  const FACTS = [
    ['りんごとにんにくの生産量が日本一', 'aomori'], ['米の生産量が日本一', 'niigata'], ['さくらんぼと西洋なしの生産量が日本一', 'yamagata'],
    ['ぶどうとももの生産量が日本一', 'yamanashi'], ['レタスの生産量が日本一', 'nagano'], ['みかん・うめ・柿の生産量が日本一', 'wakayama'],
    ['いちごの生産量が日本一', 'tochigi'], ['メロン・れんこん・鶏卵の生産量が日本一', 'ibaraki'], ['落花生の生産量が日本一', 'chiba'],
    ['こんにゃくいもの生産量が日本一', 'gunma'], ['トマトの生産量と、い草の生産が日本一', 'kumamoto'], ['なす・しょうが・ゆずの生産量が日本一', 'kochi'],
    ['レモンの生産量と、かきの養殖が日本一', 'hiroshima'], ['すだちの生産が日本一', 'tokushima'], ['かぼすの生産と、温泉の源泉の数が日本一', 'oita'],
    ['豚の飼育頭数とさつまいもの生産量が日本一', 'kagoshima'], ['さとうきびの生産量が日本一', 'okinawa'], ['生乳・じゃがいも・小麦の生産量が日本一', 'hokkaido'],
    ['製造品出荷額が 40 年以上連続で日本一', 'aichi'], ['清酒の生産量が日本一', 'hyogo'], ['めがねのフレームの生産で知られる鯖江市がある', 'fukui'],
    ['タオルの生産で知られる今治市がある', 'ehime'], ['ピアノの生産量が日本一', 'shizuoka'], ['伝統的工芸品の輪島塗・九谷焼・加賀友禅がつくられる', 'ishikawa'],
    ['伝統的工芸品の南部鉄器がつくられる', 'iwate'], ['伝統的工芸品の西陣織がつくられる', 'kyoto'], ['伝統的工芸品の有田焼がつくられる', 'saga'],
    ['伝統的工芸品の備前焼がつくられる', 'okayama'], ['美濃焼がつくられ、白川郷の合掌造り集落がある', 'gifu'], ['四大公害病のイタイイタイ病が発生した', 'toyama'],
    ['四大公害病の四日市ぜんそくが発生した', 'mie'], ['四大公害病の水俣病が発生した', 'kumamoto'], ['世界遺産の富岡製糸場がある', 'gunma'],
    ['世界遺産の姫路城がある', 'hyogo'], ['世界遺産の厳島神社がある', 'hiroshima'], ['世界遺産の石見銀山がある', 'shimane'],
    ['世界遺産の中尊寺金色堂（平泉）がある', 'iwate'], ['人口が日本でいちばん少ない', 'tottori'], ['面積が日本でいちばん小さい', 'kagawa'],
    ['日本の標準時子午線（東経 135 度）が通る明石市がある', 'hyogo'], ['原子力発電所が多く集まる若狭湾に面する', 'fukui'], ['藤原京や平城京が置かれた', 'nara'],
    ['日本最大の湖、琵琶湖がある', 'shiga'], ['打製石器が見つかった岩宿遺跡がある', 'gunma'], ['弥生時代の吉野ヶ里遺跡がある', 'saga'],
    ['縄文時代の三内丸山遺跡がある', 'aomori'], ['弥生時代の登呂遺跡がある', 'shizuoka'], ['ペリーが来航した浦賀がある', 'kanagawa'],
    ['鉄砲が伝わった種子島がある', 'kagoshima'], ['関ヶ原の戦いが行われた', 'gifu'], ['桶狭間・長篠・小牧・長久手の戦いが行われた', 'aichi'],
    ['鎌倉幕府が置かれた鎌倉がある', 'kanagawa'], ['承久の乱のあと後鳥羽上皇が流された隠岐がある', 'shimane'], ['元の軍がせめてきた博多湾がある', 'fukuoka'],
    ['伊勢神宮がある', 'mie'], ['中部国際空港（セントレア）がある', 'aichi'],
  ];
  const SINGLE = Object.keys(F).filter((n) => !F[n][0].includes(','));
  const CAPITAL = PIDS.filter((id) => id !== 'tokyo' && P[id][2].replace(/[市]$/, '') !== nameOf(id).replace(/[都道府県]$/, ''));
  const raw = [
    /* 色をぬった都道府県の名前を書く（「県」などはあってもなくてもよい） */
    () => {
      const x = pick(PIDS), nm = nameOf(x), base = x === 'hokkaido' ? nm : nm.replace(/[都府県]$/, '');
      return { type: 'text', q: '地図で色をぬった都道府県の名前を書きなさい。', ans: nm, accept: [nm, base].concat(G.YOMI && G.YOMI[x] ? [G.YOMI[x] + ({ 道: '', 都: 'と', 府: 'ふ', 県: 'けん' })[kind(x)], G.YOMI[x]] : []), lv: 3, map: { hi: [x], view: inRegion(regionOf(x)) }, exp: `${nm}（${regionOf(x)}地方、${regionOf(x) === '北海道' ? '道庁' : '県庁'}所在地は${P[x][2]}）。\n📍 ${nm}：${P[x][3]}` };
    },
    /* 色をぬった県の特ちょう */
    () => {
      const [t, x] = pick(FACTS);
      const wrong = shuffle(FACTS.filter((f) => f[1] !== x)).slice(0, 3).map((f) => f[0]);
      return { q: `地図で色をぬった${kind(x)}について、正しいものはどれですか。`, ans: t, choices: shuffle([t].concat(wrong)), lv: 3, map: { hi: [x], view: inRegion(regionOf(x)) }, exp: `色をぬったのは${nameOf(x)}です。${nameOf(x)}は「${t}」${kind(x)}です。\n📍 ${nameOf(x)}：${P[x][3]}` };
    },
    /* 色をぬった都道府県の名前 */
    (f) => {
      const x = pick(PIDS);
      const ch = shuffle([x].concat(others(x, 3)));
      return { q: '地図で色をぬった都道府県はどこですか。', ans: nameOf(x), choices: ch.map(nameOf), lv: 3, map: { hi: [x], view: inRegion(regionOf(x)) }, exp: `📍 ${nameOf(x)}：${P[x][3]}` };
    },
    /* ○○県はどれ（地図の ア〜エ） */
    (f) => {
      const x = pick(PIDS);
      return markQ(x, `${nameOf(x)}はどれですか。地図のア〜エから選びなさい。`, 3);
    },
    /* 特ちょう → 地図 */
    (f) => {
      const [t, x] = pick(FACTS);
      return markQ(x, `${t}${kind(x)}はどれですか。地図のア〜エから選びなさい。`, 3, '', Math.random() < 0.5);
    },
    /* 地形 → 地図 */
    (f) => {
      const n = pick(SINGLE), x = F[n][0];
      return markQ(x, `${n}がある${kind(x)}はどれですか。地図のア〜エから選びなさい。`, 3, `\n📍 ${n}：${F[n][1]}`);
    },
    /* 色をぬった県の県庁所在地（県名とちがうもの） */
    (f) => {
      const x = pick(CAPITAL);
      const ch = shuffle([x].concat(others(x, 4).filter((id) => id !== 'tokyo').slice(0, 3)));
      return { q: '地図で色をぬった県の、県庁所在地はどこですか。', ans: P[x][2], choices: ch.map((id) => P[id][2]), lv: 3, map: { hi: [x], view: inRegion(regionOf(x)) }, exp: `${nameOf(x)}の県庁所在地は${P[x][2]}です。\n📍 ${nameOf(x)}：${P[x][3]}` };
    },
    /* 色をぬった地方 */
    (f) => {
      const r = pick(G.REGIONS.filter((x) => x !== '北海道'));
      const ch = shuffle([r].concat(shuffle(G.REGIONS.filter((x) => x !== r)).slice(0, 3)));
      const list = inRegion(r);
      return { q: '地図で色をぬった地域は、7 地方区分の何地方ですか。', ans: `${r}地方`, choices: ch.map((x) => `${x}地方`), lv: 3, map: { hi: list, view: list.filter((id) => id !== 'okinawa') }, exp: `${r}地方：${list.map(nameOf).join('・')}。` };
    },
  ];
  /* ★★★だけのときは、★★の形の問題のかわりに★★★の形の問題を出す */
  const lvOf = (g) => g().lv;
  const hard = raw.filter((g) => lvOf(g) >= 3);
  const gens = raw.map((g) => (f) => { const q = g(); return !f || f(q.lv) ? q : pick(hard)(); });
  const at = S.cats.findIndex((c) => c.id === 'tokai');
  S.cats.splice(at, 0, { id: 'ichi', name: '地図で位置を覚える', note: '地理', gens, size: () => PIDS.length + FACTS.length + SINGLE.length });
  S.app = S.app || {};
  S.app.weight = Object.assign({}, S.app.weight, { ichi: 2 });
  if (S.app.topFocus && !S.app.topFocus.includes('ichi')) S.app.topFocus = ['ichi'].concat(S.app.topFocus);
})(typeof window !== 'undefined' ? window : globalThis);
