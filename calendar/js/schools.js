// 志望校のプリセット（日程の目安）。
// verified: true … 学校の公式サイト（募集要項）で確認した日程。checked は確認した日
// verified: false … 公式サイトをまだ確認できていない（第三者サイトの情報）。アプリで「未確認」と表示する
(function (g) {
  g.SCHOOL_PRESETS = [
    {
      id: 'tokai', name: '東海中学校', area: '名古屋市東区（男子）', year: 2027,
      verified: false,
      source: '第三者の過去問サイト（公式サイトに接続できず未確認）',
      url: 'https://www.tokai-jh.ed.jp/',
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
      verified: true, checked: '2026-11-08',
      source: '愛知中学校 公式「令和9年度 生徒募集要項」',
      url: 'https://www.aichi-h.ed.jp/jh/application-guideline/',
      events: {
        apply_start: { date: '2026-12-24', time: '', note: 'ネット出願（マイページは12/1から作れる）・受験料15,000円' },
        apply_end: { date: '2027-01-12', time: '12:00', note: 'ネット出願 締切（最終日は12:00まで）' },
        exam: { date: '2027-01-23', time: '08:50', note: '8:50までに着席・会場：愛知学院大学 名城公園キャンパス' },
        result: { date: '2027-01-26', time: '10:00', note: '学校ホームページで発表' },
        pay: { date: '2027-02-12', time: '12:00', note: '入学手続き＝入学金200,000円の納入（クレジット・コンビニ・ペイジー）' },
        brief: { date: '2027-02-13', time: '10:00', note: '入学予定者への説明会（保護者同伴）。欠席すると入学の意思がないとみなされる' },
      },
    },
    {
      id: 'shukutoku', name: '愛知淑徳中学校', area: '名古屋市千種区（女子）', year: 2027,
      verified: false,
      source: '愛知県私学協会の日程一覧（第三者サイト経由・公式サイト未確認）',
      events: {
        apply_end: { date: '2027-01-22', time: '', note: '出願締切' },
        exam: { date: '2027-01-31', time: '', note: '' },
        result: { date: '2027-02-03', time: '', note: '' },
      },
    },
  ];
})(globalThis);
