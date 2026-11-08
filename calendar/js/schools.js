// 志望校リスト（東海3県の私立中学・2027年度入試）。tools/build_schools.py で作成。
// events の third: true は、公式で確かめられず第三者サイトの情報を入れた項目。
(function (g) {
  g.SCHOOL_PRESETS = [
 {
  "id": "aichi",
  "school": "愛知中学校",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://www.aichi-h.ed.jp/jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   },
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.aichi-h.ed.jp/jh/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-24",
    "time": "",
    "note": "ネット出願（マイページは12/1から作れる）・受験料15,000円"
   },
   "apply_end": {
    "date": "2027-01-12",
    "time": "12:00",
    "note": "ネット出願 締切（最終日は12:00まで）"
   },
   "exam": {
    "date": "2027-01-23",
    "time": "08:50",
    "note": "8:50までに着席・会場：愛知学院大学 名城公園キャンパス"
   },
   "result": {
    "date": "2027-01-26",
    "time": "10:00",
    "note": "学校ホームページで発表"
   },
   "pay": {
    "date": "2027-02-12",
    "time": "12:00",
    "note": "入学手続き＝入学金200,000円の納入（クレジット・コンビニ・ペイジー）"
   },
   "brief": {
    "date": "2027-02-13",
    "time": "10:00",
    "note": "入学予定者への説明会（保護者同伴）。欠席すると入学の意思がないとみなされる"
   }
  }
 },
 {
  "id": "aikodai-1",
  "school": "愛知工業大学名電中学校",
  "round": "第1回",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://www.aitech-j.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   },
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.aitech-j.ed.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-19",
    "time": ""
   },
   "exam": {
    "date": "2027-01-23",
    "time": "08:10",
    "note": "8:10集合・8:30開始"
   },
   "result": {
    "date": "2027-01-26",
    "time": "10:00",
    "note": "WEBで発表（奨学生合格は両試験に適用）"
   }
  }
 },
 {
  "id": "aikodai-2",
  "school": "愛知工業大学名電中学校",
  "round": "第2回",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://www.aitech-j.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   },
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.aitech-j.ed.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-19",
    "time": ""
   },
   "exam": {
    "date": "2027-01-24",
    "time": "08:10",
    "note": "8:10集合・8:30開始"
   },
   "result": {
    "date": "2027-01-26",
    "time": "10:00",
    "note": "WEBで発表（奨学生合格は両試験に適用）"
   }
  }
 },
 {
  "id": "shukutoku",
  "school": "愛知淑徳中学校",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "女子",
  "url": "https://www.aichishukutoku-h.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "WEB登録 12/1〜1/20、願書等は 1/7〜1/22 に郵送"
   },
   "apply_end": {
    "date": "2027-01-20",
    "time": "",
    "note": "WEB登録の締切"
   },
   "docs": {
    "date": "2027-01-22",
    "time": "",
    "note": "願書等の郵送（1/7〜1/22）"
   },
   "exam": {
    "date": "2027-01-31",
    "time": ""
   },
   "result": {
    "date": "2027-02-03",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kinjo-1",
  "school": "金城学院中学校",
  "round": "思考力入試",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "女子",
  "url": "https://www.hs.kinjo-u.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-21",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": "",
    "note": "必要書類・調査書は郵送（調査書は1/8消印有効・簡易書留）"
   },
   "exam": {
    "date": "2027-01-16",
    "time": "",
    "note": "算数基礎テスト・思考力テスト・本人面接"
   },
   "result": {
    "date": "2027-01-19",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kinjo-2",
  "school": "金城学院中学校",
  "round": "四科・英語利用入試",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "女子",
  "url": "https://www.hs.kinjo-u.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-21",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": "",
    "note": "必要書類・調査書は郵送（調査書は1/8消印有効・簡易書留）"
   },
   "exam": {
    "date": "2027-01-23",
    "time": ""
   },
   "result": {
    "date": "2027-01-26",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "sugiyama",
  "school": "椙山女学園中学校",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "女子",
  "url": "https://www.sugiyama-u.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-05",
    "time": "",
    "note": "出願登録はWEB、願書は郵送"
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": ""
   },
   "exam": {
    "date": "2027-01-17",
    "time": ""
   },
   "result": {
    "date": "2027-01-20",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seisa-1",
  "school": "星槎名古屋中学校",
  "round": "第1回",
  "pref": "愛知",
  "city": "名古屋市中村区",
  "gender": "共学",
  "url": "https://seisa-nagoyajh.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-11-25",
    "time": "",
    "note": "郵送（簡易書留）のみ・期間内必着"
   },
   "apply_end": {
    "date": "2026-12-24",
    "time": ""
   },
   "exam": {
    "date": "2027-01-16",
    "time": "",
    "note": "国・算、本人と保護者の面接"
   },
   "result": {
    "date": "2027-01-22",
    "time": "",
    "note": "合否通知を郵送"
   }
  }
 },
 {
  "id": "seisa-2",
  "school": "星槎名古屋中学校",
  "round": "第2回",
  "pref": "愛知",
  "city": "名古屋市中村区",
  "gender": "共学",
  "url": "https://seisa-nagoyajh.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-12",
    "time": "",
    "note": "郵送（簡易書留）のみ・期間内必着"
   },
   "apply_end": {
    "date": "2027-01-22",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": "",
    "note": "国・算、本人と保護者の面接"
   },
   "result": {
    "date": "2027-02-05",
    "time": "",
    "note": "合否通知を郵送"
   }
  }
 },
 {
  "id": "tokai",
  "school": "東海中学校",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "男子",
  "url": "https://www.tokai-jh.ed.jp/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   },
   {
    "label": "第三者サイト（公式未確認）",
    "official": false
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-13",
    "time": "10:00",
    "note": "WEBで出願"
   },
   "apply_end": {
    "date": "2027-01-20",
    "time": ""
   },
   "docs": {
    "date": "2027-01-22",
    "time": "",
    "note": "入学志願票・調査書の郵送（必着）"
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-09",
    "time": "",
    "note": "WEBで発表"
   },
   "proc": {
    "date": "2027-02-11",
    "time": "12:00",
    "note": "手続き期間 2/9〜2/11 正午・入学金200,000円（第三者サイトの情報）",
    "third": true
   }
  }
 },
 {
  "id": "nagoya-1",
  "school": "名古屋中学校",
  "round": "グローバル入試",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "男子",
  "url": "https://www.meigaku.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-21",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-15",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": "",
    "note": "面接あり"
   },
   "result": {
    "date": "2027-02-02",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "nagoya-2",
  "school": "名古屋中学校",
  "round": "一般入試",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "男子",
  "url": "https://www.meigaku.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-06",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-25",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": ""
   },
   "result": {
    "date": "2027-02-02",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "aoi-1",
  "school": "名古屋葵大学中学校",
  "round": "推薦・一般（A）",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "共学",
  "url": "https://www.nagoya-aoi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-14",
    "time": "",
    "note": "WEB出願・必要書類は郵送"
   },
   "apply_end": {
    "date": "2027-01-06",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": ""
   },
   "result": {
    "date": "2027-01-13",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "aoi-2",
  "school": "名古屋葵大学中学校",
  "round": "特奨",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "共学",
  "url": "https://www.nagoya-aoi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-14",
    "time": "",
    "note": "WEB出願・必要書類は郵送"
   },
   "apply_end": {
    "date": "2027-01-06",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-13",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "aoi-3",
  "school": "名古屋葵大学中学校",
  "round": "一般（B）",
  "pref": "愛知",
  "city": "名古屋市東区",
  "gender": "共学",
  "url": "https://www.nagoya-aoi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-18",
    "time": "",
    "note": "WEB出願・必要書類は郵送"
   },
   "apply_end": {
    "date": "2027-02-04",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "ichimura-1",
  "school": "名古屋経済大学市邨中学校",
  "round": "みらい",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://ichimura.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "ichimura-2",
  "school": "名古屋経済大学市邨中学校",
  "round": "一般 A日程",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://ichimura.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "ichimura-3",
  "school": "名古屋経済大学市邨中学校",
  "round": "一般 B日程",
  "pref": "愛知",
  "city": "名古屋市千種区",
  "gender": "共学",
  "url": "https://ichimura.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "takakura-1",
  "school": "名古屋経済大学高蔵中学校",
  "round": "一般A日程・自己推薦",
  "pref": "愛知",
  "city": "名古屋市瑞穂区",
  "gender": "共学",
  "url": "https://www.takakura-hj.info/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送又は持参"
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "takakura-2",
  "school": "名古屋経済大学高蔵中学校",
  "round": "一般B日程",
  "pref": "愛知",
  "city": "名古屋市瑞穂区",
  "gender": "共学",
  "url": "https://www.takakura-hj.info/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送又は持参"
   },
   "apply_end": {
    "date": "2027-01-28",
    "time": ""
   },
   "exam": {
    "date": "2027-01-31",
    "time": ""
   },
   "result": {
    "date": "2027-02-01",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kokusai-1",
  "school": "名古屋国際中学校",
  "round": "A入試",
  "pref": "愛知",
  "city": "名古屋市昭和区",
  "gender": "共学",
  "url": "https://www.nihs.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2026-12-25",
    "time": "",
    "note": "私学協会の一覧は12/25、募集要項のまとめは1/3（要確認）"
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kokusai-2",
  "school": "名古屋国際中学校",
  "round": "B入試",
  "pref": "愛知",
  "city": "名古屋市昭和区",
  "gender": "共学",
  "url": "https://www.nihs.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": "",
    "note": "国・算・英"
   },
   "result": {
    "date": "2027-01-13",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kokusai-3",
  "school": "名古屋国際中学校",
  "round": "グローバル入試",
  "pref": "愛知",
  "city": "名古屋市昭和区",
  "gender": "共学",
  "url": "https://www.nihs.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-04",
    "time": "",
    "note": "WEB出願・必要書類は郵送または持参"
   },
   "apply_end": {
    "date": "2027-01-15",
    "time": ""
   },
   "exam": {
    "date": "2027-01-17",
    "time": "",
    "note": "国・算、本人と保護者の面接"
   },
   "result": {
    "date": "2027-01-21",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "nanzan_m",
  "school": "南山中学校 男子部",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市昭和区",
  "gender": "男子",
  "url": "https://www.nanzan-boys.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-07",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-15",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-07",
    "time": "",
    "note": "郵送（発送日）"
   }
  }
 },
 {
  "id": "nanzan_f",
  "school": "南山中学校 女子部",
  "round": "",
  "pref": "愛知",
  "city": "名古屋市昭和区",
  "gender": "女子",
  "url": "https://www.nanzan-girls.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-04",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-15",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": ""
   },
   "result": {
    "date": "2027-01-31",
    "time": "",
    "note": "郵送（発送日）"
   }
  }
 },
 {
  "id": "seijo-1",
  "school": "星城中学校",
  "round": "Ⅰ期A日程",
  "pref": "愛知",
  "city": "豊明市",
  "gender": "共学",
  "url": "https://seijoh-jr.ne.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-20",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-03",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-07",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seijo-2",
  "school": "星城中学校",
  "round": "Ⅰ期B日程",
  "pref": "愛知",
  "city": "豊明市",
  "gender": "共学",
  "url": "https://seijoh-jr.ne.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-20",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-14",
    "time": ""
   },
   "exam": {
    "date": "2027-01-16",
    "time": ""
   },
   "result": {
    "date": "2027-01-18",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seijo-3",
  "school": "星城中学校",
  "round": "Ⅱ期",
  "pref": "愛知",
  "city": "豊明市",
  "gender": "共学",
  "url": "https://seijoh-jr.ne.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-24",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-02-05",
    "time": ""
   },
   "exam": {
    "date": "2027-02-07",
    "time": ""
   },
   "result": {
    "date": "2027-02-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seirinkan-1",
  "school": "清林館中学校",
  "round": "専願選抜",
  "pref": "愛知",
  "city": "愛西市",
  "gender": "共学",
  "url": "https://www.seirinkan.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-09",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送（期間内必着）または持参"
   },
   "apply_end": {
    "date": "2026-12-25",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seirinkan-2",
  "school": "清林館中学校",
  "round": "適性検査型選抜",
  "pref": "愛知",
  "city": "愛西市",
  "gender": "共学",
  "url": "https://www.seirinkan.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-09",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送（期間内必着）または持参"
   },
   "apply_end": {
    "date": "2026-12-25",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seirinkan-3",
  "school": "清林館中学校",
  "round": "一般選抜Ⅰ",
  "pref": "愛知",
  "city": "愛西市",
  "gender": "共学",
  "url": "https://www.seirinkan.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-09",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送（期間内必着）または持参"
   },
   "apply_end": {
    "date": "2026-12-25",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seirinkan-4",
  "school": "清林館中学校",
  "round": "一般選抜Ⅱ",
  "pref": "愛知",
  "city": "愛西市",
  "gender": "共学",
  "url": "https://www.seirinkan.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-09",
    "time": "",
    "note": "出願登録はWEB、必要書類は郵送（期間内必着）または持参"
   },
   "apply_end": {
    "date": "2027-01-06",
    "time": ""
   },
   "exam": {
    "date": "2027-01-09",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "seirei-1",
  "school": "聖霊中学校",
  "round": "VAP選考",
  "pref": "愛知",
  "city": "瀬戸市",
  "gender": "女子",
  "url": "https://www.seto-seirei-js.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2026-12-07",
    "time": "12:00"
   },
   "docs": {
    "date": "2026-12-08",
    "time": "",
    "note": "出願書類の郵送（必着）"
   },
   "exam": {
    "date": "2027-01-09",
    "time": "",
    "note": "記述式の総合問題"
   },
   "result": {
    "date": "2027-01-10",
    "time": "",
    "note": "郵送（発送日）"
   }
  }
 },
 {
  "id": "seirei-2",
  "school": "聖霊中学校",
  "round": "学科試験選考",
  "pref": "愛知",
  "city": "瀬戸市",
  "gender": "女子",
  "url": "https://www.seto-seirei-js.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-09",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2026-12-17",
    "time": "12:00"
   },
   "exam": {
    "date": "2027-01-16",
    "time": ""
   },
   "result": {
    "date": "2027-01-19",
    "time": "",
    "note": "郵送（発送日）"
   }
  }
 },
 {
  "id": "taisei-1",
  "school": "大成中学校",
  "round": "適性検査型",
  "pref": "愛知",
  "city": "一宮市",
  "gender": "共学",
  "url": "https://www.aichi-shinwa-taisei.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "WEB出願・必要書類は郵送または窓口"
   },
   "apply_end": {
    "date": "2026-12-25",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": ""
   },
   "result": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "taisei-2",
  "school": "大成中学校",
  "round": "特別選抜（4科・英語・専願2科・専願かがやき）",
  "pref": "愛知",
  "city": "一宮市",
  "gender": "共学",
  "url": "https://www.aichi-shinwa-taisei.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "WEB出願・必要書類は郵送または窓口"
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": ""
   },
   "result": {
    "date": "2027-01-13",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "taisei-3",
  "school": "大成中学校",
  "round": "一般（4科・専願2科・専願スポーツ）",
  "pref": "愛知",
  "city": "一宮市",
  "gender": "共学",
  "url": "https://www.aichi-shinwa-taisei.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "WEB出願・必要書類は郵送または窓口"
   },
   "apply_end": {
    "date": "2027-01-28",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": ""
   },
   "result": {
    "date": "2027-02-02",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "taki",
  "school": "滝中学校",
  "round": "",
  "pref": "愛知",
  "city": "江南市",
  "gender": "共学",
  "url": "https://www.taki-hj.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-18",
    "time": "",
    "note": "WEB出願（願書の郵送は該当者のみ）"
   },
   "apply_end": {
    "date": "2027-01-28",
    "time": ""
   },
   "docs": {
    "date": "2027-01-22",
    "time": "",
    "note": "必要提出書類の郵送（必着）"
   },
   "exam": {
    "date": "2027-02-07",
    "time": ""
   },
   "result": {
    "date": "2027-02-09",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "haruhi-1",
  "school": "中部大学春日丘中学校",
  "round": "第1回",
  "pref": "愛知",
  "city": "春日井市",
  "gender": "共学",
  "url": "https://www.haruhigaoka.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-19",
    "time": ""
   },
   "docs": {
    "date": "2027-01-22",
    "time": "",
    "note": "必要書類の郵送（必着）"
   },
   "exam": {
    "date": "2027-01-24",
    "time": ""
   },
   "result": {
    "date": "2027-01-26",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "haruhi-2",
  "school": "中部大学春日丘中学校",
  "round": "第2回",
  "pref": "愛知",
  "city": "春日井市",
  "gender": "共学",
  "url": "https://www.haruhigaoka.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-08",
    "time": "",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-27",
    "time": ""
   },
   "docs": {
    "date": "2027-01-29",
    "time": "",
    "note": "必要書類の郵送（必着）"
   },
   "exam": {
    "date": "2027-01-31",
    "time": ""
   },
   "result": {
    "date": "2027-02-02",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "sakuragaoka-1",
  "school": "桜丘中学校（豊橋）",
  "round": "Ⅰ期（A方式）",
  "pref": "愛知",
  "city": "豊橋市",
  "gender": "共学",
  "url": "https://www.sakuragaoka-gakuen.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-25",
    "time": "",
    "note": "郵送で出願"
   },
   "apply_end": {
    "date": "2027-01-12",
    "time": ""
   },
   "exam": {
    "date": "2027-01-23",
    "time": "",
    "note": "国・算、本人と保護者の面接"
   },
   "result": {
    "date": "2027-01-26",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "sakuragaoka-2",
  "school": "桜丘中学校（豊橋）",
  "round": "Ⅱ期（B方式）",
  "pref": "愛知",
  "city": "豊橋市",
  "gender": "共学",
  "url": "https://www.sakuragaoka-gakuen.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」",
    "url": "https://www.aichi.sc/schedule/",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-25",
    "time": "",
    "note": "郵送で出願"
   },
   "apply_end": {
    "date": "2027-01-28",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": "",
    "note": "国・算・英、本人と保護者の面接"
   },
   "result": {
    "date": "2027-02-09",
    "time": "",
    "note": "WEBで発表"
   }
  }
 },
 {
  "id": "kaiyo-1",
  "school": "海陽中等教育学校",
  "round": "特別給費生入試",
  "pref": "愛知",
  "city": "蒲郡市",
  "gender": "男子",
  "url": "https://www.kaiyo.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.kaiyo.ac.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-11-23",
    "time": "00:00",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2026-12-09",
    "time": "15:00"
   },
   "exam": {
    "date": "2026-12-12",
    "time": ""
   },
   "result": {
    "date": "2026-12-14",
    "time": "12:00"
   },
   "proc": {
    "date": "2026-12-16",
    "time": "15:00",
    "note": "一次入学手続期限。最終入学手続期限 2/9(火) 15:00"
   },
   "pay": {
    "date": "2027-02-09",
    "time": "15:00",
    "note": "最終入学手続期限"
   }
  }
 },
 {
  "id": "kaiyo-2",
  "school": "海陽中等教育学校",
  "round": "入試Ⅰ",
  "pref": "愛知",
  "city": "蒲郡市",
  "gender": "男子",
  "url": "https://www.kaiyo.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.kaiyo.ac.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-11-23",
    "time": "00:00",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2026-12-16",
    "time": "15:00"
   },
   "exam": {
    "date": "2026-12-19",
    "time": ""
   },
   "result": {
    "date": "2026-12-21",
    "time": "12:00"
   },
   "proc": {
    "date": "2026-12-23",
    "time": "15:00",
    "note": "一次入学手続期限。最終入学手続期限 2/9(火) 15:00"
   },
   "pay": {
    "date": "2027-02-09",
    "time": "15:00",
    "note": "最終入学手続期限"
   }
  }
 },
 {
  "id": "kaiyo-3",
  "school": "海陽中等教育学校",
  "round": "入試Ⅱ",
  "pref": "愛知",
  "city": "蒲郡市",
  "gender": "男子",
  "url": "https://www.kaiyo.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.kaiyo.ac.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-11-23",
    "time": "00:00",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-03",
    "time": "15:00"
   },
   "exam": {
    "date": "2027-01-06",
    "time": "",
    "note": "午前"
   },
   "result": {
    "date": "2027-01-08",
    "time": "12:00"
   },
   "proc": {
    "date": "2027-01-12",
    "time": "15:00",
    "note": "一次入学手続期限。最終入学手続期限 2/9(火) 15:00"
   },
   "pay": {
    "date": "2027-02-09",
    "time": "15:00",
    "note": "最終入学手続期限"
   }
  }
 },
 {
  "id": "kaiyo-4",
  "school": "海陽中等教育学校",
  "round": "視聴型入試",
  "pref": "愛知",
  "city": "蒲郡市",
  "gender": "男子",
  "url": "https://www.kaiyo.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.kaiyo.ac.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-11-23",
    "time": "00:00",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-01-03",
    "time": "15:00"
   },
   "exam": {
    "date": "2027-01-06",
    "time": "",
    "note": "午後"
   },
   "result": {
    "date": "2027-01-08",
    "time": "12:00"
   },
   "proc": {
    "date": "2027-01-12",
    "time": "15:00",
    "note": "一次入学手続期限。最終入学手続期限 2/9(火) 15:00"
   },
   "pay": {
    "date": "2027-02-09",
    "time": "15:00",
    "note": "最終入学手続期限"
   }
  }
 },
 {
  "id": "kaiyo-5",
  "school": "海陽中等教育学校",
  "round": "入試Ⅲ",
  "pref": "愛知",
  "city": "蒲郡市",
  "gender": "男子",
  "url": "https://www.kaiyo.ac.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.kaiyo.ac.jp/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-06",
    "time": "00:00",
    "note": "WEB出願"
   },
   "apply_end": {
    "date": "2027-02-03",
    "time": "15:00"
   },
   "exam": {
    "date": "2027-02-05",
    "time": ""
   },
   "result": {
    "date": "2027-02-05",
    "time": "22:00",
    "note": "22:00までに発表"
   },
   "pay": {
    "date": "2027-02-09",
    "time": "15:00",
    "note": "最終入学手続期限"
   }
  }
 },
 {
  "id": "g_uguisu",
  "school": "鶯谷中学校",
  "round": "第Ⅰ期（一般・グローバル）",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "共学",
  "url": "http://uguisu.acs3.mmrs.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-14",
    "time": ""
   }
  }
 },
 {
  "id": "g_gito",
  "school": "岐阜東中学校",
  "round": "一般・専願",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "共学",
  "url": "https://www.gito.ed.jp/junior/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-08",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": ""
   },
   "result": {
    "date": "2027-01-14",
    "time": ""
   }
  }
 },
 {
  "id": "g_shotoku-1",
  "school": "岐阜聖徳学園大学附属中学校",
  "round": "前期入試",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "共学",
  "url": "https://www.shotoku.ac.jp/jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   },
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.shotoku.ac.jp/jh/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-10",
    "time": "",
    "note": "保護者と本人の面接あり"
   },
   "result": {
    "date": "2027-01-13",
    "time": ""
   },
   "proc": {
    "date": "2027-01-22",
    "time": "",
    "note": "入学手続きの締切（入学金170,000円）。奨学生資格は1/23の合格者招集日の出席が条件"
   }
  }
 },
 {
  "id": "g_shotoku-2",
  "school": "岐阜聖徳学園大学附属中学校",
  "round": "後期入試",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "共学",
  "url": "https://www.shotoku.ac.jp/jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-18",
    "time": ""
   },
   "apply_end": {
    "date": "2027-02-05",
    "time": ""
   },
   "exam": {
    "date": "2027-02-11",
    "time": "",
    "note": "保護者と本人の面接あり"
   },
   "result": {
    "date": "2027-02-15",
    "time": ""
   }
  }
 },
 {
  "id": "g_maria-1",
  "school": "聖マリア女学院中学校",
  "round": "1月入試（前期）",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "女子",
  "url": "https://www.maria.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": ""
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": ""
   }
  }
 },
 {
  "id": "g_maria-2",
  "school": "聖マリア女学院中学校",
  "round": "2月入試（後期）",
  "pref": "岐阜",
  "city": "岐阜市",
  "gender": "女子",
  "url": "https://www.maria.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-25",
    "time": ""
   },
   "apply_end": {
    "date": "2027-02-04",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-06",
    "time": ""
   }
  }
 },
 {
  "id": "g_minokamo",
  "school": "美濃加茂中学校",
  "round": "2教科型・4教科型",
  "pref": "岐阜",
  "city": "美濃加茂市",
  "gender": "共学",
  "url": "https://www.minokamo.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-14",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-13",
    "time": ""
   },
   "exam": {
    "date": "2027-01-16",
    "time": "",
    "note": "保護者と本人の面接あり"
   },
   "result": {
    "date": "2027-01-20",
    "time": ""
   }
  }
 },
 {
  "id": "g_teikyo-1",
  "school": "帝京大学可児中学校",
  "round": "1月入試",
  "pref": "岐阜",
  "city": "可児市",
  "gender": "共学",
  "url": "https://www.teikyo-kani.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-04",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-05",
    "time": ""
   },
   "exam": {
    "date": "2027-01-09",
    "time": ""
   },
   "result": {
    "date": "2027-01-14",
    "time": ""
   }
  }
 },
 {
  "id": "g_teikyo-2",
  "school": "帝京大学可児中学校",
  "round": "2月入試",
  "pref": "岐阜",
  "city": "可児市",
  "gender": "共学",
  "url": "https://www.teikyo-kani.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-18",
    "time": ""
   },
   "apply_end": {
    "date": "2027-02-03",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-10",
    "time": ""
   }
  }
 },
 {
  "id": "g_tajimi-1",
  "school": "多治見西高等学校附属中学校",
  "round": "自己推薦",
  "pref": "岐阜",
  "city": "多治見市",
  "gender": "共学",
  "url": "https://www.tajiminishi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-03",
    "time": ""
   },
   "exam": {
    "date": "2027-01-05",
    "time": ""
   },
   "result": {
    "date": "2027-01-06",
    "time": ""
   }
  }
 },
 {
  "id": "g_tajimi-2",
  "school": "多治見西高等学校附属中学校",
  "round": "第Ⅰ期",
  "pref": "岐阜",
  "city": "多治見市",
  "gender": "共学",
  "url": "https://www.tajiminishi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-06",
    "time": ""
   },
   "exam": {
    "date": "2027-01-09",
    "time": ""
   },
   "result": {
    "date": "2027-01-13",
    "time": ""
   }
  }
 },
 {
  "id": "g_tajimi-3",
  "school": "多治見西高等学校附属中学校",
  "round": "第Ⅱ期",
  "pref": "岐阜",
  "city": "多治見市",
  "gender": "共学",
  "url": "https://www.tajiminishi.ed.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-14",
    "time": ""
   },
   "apply_end": {
    "date": "2027-02-03",
    "time": ""
   },
   "exam": {
    "date": "2027-02-06",
    "time": ""
   },
   "result": {
    "date": "2027-02-08",
    "time": ""
   }
  }
 },
 {
  "id": "g_reitaku-1",
  "school": "麗澤瑞浪中学校",
  "round": "1期（専願・併願）",
  "pref": "岐阜",
  "city": "瑞浪市",
  "gender": "共学",
  "url": "https://www.mz.reitaku.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-07",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-06",
    "time": ""
   },
   "exam": {
    "date": "2027-01-09",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": ""
   }
  }
 },
 {
  "id": "g_reitaku-2",
  "school": "麗澤瑞浪中学校",
  "round": "2期",
  "pref": "岐阜",
  "city": "瑞浪市",
  "gender": "共学",
  "url": "https://www.mz.reitaku.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-13",
    "time": ""
   },
   "apply_end": {
    "date": "2027-02-08",
    "time": ""
   },
   "exam": {
    "date": "2027-02-13",
    "time": ""
   },
   "result": {
    "date": "2027-02-15",
    "time": ""
   }
  }
 },
 {
  "id": "g_seino-1",
  "school": "西濃学園中学校",
  "round": "第一次試験",
  "pref": "岐阜",
  "city": "揖斐郡揖斐川町",
  "gender": "共学",
  "url": "https://www.seino-gakuen.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-01-12",
    "time": ""
   },
   "apply_end": {
    "date": "2027-01-29",
    "time": ""
   },
   "exam": {
    "date": "2027-01-30",
    "time": "",
    "note": "作文・保護者面接・受験生面接"
   },
   "result": {
    "date": "2027-02-03",
    "time": ""
   }
  }
 },
 {
  "id": "g_seino-2",
  "school": "西濃学園中学校",
  "round": "第二次試験",
  "pref": "岐阜",
  "city": "揖斐郡揖斐川町",
  "gender": "共学",
  "url": "https://www.seino-gakuen.jp/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」",
    "url": "https://www.sigaku-gifu.or.jp/bosyuyoukou",
    "official": true
   }
  ],
  "events": {
   "apply_start": {
    "date": "2027-02-08",
    "time": ""
   },
   "apply_end": {
    "date": "2027-03-14",
    "time": ""
   },
   "exam": {
    "date": "2027-03-15",
    "time": "",
    "note": "作文・保護者面接・受験生面接"
   },
   "result": {
    "date": "2027-03-17",
    "time": ""
   }
  }
 },
 {
  "id": "m_takada",
  "school": "高田中学校",
  "round": "",
  "pref": "三重",
  "city": "津市",
  "gender": "共学",
  "url": "https://www.mie-takada-hj.ed.jp/hj4/integrated/admission/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.mie-takada-hj.ed.jp/hj4/integrated/admission/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "09:00",
    "note": "インターネット出願・検定料14,000円"
   },
   "apply_end": {
    "date": "2026-12-08",
    "time": "15:00"
   },
   "docs": {
    "date": "2026-12-11",
    "time": "",
    "note": "調査書の提出（必着）"
   },
   "exam": {
    "date": "2027-01-10",
    "time": "08:30",
    "note": "8:30集合"
   },
   "result": {
    "date": "2027-01-13",
    "time": "16:00",
    "note": "志願者サイトで発表"
   },
   "pay": {
    "date": "2027-01-22",
    "time": "12:00",
    "note": "入学金50,000円＋施設設備整備費300,000円。期限までに納入しないと合格取り消し"
   },
   "brief": {
    "date": "2027-02-06",
    "time": "13:30",
    "note": "出校日（第1回）"
   }
  }
 },
 {
  "id": "m_akatsuki-1",
  "school": "暁中学校",
  "round": "グローバル育成選抜入試（専願）",
  "pref": "三重",
  "city": "四日市市",
  "gender": "共学",
  "url": "https://www.akatsuki.ed.jp/akatsuki-jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.akatsuki.ed.jp/akatsuki-jh/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "インターネット出願"
   },
   "apply_end": {
    "date": "2026-12-21",
    "time": ""
   },
   "exam": {
    "date": "2027-01-06",
    "time": "08:30"
   },
   "result": {
    "date": "2027-01-07",
    "time": "16:00",
    "note": "インターネットで発表"
   },
   "pay": {
    "date": "2027-01-22",
    "time": "",
    "note": "入学金45,000円・教育充実費250,000円"
   }
  }
 },
 {
  "id": "m_akatsuki-2",
  "school": "暁中学校",
  "round": "前期（一般・専願）",
  "pref": "三重",
  "city": "四日市市",
  "gender": "共学",
  "url": "https://www.akatsuki.ed.jp/akatsuki-jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.akatsuki.ed.jp/akatsuki-jh/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "インターネット出願"
   },
   "apply_end": {
    "date": "2027-01-05",
    "time": ""
   },
   "exam": {
    "date": "2027-01-09",
    "time": "08:30"
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "インターネットで発表"
   },
   "pay": {
    "date": "2027-01-22",
    "time": "",
    "note": "入学金45,000円・教育充実費250,000円"
   }
  }
 },
 {
  "id": "m_akatsuki-3",
  "school": "暁中学校",
  "round": "後期",
  "pref": "三重",
  "city": "四日市市",
  "gender": "共学",
  "url": "https://www.akatsuki.ed.jp/akatsuki-jh/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://www.akatsuki.ed.jp/akatsuki-jh/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "インターネット出願"
   },
   "apply_end": {
    "date": "2027-01-14",
    "time": ""
   },
   "exam": {
    "date": "2027-01-16",
    "time": "08:30",
    "note": "国語・算数"
   },
   "result": {
    "date": "2027-01-18",
    "time": "18:00",
    "note": "インターネットで発表"
   },
   "pay": {
    "date": "2027-01-22",
    "time": "",
    "note": "入学金45,000円・教育充実費250,000円"
   }
  }
 },
 {
  "id": "m_tsuda-1",
  "school": "津田学園中学校",
  "round": "専願入試",
  "pref": "三重",
  "city": "桑名市",
  "gender": "共学",
  "url": "https://tsudagakuen.ac.jp/chugaku/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://tsudagakuen.ac.jp/chugaku/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "窓口または郵送（郵送は12/21消印有効）"
   },
   "apply_end": {
    "date": "2026-12-23",
    "time": "",
    "note": "窓口の締切"
   },
   "exam": {
    "date": "2026-12-26",
    "time": ""
   },
   "result": {
    "date": "2026-12-28",
    "time": "",
    "note": "本人宛に郵送"
   }
  }
 },
 {
  "id": "m_tsuda-2",
  "school": "津田学園中学校",
  "round": "一般入試",
  "pref": "三重",
  "city": "桑名市",
  "gender": "共学",
  "url": "https://tsudagakuen.ac.jp/chugaku/",
  "checked": "2026-11-08",
  "verified": true,
  "sources": [
   {
    "label": "学校公式サイトの令和9年度 募集要項",
    "official": true,
    "url": "https://tsudagakuen.ac.jp/chugaku/"
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "note": "窓口または郵送（郵送は1/5消印有効）"
   },
   "apply_end": {
    "date": "2027-01-07",
    "time": "",
    "note": "窓口の締切"
   },
   "exam": {
    "date": "2027-01-11",
    "time": ""
   },
   "result": {
    "date": "2027-01-12",
    "time": "",
    "note": "本人宛に郵送。手続きの期日は合格通知で知らされる"
   }
  }
 },
 {
  "id": "m_mie",
  "school": "三重中学校",
  "round": "一般選考",
  "pref": "三重",
  "city": "松阪市",
  "gender": "共学",
  "url": "https://www.mie-mie-h.ed.jp/junior/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [
   {
    "label": "第三者サイト（公式未確認）",
    "official": false
   }
  ],
  "events": {
   "apply_start": {
    "date": "2026-12-01",
    "time": "",
    "third": true
   },
   "apply_end": {
    "date": "2027-01-04",
    "time": "",
    "third": true
   },
   "exam": {
    "date": "2027-01-10",
    "time": "",
    "third": true
   },
   "result": {
    "date": "2027-01-13",
    "time": "",
    "third": true
   }
  }
 },
 {
  "id": "m_maryknoll",
  "school": "四日市メリノール学院中学校",
  "round": "",
  "pref": "三重",
  "city": "四日市市",
  "gender": "共学",
  "url": "https://www.maryknoll.ed.jp/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 },
 {
  "id": "m_kaisei",
  "school": "海星中学校",
  "round": "",
  "pref": "三重",
  "city": "四日市市",
  "gender": "共学",
  "url": "https://www.kaisei.ed.jp/jounior/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 },
 {
  "id": "m_suzuka",
  "school": "鈴鹿中等教育学校",
  "round": "",
  "pref": "三重",
  "city": "鈴鹿市",
  "gender": "共学",
  "url": "https://suzukakyoei.ed.jp/suzuka6/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 },
 {
  "id": "m_sjjg",
  "school": "セントヨゼフ女子学園中学校",
  "round": "",
  "pref": "三重",
  "city": "津市",
  "gender": "女子",
  "url": "https://www.sjjg.ac.jp/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 },
 {
  "id": "m_kogakkan",
  "school": "皇學館中学校",
  "round": "",
  "pref": "三重",
  "city": "伊勢市",
  "gender": "共学",
  "url": "https://www.kogakkan-j.jp/",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 },
 {
  "id": "m_sakura",
  "school": "桜丘中学校（伊賀）",
  "round": "",
  "pref": "三重",
  "city": "伊賀市",
  "gender": "共学",
  "url": "https://sakura-gaoka.ed.jp/apply/junior",
  "checked": "2026-11-08",
  "verified": false,
  "sources": [],
  "events": {}
 }
];
})(globalThis);
