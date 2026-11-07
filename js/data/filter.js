/* 直前期向け：★（基本）の問題は出題しない。★★（標準）と ★★★（東海中レベル）だけを使う。
 * データは残してあるので、このファイルを読みこまなければ ★ の問題も出題される。 */
(function (global) {
  'use strict';
  const K = global.KOKUGO;
  const keep = (lv) => (lv || 1) >= 2;
  const bank = K.bank.filter((b) => keep(b.lv));
  K.bank.length = 0;
  K.bank.push(...bank);
  // 対義語・類義語の配列は出題関数が直接参照しているので、中身だけ入れかえる
  [K.ANTONYMS, K.SYNONYMS].forEach((list) => {
    const kept = list.filter((p) => keep(p[2]));
    list.length = 0;
    list.push(...kept);
  });
})(typeof window !== 'undefined' ? window : globalThis);
