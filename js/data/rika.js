/* 理科：分野の定義
 *   lv: 2=標準 3=発展（難関校レベル）。直前期向けに ★（基本）の問題は入れていない
 *   選択式: c[0] が正解（選択肢は自動でシャッフル）
 *   記述式: a に正解として認める答え（ひらがな可）
 *   すべて選ぶ: c が選択肢、ok が正解（すべて）
 *   計算（数値）: n が正解の数、unit が単位
 *   計算問題の自動生成は calc.js（gens）
 */
(function (global) {
  'use strict';
  global.RIKA = {
    id: 'rika',
    name: '理科',
    icon: '🔬',
    color: 'var(--c-sci)',
    cats: [
      { id: 'shokubutsu', name: '植物', note: '生物' },
      { id: 'dobutsu', name: '動物・生き物のつながり', note: '生物' },
      { id: 'jintai', name: '人のからだ', note: '生物' },
      { id: 'tentai', name: '太陽・月・星', note: '地学' },
      { id: 'kisho', name: '天気・気象', note: '地学' },
      { id: 'daichi', name: '地層・火山・地震', note: '地学' },
      { id: 'chikara', name: 'てこ・ばね・滑車・浮力', note: '物理' },
      { id: 'denki', name: '電気と磁石', note: '物理' },
      { id: 'hikari', name: '光・音・熱', note: '物理' },
      { id: 'tokekata', name: 'もののとけ方・水の変化', note: '化学' },
      { id: 'suiyoeki', name: '水よう液・中和', note: '化学' },
      { id: 'kitai', name: '気体・燃焼', note: '化学' },
      { id: 'kigu', name: '実験器具・観察', note: '実験' },
    ],
    bank: [],
  };
})(typeof window !== 'undefined' ? window : globalThis);
