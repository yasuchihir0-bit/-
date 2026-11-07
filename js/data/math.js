/* 算数：問題を自動で作る（毎回数字が変わる） */
(function (global) {
  'use strict';
  const { ri, pick, shuffle, gcd, lcm, R, radd, rsub, rmul, rdiv, isFiniteDecimal, fmt, num } = global.U;

  /* 条件を満たすまで作り直す */
  const retry = (fn, n = 200) => {
    for (let i = 0; i < n; i++) {
      const r = fn();
      if (r) return r;
    }
    throw new Error('generator failed');
  };

  /* ───────── 計算・逆算 ───────── */

  function calcMixed() {
    if (Math.random() < 0.5) {
      const a = ri(2, 9), b = ri(2, 20), c = ri(2, 20), e = ri(2, 9);
      const p = a * (b + c);
      const k = ri(2, Math.min(15, p - 1));
      const d = e * k;
      const ans = p - k;
      return {
        q: `次の計算をしなさい。\n${a} × (${b} + ${c}) − ${d} ÷ ${e}`,
        ans: R(ans),
        exp: `かっこの中 → かけ算・わり算 → たし算・ひき算 の順に計算します。\n` +
          `${b} + ${c} = ${b + c}\n${a} × ${b + c} = ${p}\n${d} ÷ ${e} = ${k}\n${p} − ${k} = ${ans}`,
      };
    }
    return retry(() => {
      const b = ri(2, 30), a = b + ri(2, 20), c = ri(2, 9);
      const f = ri(1, 8), e = f + ri(2, 8), g = e - f, k = ri(2, 12), d = g * k;
      const ans = (a - b) * c + k;
      return {
        q: `次の計算をしなさい。\n(${a} − ${b}) × ${c} + ${d} ÷ (${e} − ${f})`,
        ans: R(ans),
        exp: `${a} − ${b} = ${a - b}、${e} − ${f} = ${g}\n${a - b} × ${c} = ${(a - b) * c}\n` +
          `${d} ÷ ${g} = ${k}\n${(a - b) * c} + ${k} = ${ans}`,
      };
    });
  }

  function calcDistrib() {
    if (Math.random() < 0.5) {
      // 3.14 × a + 3.14 × b − 3.14 × c
      return retry(() => {
        const a = ri(5, 30), b = ri(5, 30), c = ri(2, 20);
        const s = a + b - c;
        if (s <= 0 || s % 10 !== 0) return null;
        const ans = R(314 * s, 100);
        return {
          q: `くふうして計算しなさい。\n3.14 × ${a} + 3.14 × ${b} − 3.14 × ${c}`,
          ans,
          exp: `3.14 をまとめます（分配法則）。\n3.14 × (${a} + ${b} − ${c}) = 3.14 × ${s} = ${fmt(ans)}`,
        };
      });
    }
    const m = ri(11, 49), a = ri(10, 90), b = 100 - a;
    const c = pick([1, 2, 3]);
    const ans = m * 100 * c;
    return {
      q: `くふうして計算しなさい。\n${m} × ${a * c} + ${m} × ${b * c}`,
      ans: R(ans),
      exp: `${m} でまとめると\n${m} × (${a * c} + ${b * c}) = ${m} × ${100 * c} = ${ans}`,
    };
  }

  function inverse() {
    if (Math.random() < 0.5) {
      const x = ri(2, 30), a = ri(1, 20), b = ri(2, 9);
      const c = ri(1, (x + a) * b - 1), d = (x + a) * b - c;
      return {
        q: `□にあてはまる数を求めなさい。\n(□ + ${a}) × ${b} − ${c} = ${d}`,
        ans: R(x),
        exp: `うしろから順にもどします。\n(□ + ${a}) × ${b} = ${d} + ${c} = ${d + c}\n` +
          `□ + ${a} = ${d + c} ÷ ${b} = ${x + a}\n□ = ${x + a} − ${a} = ${x}`,
      };
    }
    const x = ri(3, 30), a = ri(2, 9), c = ri(2, 9);
    const d = ri(1, Math.floor((x * a - 1) / c));
    const b = x * a - d * c;
    return {
      q: `□にあてはまる数を求めなさい。\n(□ × ${a} − ${b}) ÷ ${c} = ${d}`,
      ans: R(x),
      exp: `□ × ${a} − ${b} = ${d} × ${c} = ${d * c}\n□ × ${a} = ${d * c} + ${b} = ${x * a}\n` +
        `□ = ${x * a} ÷ ${a} = ${x}`,
    };
  }

  const DENS = [2, 3, 4, 5, 6, 8, 9, 10, 12];
  const randFrac = () => {
    const d = pick(DENS);
    return R(ri(1, d - 1), d);
  };
  const f = (r) => fmt(r, { fraction: true });

  function fraction() {
    if (Math.random() < 0.5) {
      return retry(() => {
        const a = randFrac(), b = randFrac(), c = randFrac();
        const ans = rsub(radd(a, b), c);
        if (ans.n <= 0 || ans.d > 72) return null;
        const ab = radd(a, b);
        return {
          q: `次の計算をしなさい。\n${f(a)} + ${f(b)} − ${f(c)}`,
          ans,
          exp: `通分して計算します。\n${f(a)} + ${f(b)} = ${f(ab)}\n${f(ab)} − ${f(c)} = ${f(ans)}`,
          fracAns: true,
        };
      });
    }
    return retry(() => {
      const a = randFrac(), b = randFrac(), c = randFrac();
      const ab = rdiv(a, b);
      const ans = rmul(ab, c);
      if (ans.d > 60 || ans.n > 200) return null;
      return {
        q: `次の計算をしなさい。\n${f(a)} ÷ ${f(b)} × ${f(c)}`,
        ans,
        exp: `わる数を逆数にしてかけ算にします。\n${f(a)} × ${f(R(b.d, b.n))} × ${f(c)} = ${f(ans)}`,
        fracAns: true,
      };
    });
  }

  /* ───────── 割合・比 ───────── */

  function concentration() {
    if (Math.random() < 0.55) {
      return retry(() => {
        const A = pick([100, 150, 200, 300, 400, 500]), B = pick([100, 200, 250, 300, 400, 600]);
        const p = ri(2, 15), q = ri(2, 15);
        if (p === q) return null;
        const salt = A * p / 100 + B * q / 100;
        const c = R(A * p + B * q, A + B);
        if (c.d !== 1) return null;
        return {
          q: `${p}% の食塩水 ${A}g と ${q}% の食塩水 ${B}g を混ぜると、何% の食塩水になりますか。`,
          ans: c, unit: '%',
          exp: `ふくまれる食塩の重さ：\n${A} × ${p / 100} = ${num(A * p / 100)}g、${B} × ${q / 100} = ${num(B * q / 100)}g\n` +
            `合計 ${num(salt)}g の食塩が ${A + B}g の食塩水にとけているので\n${num(salt)} ÷ ${A + B} × 100 = ${fmt(c)}%`,
        };
      });
    }
    return retry(() => {
      const W = pick([100, 150, 200, 240, 300, 400]), p = ri(4, 20), w = pick([20, 40, 50, 60, 100, 150, 200]);
      const c = R(W * p, W + w);
      if (c.d !== 1) return null;
      const salt = W * p / 100;
      return {
        q: `${p}% の食塩水 ${W}g に水を ${w}g 加えると、何% の食塩水になりますか。`,
        ans: c, unit: '%',
        exp: `水を加えても食塩の重さは変わりません。\n食塩：${W} × ${p / 100} = ${num(salt)}g\n` +
          `食塩水：${W} + ${w} = ${W + w}g\n${num(salt)} ÷ ${W + w} × 100 = ${fmt(c)}%`,
      };
    });
  }

  function profit() {
    return retry(() => {
      const C = pick([400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500]);
      const p = pick([20, 25, 30, 40, 50]), q = pick([10, 20, 25, 30]);
      const teika = C * (100 + p) / 100;
      const sell = teika * (100 - q) / 100;
      if (!Number.isInteger(teika) || !Number.isInteger(sell) || sell <= C) return null;
      return {
        q: `原価 ${C} 円の品物に、原価の ${p}% の利益を見こんで定価をつけました。` +
          `しかし売れなかったので、定価の ${q}% 引きで売りました。利益は何円ですか。`,
        ans: R(sell - C), unit: '円',
        exp: `定価：${C} × (1 + ${p / 100}) = ${teika} 円\n売り値：${teika} × (1 − ${q / 100}) = ${sell} 円\n` +
          `利益：${sell} − ${C} = ${sell - C} 円`,
      };
    });
  }

  const WORK_PAIRS = [];
  for (let a = 4; a <= 40; a++) {
    for (let b = a + 1; b <= 60; b++) if ((a * b) % (a + b) === 0) WORK_PAIRS.push([a, b]);
  }
  function work() {
    return retry(() => {
      const [a, b] = pick(WORK_PAIRS);
      const t = a * b / (a + b);
      const L = lcm(a, b);
      if (Math.random() < 0.5) {
        return {
          q: `ある仕事を、A さん 1 人ですると ${a} 日、B さん 1 人ですると ${b} 日かかります。` +
            `この仕事を 2 人でいっしょにすると、何日で終わりますか。`,
          ans: R(t), unit: '日',
          exp: `仕事全体を ${a} と ${b} の最小公倍数 ${L} とします。\n` +
            `A さんは 1 日に ${L} ÷ ${a} = ${L / a}、B さんは 1 日に ${L} ÷ ${b} = ${L / b}\n` +
            `2 人で 1 日に ${L / a + L / b}\n${L} ÷ ${L / a + L / b} = ${t} 日`,
        };
      }
      return {
        q: `ある仕事を、A さんと B さんの 2 人ですると ${t} 日、A さん 1 人ですると ${a} 日かかります。` +
          `B さん 1 人ですると何日かかりますか。`,
        ans: R(b), unit: '日',
        exp: `仕事全体を ${t} と ${a} の最小公倍数 ${lcm(t, a)} とします。\n` +
          `2 人で 1 日に ${lcm(t, a) / t}、A さんは 1 日に ${lcm(t, a) / a}\n` +
          `B さんは 1 日に ${lcm(t, a) / t} − ${lcm(t, a) / a} = ${lcm(t, a) / t - lcm(t, a) / a}\n` +
          `${lcm(t, a)} ÷ ${lcm(t, a) / t - lcm(t, a) / a} = ${b} 日`,
      };
    });
  }

  function average() {
    return retry(() => {
      const n = ri(3, 6), x = ri(60, 85), z = x + ri(1, 4);
      const next = (n + 1) * z - n * x;
      if (next > 100) return null;
      return {
        q: `これまで ${n} 回のテストの平均点は ${x} 点でした。次のテストで何点をとれば、` +
          `${n + 1} 回の平均点が ${z} 点になりますか。`,
        ans: R(next), unit: '点',
        exp: `${n} 回の合計：${x} × ${n} = ${x * n} 点\n${n + 1} 回の合計：${z} × ${n + 1} = ${z * (n + 1)} 点\n` +
          `${z * (n + 1)} − ${x * n} = ${next} 点`,
      };
    });
  }

  function ratioShare() {
    return retry(() => {
      const a = ri(3, 9), b = ri(2, 8);
      if (a <= b || gcd(a, b) !== 1) return null;
      const u = pick([50, 100, 150, 200, 250, 300]);
      const diff = (a - b) * u;
      if (Math.random() < 0.5) {
        return {
          q: `兄と弟の所持金の比は ${a} : ${b} で、兄は弟より ${diff} 円多く持っています。弟の所持金は何円ですか。`,
          ans: R(b * u), unit: '円',
          exp: `比の差 ${a} − ${b} = ${a - b} が ${diff} 円にあたります。\n比の 1 は ${diff} ÷ ${a - b} = ${u} 円\n弟は ${u} × ${b} = ${b * u} 円`,
        };
      }
      const total = (a + b) * u;
      return {
        q: `${total} 円を、兄と弟で ${a} : ${b} の比になるように分けます。兄は何円もらえますか。`,
        ans: R(a * u), unit: '円',
        exp: `全体は比で ${a} + ${b} = ${a + b}\n比の 1 は ${total} ÷ ${a + b} = ${u} 円\n兄は ${u} × ${a} = ${a * u} 円`,
      };
    });
  }

  /* ───────── 速さ ───────── */

  function traveler() {
    const t = ri(0, 2);
    if (t === 0) {
      const vA = pick([50, 60, 70, 80]), vB = pick([40, 50, 60, 75, 90]), m = ri(5, 20);
      const D = (vA + vB) * m;
      return {
        q: `家と駅は ${D}m はなれています。兄は家から分速 ${vA}m、弟は駅から分速 ${vB}m で、` +
          `同時に向かい合って出発しました。2 人が出会うのは出発してから何分後ですか。`,
        ans: R(m), unit: '分後',
        exp: `2 人は 1 分間に ${vA} + ${vB} = ${vA + vB}m ずつ近づきます（速さの和）。\n${D} ÷ ${vA + vB} = ${m} 分後`,
      };
    }
    if (t === 1) {
      return retry(() => {
        const v1 = pick([40, 50, 60, 70, 80]), k = ri(5, 15), head = v1 * k;
        const ds = [];
        for (let d = 10; d <= 120; d += 10) {
          if (head % d === 0 && head / d >= 3 && head / d <= 30) ds.push(d);
        }
        if (!ds.length) return null;
        const d = pick(ds), v2 = v1 + d, m = head / d;
        return {
          q: `弟が家を出て分速 ${v1}m で歩き始めました。その ${k} 分後に、兄が家を出て分速 ${v2}m で同じ道を追いかけました。` +
            `兄が弟に追いつくのは、兄が出発してから何分後ですか。`,
          ans: R(m), unit: '分後',
          exp: `兄が出発するとき、弟は ${v1} × ${k} = ${head}m 先にいます。\n` +
            `兄は 1 分間に ${v2} − ${v1} = ${d}m ずつ追いつきます（速さの差）。\n${head} ÷ ${d} = ${m} 分後`,
        };
      });
    }
    const vA = pick([80, 90, 100, 120]), vB = pick([50, 60, 70]);
    const same = Math.random() < 0.5;
    const s = same ? vA - vB : vA + vB;
    const m = ri(4, 20), L = s * m;
    return {
      q: `1 周 ${L}m の池のまわりを、A さんは分速 ${vA}m、B さんは分速 ${vB}m で、同じ地点から同時に` +
        `${same ? '同じ向き' : '反対向き'}に歩き始めました。2 人が初めて${same ? 'A さんが B さんに追いつく' : '出会う'}のは何分後ですか。`,
      ans: R(m), unit: '分後',
      exp: same
        ? `同じ向きなので、A さんが 1 周（${L}m）多く歩いたときに追いつきます。\n速さの差 ${vA} − ${vB} = ${s}m/分\n${L} ÷ ${s} = ${m} 分後`
        : `反対向きなので、2 人合わせて 1 周（${L}m）歩いたときに出会います。\n速さの和 ${vA} + ${vB} = ${s}m/分\n${L} ÷ ${s} = ${m} 分後`,
    };
  }

  function train() {
    return retry(() => {
      const v = pick([15, 20, 25, 30]), t = ri(15, 60), L = pick([100, 120, 150, 160, 180, 200, 240]);
      const B = v * t - L;
      if (B < 100) return null;
      const kmh = num(v * 3.6);
      const k = ri(0, 2);
      if (k === 0) {
        return {
          q: `長さ ${L}m の電車が、時速 ${kmh}km で長さ ${B}m の鉄橋をわたります。` +
            `わたり始めてから完全にわたり終わるまでに何秒かかりますか。`,
          ans: R(t), unit: '秒',
          exp: `時速 ${kmh}km = 秒速 ${kmh}×1000÷3600 = ${v}m\n電車が進むきょりは「鉄橋の長さ＋電車の長さ」\n` +
            `${B} + ${L} = ${B + L}m\n${B + L} ÷ ${v} = ${t} 秒`,
        };
      }
      if (k === 1) {
        return {
          q: `秒速 ${v}m で走る電車が、長さ ${B}m の鉄橋をわたり始めてから完全にわたり終わるまでに ${t} 秒かかりました。` +
            `この電車の長さは何 m ですか。`,
          ans: R(L), unit: 'm',
          exp: `${t} 秒で進むきょり：${v} × ${t} = ${v * t}m\nこれは「鉄橋の長さ＋電車の長さ」なので\n${v * t} − ${B} = ${L}m`,
        };
      }
      const t2 = (B - L) / v;
      if (!Number.isInteger(t2) || t2 <= 0) return null;
      return {
        q: `長さ ${L}m の電車が秒速 ${v}m で、長さ ${B}m のトンネルを通ります。` +
          `電車が完全にトンネルの中にかくれているのは何秒間ですか。`,
        ans: R(t2), unit: '秒間',
        exp: `完全にかくれている間に進むきょりは「トンネルの長さ − 電車の長さ」\n${B} − ${L} = ${B - L}m\n${B - L} ÷ ${v} = ${t2} 秒間`,
      };
    });
  }

  function river() {
    return retry(() => {
      const s = ri(8, 20), r = ri(1, 5);
      if (s - r < 4) return null;
      const up = s - r, down = s + r;
      const base = lcm(up, down);
      const D = base * ri(1, 3);
      if (D > 160) return null;
      const tu = D / up, td = D / down;
      const askStill = Math.random() < 0.5;
      return {
        q: `川の上流の A 町と下流の B 町は ${D}km はなれています。船で B 町から A 町まで上るのに ${tu} 時間、` +
          `A 町から B 町まで下るのに ${td} 時間かかりました。${askStill ? '静水時の船の速さ' : '川の流れの速さ'}は時速何 km ですか。`,
        ans: R(askStill ? s : r), unit: 'km',
        exp: `上りの速さ：${D} ÷ ${tu} = 時速 ${up}km\n下りの速さ：${D} ÷ ${td} = 時速 ${down}km\n` +
          (askStill
            ? `静水時の速さ ＝（下り＋上り）÷ 2 = (${down} + ${up}) ÷ 2 = 時速 ${s}km`
            : `流れの速さ ＝（下り − 上り）÷ 2 = (${down} − ${up}) ÷ 2 = 時速 ${r}km`),
      };
    });
  }

  function clock() {
    if (Math.random() < 0.6) {
      return retry(() => {
        const h = ri(1, 11), m = ri(1, 59);
        const long = 6 * m, shortA = 30 * h + m / 2;
        let diff = Math.abs(shortA - long);
        let note = '';
        if (diff > 180) { note = `\n180 度より大きいので、360 − ${num(diff)} = ${num(360 - diff)} 度`; diff = 360 - diff; }
        if (diff === 0) return null;
        return {
          q: `${h} 時 ${m} 分のとき、時計の長針と短針がつくる角のうち、小さいほうの角は何度ですか。`,
          ans: R(Math.round(diff * 2), 2), unit: '度',
          exp: `12 の位置を 0 度とします。長針は 1 分に 6 度、短針は 1 分に 0.5 度進みます。\n` +
            `長針：6 × ${m} = ${long} 度\n短針：30 × ${h} + 0.5 × ${m} = ${num(shortA)} 度\n` +
            `差：${num(Math.abs(shortA - long))} 度${note}`,
        };
      });
    }
    const h = ri(1, 10);
    const ans = R(60 * h, 11);
    return {
      q: `${h} 時と ${h + 1} 時の間で、時計の長針と短針がぴったり重なるのは ${h} 時何分ですか。`,
      ans, unit: '分', fracAns: true,
      exp: `${h} 時ちょうどに、長針は短針より 30 × ${h} = ${30 * h} 度おくれています。\n` +
        `長針は 1 分に 6 − 0.5 = 5.5 度ずつ短針に追いつくので\n${30 * h} ÷ 5.5 = ${fmt(ans, { fraction: true })} 分`,
    };
  }

  function roundTrip() {
    return retry(() => {
      const v1 = ri(2, 12) * pick([1, 1, 10]), v2 = ri(2, 12) * pick([1, 1, 10]);
      if (v1 === v2 || v1 > 120 || v2 > 120) return null;
      const avg = R(2 * v1 * v2, v1 + v2);
      if (avg.d !== 1) return null;
      const D = lcm(v1, v2);
      if (D > 240) return null;
      const T = D / v1 + D / v2;
      return {
        q: `A 地から B 地までの ${D}km を、行きは時速 ${v1}km、帰りは時速 ${v2}km で往復しました。` +
          `往復の平均の速さは時速何 km ですか。`,
        ans: avg, unit: 'km',
        exp: `行き：${D} ÷ ${v1} = ${D / v1} 時間、帰り：${D} ÷ ${v2} = ${D / v2} 時間\n` +
          `往復 ${2 * D}km を ${T} 時間で進んだので\n${2 * D} ÷ ${T} = 時速 ${fmt(avg)}km\n` +
          `（(${v1} + ${v2}) ÷ 2 とするのはまちがいです）`,
      };
    });
  }

  function unitConv() {
    if (Math.random() < 0.5) {
      const a = pick([3, 6, 9, 12, 18, 24, 30, 36, 45, 54, 60, 72]);
      return {
        q: `時速 ${a}km は分速何 m ですか。`,
        ans: R(a * 1000, 60), unit: 'm',
        exp: `${a}km = ${a * 1000}m、1 時間 = 60 分\n${a * 1000} ÷ 60 = 分速 ${fmt(R(a * 1000, 60))}m`,
      };
    }
    const b = pick([5, 10, 12, 15, 20, 25, 30, 35, 40]);
    return {
      q: `秒速 ${b}m は時速何 km ですか。`,
      ans: R(b * 36, 10), unit: 'km',
      exp: `1 時間 = 3600 秒なので ${b} × 3600 = ${b * 3600}m\n${b * 3600}m = ${num(b * 3.6)}km → 時速 ${num(b * 3.6)}km`,
    };
  }

  /* ───────── 特殊算 ───────── */

  function trees() {
    const i = pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20]), n = ri(8, 40), L = i * n;
    const k = ri(0, 2);
    if (k === 0) {
      return {
        q: `長さ ${L}m のまっすぐな道の片側に、はしからはしまで ${i}m おきに木を植えます。` +
          `両はしにも植えるとき、木は何本必要ですか。`,
        ans: R(n + 1), unit: '本',
        exp: `間の数：${L} ÷ ${i} = ${n}\n両はしに植えるので、木の数 ＝ 間の数 ＋ 1 = ${n + 1} 本`,
      };
    }
    if (k === 1) {
      return {
        q: `まわりの長さが ${L}m の池のまわりに、${i}m おきに木を植えます。木は何本必要ですか。`,
        ans: R(n), unit: '本',
        exp: `池のまわり（円形）では、木の数 ＝ 間の数\n${L} ÷ ${i} = ${n} 本`,
      };
    }
    return {
      q: `長さ ${L}m のまっすぐな道の片側に、${i}m おきに木を植えます。両はしには植えないとき、木は何本必要ですか。`,
      ans: R(n - 1), unit: '本',
      exp: `間の数：${L} ÷ ${i} = ${n}\n両はしに植えないので、木の数 ＝ 間の数 − 1 = ${n - 1} 本`,
    };
  }

  function turtle() {
    if (Math.random() < 0.5) {
      const N = ri(10, 30), k = ri(2, N - 2), legs = 2 * (N - k) + 4 * k;
      return {
        q: `ツルとカメが合わせて ${N} ひきいます。足の数は合わせて ${legs} 本です。カメは何びきいますか。`,
        ans: R(k), unit: 'ひき',
        exp: `全部ツルだとすると足は 2 × ${N} = ${2 * N} 本\n実際との差：${legs} − ${2 * N} = ${legs - 2 * N} 本\n` +
          `ツル 1 羽をカメ 1 ぴきにかえると足は 2 本増えるので\n${legs - 2 * N} ÷ 2 = ${k} ひき`,
      };
    }
    const [p1, p2] = pick([[50, 100], [10, 50], [80, 120], [60, 90]]);
    const N = ri(10, 30), k = ri(2, N - 2), total = p1 * (N - k) + p2 * k;
    const item = p1 === 50 && p2 === 100 ? ['50 円玉', '100 円玉', '枚'] :
      p1 === 10 ? ['10 円玉', '50 円玉', '枚'] : [`1 個 ${p1} 円のりんご`, `1 個 ${p2} 円のなし`, '個'];
    return {
      q: `${item[0]}と${item[1]}が合わせて ${N} ${item[2]}あり、金額の合計は ${total} 円です。` +
        `${item[1].replace(/^1 個 \d+ 円の/, '')}は何${item[2]}ですか。`,
      ans: R(k), unit: item[2],
      exp: `全部 ${p1} 円だとすると ${p1} × ${N} = ${p1 * N} 円\n実際との差：${total} − ${p1 * N} = ${total - p1 * N} 円\n` +
        `1 つおきかえるごとに ${p2} − ${p1} = ${p2 - p1} 円増えるので\n${total - p1 * N} ÷ ${p2 - p1} = ${k}`,
    };
  }

  function excessShort() {
    const n = ri(5, 30), a = ri(2, 6), k = ri(1, 3), c = a + k;
    const b = ri(1, k * n - 1), d = k * n - b;
    const total = a * n + b;
    const askPeople = Math.random() < 0.5;
    return {
      q: `何人かの子どもにみかんを配ります。1 人に ${a} 個ずつ配ると ${b} 個余り、1 人に ${c} 個ずつ配ると ${d} 個足りません。` +
        `${askPeople ? '子どもは何人いますか。' : 'みかんは全部で何個ありますか。'}`,
      ans: R(askPeople ? n : total), unit: askPeople ? '人' : '個',
      exp: `1 人あたり ${c} − ${a} = ${k} 個多く配ると、必要な数は ${b} + ${d} = ${b + d} 個増えます。\n` +
        `子どもの数：${b + d} ÷ ${k} = ${n} 人` + (askPeople ? '' : `\nみかんの数：${a} × ${n} + ${b} = ${total} 個`),
    };
  }

  function age() {
    return retry(() => {
      const C = ri(3, 12), x = ri(1, 15), m = pick([2, 3, 4]);
      const F = m * (C + x) - x;
      if (F < 28 || F > 50 || F - C < 24) return null;
      return {
        q: `現在、父は ${F} 才、子どもは ${C} 才です。父の年れいが子どもの年れいの ${m} 倍になるのは何年後ですか。`,
        ans: R(x), unit: '年後',
        exp: `2 人の年れいの差 ${F} − ${C} = ${F - C} 才は、何年たっても変わりません。\n` +
          `父が子の ${m} 倍のとき、差は子の年れいの ${m} − 1 = ${m - 1} 倍にあたるので\n` +
          `そのときの子：${F - C} ÷ ${m - 1} = ${C + x} 才\n${C + x} − ${C} = ${x} 年後`,
      };
    });
  }

  function newton() {
    return retry(() => {
      const x = ri(1, 4);
      const ws = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10].filter((w) => w > x)).slice(0, 3);
      if (ws.length < 3) return null;
      const [a, b, c] = ws.sort((p, q) => p - q);
      const base = lcm(lcm(a - x, b - x), c - x);
      const N = base * ri(1, 3);
      if (N > 240) return null;
      const ta = N / (a - x), tb = N / (b - x), tc = N / (c - x);
      const askC = pick([a, c]);
      const [g1, g2, ask, tAsk] = askC === a ? [b, c, a, ta] : [a, b, c, tc];
      const t1 = N / (g1 - x), t2 = N / (g2 - x);
      return {
        q: `ある遊園地では、開園前に行列ができていて、開園後も毎分一定の人数が行列に加わります。` +
          `入場口を ${g1} か所開けると ${t1} 分で、${g2} か所開けると ${t2} 分で行列がなくなります。` +
          `入場口を ${ask} か所開けると、何分で行列がなくなりますか。（どの入場口も 1 分間に入場させる人数は同じです）`,
        ans: R(tAsk), unit: '分',
        exp: `入場口 1 か所が 1 分間に入場させる人数を ① とします。\n` +
          `${g1} か所 × ${t1} 分 = ${g1 * t1}、${g2} か所 × ${t2} 分 = ${g2 * t2}\n` +
          `差 ${g1 * t1 - g2 * t2} は、${t1} − ${t2} = ${t1 - t2} 分間に増えた人数なので、1 分に ${x}（＝①×${x}）ずつ増えます。\n` +
          `はじめの行列：${g1 * t1} − ${x} × ${t1} = ${N}\n` +
          `${ask} か所だと、1 分に ${ask} − ${x} = ${ask - x} ずつ減るので\n${N} ÷ ${ask - x} = ${tAsk} 分`,
      };
    });
  }

  function sequence() {
    const a = ri(2, 10), d = ri(2, 9), n = ri(10, 50);
    const an = a + (n - 1) * d;
    const terms = [0, 1, 2, 3, 4].map((i) => a + i * d).join('、');
    if (Math.random() < 0.5) {
      return {
        q: `次のように、ある規則にしたがって数が並んでいます。\n${terms}、…\nはじめから数えて ${n} 番目の数はいくつですか。`,
        ans: R(an),
        exp: `${d} ずつ増えています。${n} 番目は、はじめの数に ${d} を (${n} − 1) 回たした数なので\n${a} + ${d} × ${n - 1} = ${an}`,
      };
    }
    const sum = n * (a + an) / 2;
    return {
      q: `次のように、ある規則にしたがって数が並んでいます。\n${terms}、…\nはじめから ${n} 番目の数までの和はいくつですか。`,
      ans: R(sum),
      exp: `${n} 番目の数：${a} + ${d} × ${n - 1} = ${an}\n和 ＝（はじめの数＋終わりの数）× 個数 ÷ 2\n` +
        `(${a} + ${an}) × ${n} ÷ 2 = ${sum}`,
    };
  }

  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  function weekday() {
    return retry(() => {
      const m1 = ri(1, 9), d1 = ri(1, DAYS[m1 - 1]);
      const m2 = ri(m1 + 1, 12), d2 = ri(1, DAYS[m2 - 1]);
      const w = ri(0, 6);
      let diff = DAYS[m1 - 1] - d1;
      for (let m = m1 + 1; m < m2; m++) diff += DAYS[m - 1];
      diff += d2;
      if (diff < 40) return null;
      const ans = WEEK[(w + diff) % 7] + '曜日';
      return {
        q: `うるう年ではないある年の ${m1} 月 ${d1} 日は${WEEK[w]}曜日です。同じ年の ${m2} 月 ${d2} 日は何曜日ですか。`,
        ans,
        choices: WEEK.map((s) => s + '曜日'),
        exp: `${m1} 月 ${d1} 日から ${m2} 月 ${d2} 日までは ${diff} 日後です。\n` +
          `(${m1} 月の残り ${DAYS[m1 - 1] - d1} 日` +
          (m2 - m1 > 1 ? ` ＋ 間の月の日数` : '') + ` ＋ ${d2} 日)\n` +
          `${diff} ÷ 7 = ${Math.floor(diff / 7)} あまり ${diff % 7}\n${WEEK[w]}曜日の ${diff % 7} 日後なので ${ans}`,
      };
    });
  }

  /* ───────── 数の性質・場合の数 ───────── */

  function divisors() {
    return retry(() => {
      const e = [ri(0, 4), ri(0, 3), ri(0, 2), ri(0, 1)];
      const ps = [2, 3, 5, 7];
      const N = ps.reduce((acc, p, i) => acc * Math.pow(p, e[i]), 1);
      if (N < 24 || N > 500) return null;
      const cnt = e.reduce((acc, x) => acc * (x + 1), 1);
      if (cnt < 6) return null;
      const fac = ps.map((p, i) => (e[i] ? (e[i] > 1 ? `${p}^${e[i]}`.replace(/\^(\d)/, (_, k) => '⁰¹²³⁴⁵'[k]) : `${p}`) : null))
        .filter(Boolean).join(' × ');
      const list = [];
      for (let k = 1; k <= N; k++) if (N % k === 0) list.push(k);
      return {
        q: `${N} の約数は全部で何個ありますか。`,
        ans: R(cnt), unit: '個',
        exp: `${N} = ${fac}\n約数：${list.join('、')}\n全部で ${cnt} 個\n` +
          `（素因数分解の指数にそれぞれ 1 をたしてかけると求められます）`,
      };
    });
  }

  function notDivisible() {
    return retry(() => {
      const N = ri(100, 300), a = pick([2, 3, 4, 5, 6, 7]), b = pick([3, 4, 5, 6, 7, 8, 9]);
      if (a >= b || b % a === 0) return null;
      const L = lcm(a, b);
      const na = Math.floor(N / a), nb = Math.floor(N / b), nl = Math.floor(N / L);
      const ans = N - na - nb + nl;
      return {
        q: `1 から ${N} までの整数のうち、${a} でも ${b} でも割り切れない数は何個ありますか。`,
        ans: R(ans), unit: '個',
        exp: `${a} で割り切れる数：${N} ÷ ${a} = ${na} 個（あまりは切り捨て）\n` +
          `${b} で割り切れる数：${N} ÷ ${b} = ${nb} 個\n` +
          `${a} でも ${b} でも割り切れる数（${L} の倍数）：${N} ÷ ${L} = ${nl} 個\n` +
          `${a} または ${b} で割り切れる数：${na} + ${nb} − ${nl} = ${na + nb - nl} 個\n` +
          `${N} − ${na + nb - nl} = ${ans} 個`,
      };
    });
  }

  function tiles() {
    if (Math.random() < 0.5) {
      return retry(() => {
        const a = ri(4, 15), b = ri(4, 15);
        if (a >= b || b % a === 0) return null;
        const L = lcm(a, b);
        if (L > 120) return null;
        const cnt = (L / a) * (L / b);
        const askSide = Math.random() < 0.5;
        return {
          q: `たて ${a}cm、横 ${b}cm の長方形のタイルを同じ向きにすき間なく並べて、できるだけ小さい正方形をつくります。` +
            (askSide ? '正方形の 1 辺は何 cm ですか。' : 'タイルは何枚必要ですか。'),
          ans: R(askSide ? L : cnt), unit: askSide ? 'cm' : '枚',
          exp: `正方形の 1 辺は ${a} と ${b} の最小公倍数で ${L}cm\n` +
            `たてに ${L} ÷ ${a} = ${L / a} 枚、横に ${L} ÷ ${b} = ${L / b} 枚` +
            (askSide ? '' : `\n${L / a} × ${L / b} = ${cnt} 枚`),
        };
      });
    }
    return retry(() => {
      const g = ri(3, 12), p = ri(2, 9), q = ri(2, 9);
      if (p >= q || gcd(p, q) !== 1) return null;
      const a = g * p, b = g * q;
      return {
        q: `たて ${a}cm、横 ${b}cm の長方形の紙を、あまりが出ないように、できるだけ大きい同じ大きさの正方形に切り分けます。` +
          `正方形は何枚できますか。`,
        ans: R(p * q), unit: '枚',
        exp: `正方形の 1 辺は ${a} と ${b} の最大公約数で ${g}cm\n${a} ÷ ${g} = ${p}、${b} ÷ ${g} = ${q}\n${p} × ${q} = ${p * q} 枚`,
      };
    });
  }

  function arrange() {
    const k = ri(0, 2);
    if (k === 0) {
      const n = ri(4, 6), zero = Math.random() < 0.5;
      const cards = zero ? [...Array(n).keys()] : [...Array(n).keys()].map((x) => x + 1);
      const ans = zero ? (n - 1) * (n - 1) * (n - 2) : n * (n - 1) * (n - 2);
      return {
        q: `${cards.join('、')} の ${n} 枚のカードから 3 枚を選んで並べ、3 けたの整数をつくります。全部で何通りできますか。`,
        ans: R(ans), unit: '通り',
        exp: zero
          ? `百の位には 0 が使えないので ${n - 1} 通り\n十の位は、残りの ${n - 1} 枚（0 をふくむ）から ${n - 1} 通り\n一の位は ${n - 2} 通り\n${n - 1} × ${n - 1} × ${n - 2} = ${ans} 通り`
          : `百の位 ${n} 通り、十の位 ${n - 1} 通り、一の位 ${n - 2} 通り\n${n} × ${n - 1} × ${n - 2} = ${ans} 通り`,
      };
    }
    if (k === 1) {
      const n = ri(4, 10);
      return {
        q: `${n} チームでサッカーのリーグ戦（どのチームとも 1 回ずつ試合をする）を行います。試合は全部で何試合ですか。`,
        ans: R(n * (n - 1) / 2), unit: '試合',
        exp: `1 チームは ${n - 1} 試合します。${n} × ${n - 1} = ${n * (n - 1)} ですが、` +
          `A 対 B と B 対 A は同じ試合なので 2 でわります。\n${n * (n - 1)} ÷ 2 = ${n * (n - 1) / 2} 試合`,
      };
    }
    const n = ri(4, 9), ordered = Math.random() < 0.5;
    return {
      q: ordered
        ? `${n} 人の中から、委員長と副委員長を 1 人ずつ選びます。選び方は何通りありますか。`
        : `${n} 人の中から、そうじ当番を 2 人選びます。選び方は何通りありますか。`,
      ans: R(ordered ? n * (n - 1) : n * (n - 1) / 2), unit: '通り',
      exp: ordered
        ? `委員長の選び方 ${n} 通り、そのそれぞれについて副委員長 ${n - 1} 通り\n${n} × ${n - 1} = ${n * (n - 1)} 通り`
        : `順番をつけて選ぶと ${n} × ${n - 1} = ${n * (n - 1)} 通り\n2 人の組は順番を区別しないので 2 でわって ${n * (n - 1) / 2} 通り`,
    };
  }

  /* ───────── 図形 ───────── */

  function polygon() {
    if (Math.random() < 0.5) {
      const n = pick([5, 6, 8, 9, 10, 12, 15, 18, 20]);
      const s = 180 * (n - 2);
      return {
        q: `正${n}角形の 1 つの内角の大きさは何度ですか。`,
        ans: R(s / n), unit: '度',
        exp: `${n} 角形の内角の和：180 × (${n} − 2) = ${s} 度\n正${n}角形なので ${s} ÷ ${n} = ${s / n} 度\n` +
          `（別解：外角は 360 ÷ ${n} = ${360 / n} 度、内角 = 180 − ${360 / n} = ${s / n} 度）`,
      };
    }
    const n = ri(5, 14);
    return {
      q: `${n} 角形の内角の和は何度ですか。`,
      ans: R(180 * (n - 2)), unit: '度',
      exp: `1 つの頂点から対角線を引くと ${n - 2} 個の三角形に分けられます。\n180 × ${n - 2} = ${180 * (n - 2)} 度`,
    };
  }

  function sector() {
    return retry(() => {
      const r = ri(2, 12), th = pick([30, 45, 60, 72, 90, 120, 135, 144, 150, 180, 240, 270]);
      const area = R(314 * r * r * th, 100 * 360);
      const arc = R(2 * r * 314 * th, 100 * 360);
      const peri = radd(arc, R(2 * r));
      if (Math.random() < 0.5) {
        if (100 % area.d !== 0) return null;
        return {
          q: `半径 ${r}cm、中心角 ${th} 度のおうぎ形の面積は何 cm² ですか。円周率は 3.14 とします。`,
          ans: area, unit: 'cm²',
          exp: `半径 × 半径 × 3.14 × 中心角/360\n${r} × ${r} × 3.14 × ${fmt(R(th, 360), { fraction: true })} = ${fmt(area)} cm²`,
        };
      }
      if (100 % peri.d !== 0) return null;
      return {
        q: `半径 ${r}cm、中心角 ${th} 度のおうぎ形のまわりの長さは何 cm ですか。円周率は 3.14 とします。`,
        ans: peri, unit: 'cm',
        exp: `曲線部分：${r * 2} × 3.14 × ${fmt(R(th, 360), { fraction: true })} = ${fmt(arc)} cm\n` +
          `半径 2 本分 ${2 * r}cm をたすのを忘れずに！\n${fmt(arc)} + ${2 * r} = ${fmt(peri)} cm`,
      };
    });
  }

  function areaVolume() {
    const k = ri(0, 2);
    if (k === 0) {
      const u = ri(2, 12), l = u + ri(2, 10), h = ri(3, 12);
      const ans = R((u + l) * h, 2);
      return {
        q: `上底 ${u}cm、下底 ${l}cm、高さ ${h}cm の台形の面積は何 cm² ですか。`,
        ans, unit: 'cm²',
        exp: `（上底＋下底）× 高さ ÷ 2\n(${u} + ${l}) × ${h} ÷ 2 = ${fmt(ans)} cm²`,
      };
    }
    if (k === 1) {
      const r = ri(2, 6), h = ri(3, 12);
      const ans = R(314 * r * r * h, 100);
      return {
        q: `底面の半径が ${r}cm、高さが ${h}cm の円柱の体積は何 cm³ ですか。円周率は 3.14 とします。`,
        ans, unit: 'cm³',
        exp: `底面積 × 高さ\n底面積：${r} × ${r} × 3.14 = ${num(r * r * 3.14)} cm²\n${num(r * r * 3.14)} × ${h} = ${fmt(ans)} cm³`,
      };
    }
    return retry(() => {
      const l = pick([20, 25, 30, 40, 50, 60]), w = pick([20, 25, 30, 40, 50]);
      const fl = pick([1, 2, 3, 4, 5]), t = ri(3, 30);
      const vol = 1000 * fl * t;
      if (vol % (l * w) !== 0) return null;
      const h = vol / (l * w);
      if (h < 10 || h > 80) return null;
      return {
        q: `内のりが、たて ${l}cm、横 ${w}cm、深さ ${h}cm の直方体の水そうがあります。` +
          `空の水そうに毎分 ${fl}L の割合で水を入れると、何分でいっぱいになりますか。`,
        ans: R(t), unit: '分',
        exp: `容積：${l} × ${w} × ${h} = ${vol} cm³\n1L = 1000 cm³ なので ${vol} cm³ = ${vol / 1000}L\n` +
          `${vol / 1000} ÷ ${fl} = ${t} 分`,
      };
    });
  }

  function triangleAngle() {
    const apex = 2 * ri(10, 70);
    const base = (180 - apex) / 2;
    if (Math.random() < 0.5) {
      return {
        q: `二等辺三角形の頂角（等しい 2 辺にはさまれた角）が ${apex} 度のとき、底角の 1 つは何度ですか。`,
        ans: R(base), unit: '度',
        exp: `三角形の内角の和は 180 度。底角 2 つは等しいので\n(180 − ${apex}) ÷ 2 = ${base} 度`,
      };
    }
    const a = ri(20, 80), b = ri(20, 80);
    return {
      q: `三角形 ABC で、角 A が ${a} 度、角 B が ${b} 度のとき、角 C の外角（辺 BC を C の方にのばしてできる角）は何度ですか。`,
      ans: R(a + b), unit: '度',
      exp: `三角形の外角は、となり合わない 2 つの内角の和に等しくなります。\n${a} + ${b} = ${a + b} 度`,
    };
  }

  global.MATH = {
    id: 'math',
    name: '算数',
    icon: '🔢',
    color: 'var(--c-math)',
    cats: [
      { id: 'calc', name: '計算・逆算', gens: [calcMixed, calcDistrib, inverse, fraction] },
      { id: 'ratio', name: '割合と比', gens: [concentration, profit, work, average, ratioShare] },
      { id: 'speed', name: '速さ', gens: [traveler, train, river, clock, roundTrip, unitConv] },
      { id: 'special', name: '特殊算', gens: [trees, turtle, excessShort, age, newton, sequence, weekday] },
      { id: 'number', name: '数の性質・場合の数', gens: [divisors, notDivisible, tiles, arrange] },
      { id: 'figure', name: '図形', gens: [polygon, sector, areaVolume, triangleAngle] },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
