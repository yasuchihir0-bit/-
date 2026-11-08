// 志望校のプリセット（日程の目安）。
// ※ 公開情報（愛知県私学協会の日程一覧などをもとにした第三者サイト）から入れた「目安」です。
//    必ず各校の募集要項で確認し、ちがっていたらアプリの「編集」で直してください。
(function (g) {
  g.SCHOOL_PRESETS = [
    {
      id: 'tokai', name: '東海中学校', area: '名古屋市東区（男子）', year: 2027,
      source: '第三者の過去問サイト（2027年度）',
      events: {
        apply_start: { date: '2027-01-13', time: '10:00', note: 'インターネット出願 開始' },
        apply_end: { date: '2027-01-20', time: '', note: 'インターネット出願 締切' },
        docs: { date: '2027-01-22', time: '', note: '提出書類 郵送必着' },
        exam: { date: '2027-02-06', time: '', note: '' },
        result: { date: '2027-02-09', time: '10:00', note: 'マイページで発表' },
        proc: { date: '2027-02-11', time: '12:00', note: '手続き期間 2/9〜2/11 正午' },
      },
    },
    {
      id: 'aichi', name: '愛知中学校', area: '名古屋市千種区（共学）', year: 2027,
      source: '愛知県私学協会「令和9(2027)年度 愛知県私立中学校入試日程一覧」（第三者サイト経由）',
      events: {
        apply_end: { date: '2027-01-12', time: '12:00', note: '出願締切' },
        exam: { date: '2027-01-23', time: '', note: '' },
        result: { date: '2027-01-26', time: '', note: '' },
      },
    },
    {
      id: 'shukutoku', name: '愛知淑徳中学校', area: '名古屋市千種区（女子）', year: 2027,
      source: '愛知県私学協会「令和9(2027)年度 愛知県私立中学校入試日程一覧」（第三者サイト経由）',
      events: {
        apply_end: { date: '2027-01-22', time: '', note: '出願締切' },
        exam: { date: '2027-01-31', time: '', note: '' },
        result: { date: '2027-02-03', time: '', note: '' },
      },
    },
  ];
})(globalThis);
