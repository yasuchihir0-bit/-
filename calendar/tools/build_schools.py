# 志望校リスト（js/schools.js）を作るスクリプト: python3 calendar/tools/build_schools.py
# 日程は「出典」ごとにまとめてある。公式の資料（私学協会・学校の募集要項）を優先し、
# 公式で確かめられなかった項目だけ第三者サイトの情報を third=True で入れる。
import json, os, re

CHECKED = '2026-11-08'

SRC = {
    'aichi_assoc': {'label': '愛知県私学協会「令和9年度 私立中学校入試日程一覧」「令和9年度入試に係る愛知県私立中学校生徒募集要項」',
                    'url': 'https://www.aichi.sc/schedule/', 'official': True},
    'gifu_assoc': {'label': '岐阜県私立中学高等学校協会「令和9年度 岐阜県私立中学校入試日程」',
                   'url': 'https://www.sigaku-gifu.or.jp/bosyuyoukou', 'official': True},
    'school': {'label': '学校公式サイトの令和9年度 募集要項', 'official': True},
    'third': {'label': '第三者サイト（公式未確認）', 'official': False},
}


def d(md, time=''):
    """'12/24' → 2026-12-24、'1/12' → 2027-01-12"""
    m, day = map(int, md.split('/'))
    y = 2026 if m >= 4 else 2027
    return {'date': f'{y}-{m:02d}-{day:02d}', 'time': time}


def ev(md, time='', note='', third=False):
    e = d(md, time)
    if note: e['note'] = note
    if third: e['third'] = True
    return e


# ---- 学校の基本情報（公式サイトは各県の私学協会の学校ページ・一覧のリンク先） ----
SCHOOLS = {
    # 愛知
    'aichi': ('愛知中学校', '愛知', '名古屋市千種区', '共学', 'https://www.aichi-h.ed.jp/jh/'),
    'aikodai': ('愛知工業大学名電中学校', '愛知', '名古屋市千種区', '共学', 'https://www.aitech-j.ed.jp/'),
    'shukutoku': ('愛知淑徳中学校', '愛知', '名古屋市千種区', '女子', 'https://www.aichishukutoku-h.jp/'),
    'kinjo': ('金城学院中学校', '愛知', '名古屋市東区', '女子', 'https://www.hs.kinjo-u.ac.jp/'),
    'sugiyama': ('椙山女学園中学校', '愛知', '名古屋市千種区', '女子', 'https://www.sugiyama-u.ac.jp/'),
    'seisa': ('星槎名古屋中学校', '愛知', '名古屋市中村区', '共学', 'https://seisa-nagoyajh.ed.jp/'),
    'tokai': ('東海中学校', '愛知', '名古屋市東区', '男子', 'https://www.tokai-jh.ed.jp/'),
    'nagoya': ('名古屋中学校', '愛知', '名古屋市東区', '男子', 'https://www.meigaku.ac.jp/'),
    'aoi': ('名古屋葵大学中学校', '愛知', '名古屋市東区', '共学', 'https://www.nagoya-aoi.ed.jp/'),
    'ichimura': ('名古屋経済大学市邨中学校', '愛知', '名古屋市千種区', '共学', 'https://ichimura.ed.jp/'),
    'takakura': ('名古屋経済大学高蔵中学校', '愛知', '名古屋市瑞穂区', '共学', 'https://www.takakura-hj.info/'),
    'kokusai': ('名古屋国際中学校', '愛知', '名古屋市昭和区', '共学', 'https://www.nihs.ed.jp/'),
    'nanzan_m': ('南山中学校 男子部', '愛知', '名古屋市昭和区', '男子', 'https://www.nanzan-boys.ed.jp/'),
    'nanzan_f': ('南山中学校 女子部', '愛知', '名古屋市昭和区', '女子', 'https://www.nanzan-girls.ed.jp/'),
    'seijo': ('星城中学校', '愛知', '豊明市', '共学', 'https://seijoh-jr.ne.jp/'),
    'seirinkan': ('清林館中学校', '愛知', '愛西市', '共学', 'https://www.seirinkan.ed.jp/'),
    'seirei': ('聖霊中学校', '愛知', '瀬戸市', '女子', 'https://www.seto-seirei-js.ed.jp/'),
    'taisei': ('大成中学校', '愛知', '一宮市', '共学', 'https://www.aichi-shinwa-taisei.ed.jp/'),
    'taki': ('滝中学校', '愛知', '江南市', '共学', 'https://www.taki-hj.ac.jp/'),
    'haruhi': ('中部大学春日丘中学校', '愛知', '春日井市', '共学', 'https://www.haruhigaoka.ed.jp/'),
    'sakuragaoka': ('桜丘中学校（豊橋）', '愛知', '豊橋市', '共学', 'https://www.sakuragaoka-gakuen.ed.jp/'),
    'kaiyo': ('海陽中等教育学校', '愛知', '蒲郡市', '男子', 'https://www.kaiyo.ac.jp/'),
    # 岐阜
    'g_uguisu': ('鶯谷中学校', '岐阜', '岐阜市', '共学', 'http://uguisu.acs3.mmrs.jp/'),
    'g_gito': ('岐阜東中学校', '岐阜', '岐阜市', '共学', 'https://www.gito.ed.jp/junior/'),
    'g_shotoku': ('岐阜聖徳学園大学附属中学校', '岐阜', '岐阜市', '共学', 'https://www.shotoku.ac.jp/jh/'),
    'g_maria': ('聖マリア女学院中学校', '岐阜', '岐阜市', '女子', 'https://www.maria.ed.jp/'),
    'g_minokamo': ('美濃加茂中学校', '岐阜', '美濃加茂市', '共学', 'https://www.minokamo.ed.jp/'),
    'g_teikyo': ('帝京大学可児中学校', '岐阜', '可児市', '共学', 'https://www.teikyo-kani.ed.jp/'),
    'g_tajimi': ('多治見西高等学校附属中学校', '岐阜', '多治見市', '共学', 'https://www.tajiminishi.ed.jp/'),
    'g_reitaku': ('麗澤瑞浪中学校', '岐阜', '瑞浪市', '共学', 'https://www.mz.reitaku.jp/'),
    'g_seino': ('西濃学園中学校', '岐阜', '揖斐郡揖斐川町', '共学', 'https://www.seino-gakuen.jp/'),
    # 三重
    'm_tsuda': ('津田学園中学校', '三重', '桑名市', '共学', 'https://tsudagakuen.ac.jp/chugaku/'),
    'm_akatsuki': ('暁中学校', '三重', '四日市市', '共学', 'https://www.akatsuki.ed.jp/akatsuki-jh/'),
    'm_maryknoll': ('四日市メリノール学院中学校', '三重', '四日市市', '共学', 'https://www.maryknoll.ed.jp/'),
    'm_kaisei': ('海星中学校', '三重', '四日市市', '共学', 'https://www.kaisei.ed.jp/jounior/'),
    'm_suzuka': ('鈴鹿中等教育学校', '三重', '鈴鹿市', '共学', 'https://suzukakyoei.ed.jp/suzuka6/'),
    'm_takada': ('高田中学校', '三重', '津市', '共学', 'https://www.mie-takada-hj.ed.jp/hj4/integrated/admission/'),
    'm_sjjg': ('セントヨゼフ女子学園中学校', '三重', '津市', '女子', 'https://www.sjjg.ac.jp/'),
    'm_mie': ('三重中学校', '三重', '松阪市', '共学', 'https://www.mie-mie-h.ed.jp/junior/'),
    'm_kogakkan': ('皇學館中学校', '三重', '伊勢市', '共学', 'https://www.kogakkan-j.jp/'),
    'm_sakura': ('桜丘中学校（伊賀）', '三重', '伊賀市', '共学', 'https://sakura-gaoka.ed.jp/apply/junior'),
}

# ---- 回ごとの日程 ----
# (school, round, srcs, {type: event})
R = []
A = ['aichi_assoc']


def add(key, rnd, srcs, **events):
    R.append((key, rnd, srcs, events))


# 愛知（私学協会の一覧：出願期間・試験日・発表日。手続き締切は一覧に無い）
add('aichi', '', A + ['school'],
    apply_start=ev('12/24', note='ネット出願（マイページは12/1から作れる）・受験料15,000円'),
    apply_end=ev('1/12', '12:00', 'ネット出願 締切（最終日は12:00まで）'),
    exam=ev('1/23', '08:50', '8:50までに着席・会場：愛知学院大学 名城公園キャンパス'),
    result=ev('1/26', '10:00', '学校ホームページで発表'),
    pay=ev('2/12', '12:00', '入学手続き＝入学金200,000円の納入（クレジット・コンビニ・ペイジー）'),
    brief=ev('2/13', '10:00', '入学予定者への説明会（保護者同伴）。欠席すると入学の意思がないとみなされる'))
for rnd, ex, extra in [('第1回', '1/23', {}), ('第2回', '1/24', {})]:
    add('aikodai', rnd, A + ['school'], apply_start=ev('1/12', note='WEB出願'), apply_end=ev('1/19'),
        exam=ev(ex, '08:10', '8:10集合・8:30開始'), result=ev('1/26', '10:00', 'WEBで発表（奨学生合格は両試験に適用）'))
add('shukutoku', '', A, apply_start=ev('12/1', note='WEB登録 12/1〜1/20、願書等は 1/7〜1/22 に郵送'),
    apply_end=ev('1/20', note='WEB登録の締切'), docs=ev('1/22', note='願書等の郵送（1/7〜1/22）'),
    exam=ev('1/31'), result=ev('2/3', note='WEBで発表'))
add('kinjo', '思考力入試', A, apply_start=ev('12/21'), apply_end=ev('1/8', note='必要書類・調査書は郵送（調査書は1/8消印有効・簡易書留）'),
    exam=ev('1/16', note='算数基礎テスト・思考力テスト・本人面接'), result=ev('1/19', note='WEBで発表'))
add('kinjo', '四科・英語利用入試', A, apply_start=ev('12/21'), apply_end=ev('1/8', note='必要書類・調査書は郵送（調査書は1/8消印有効・簡易書留）'),
    exam=ev('1/23'), result=ev('1/26', note='WEBで発表'))
add('sugiyama', '', A, apply_start=ev('1/5', note='出願登録はWEB、願書は郵送'), apply_end=ev('1/8'),
    exam=ev('1/17'), result=ev('1/20', note='WEBで発表'))
add('seisa', '第1回', A, apply_start=ev('11/25', note='郵送（簡易書留）のみ・期間内必着'), apply_end=ev('12/24'),
    exam=ev('1/16', note='国・算、本人と保護者の面接'), result=ev('1/22', note='合否通知を郵送'))
add('seisa', '第2回', A, apply_start=ev('1/12', note='郵送（簡易書留）のみ・期間内必着'), apply_end=ev('1/22'),
    exam=ev('1/30', note='国・算、本人と保護者の面接'), result=ev('2/5', note='合否通知を郵送'))
add('tokai', '', A + ['third'], apply_start=ev('1/13', '10:00', 'WEBで出願'), apply_end=ev('1/20'),
    docs=ev('1/22', note='入学志願票・調査書の郵送（必着）'), exam=ev('2/6'), result=ev('2/9', note='WEBで発表'),
    proc=ev('2/11', '12:00', '手続き期間 2/9〜2/11 正午・入学金200,000円（第三者サイトの情報）', third=True))
add('nagoya', 'グローバル入試', A, apply_start=ev('12/21', note='WEB出願'), apply_end=ev('1/15'),
    exam=ev('1/30', note='面接あり'), result=ev('2/2', note='WEBで発表'))
add('nagoya', '一般入試', A, apply_start=ev('1/6', note='WEB出願'), apply_end=ev('1/25'),
    exam=ev('1/30'), result=ev('2/2', note='WEBで発表'))
for rnd, s, e, ex, rs in [('推薦・一般（A）', '12/14', '1/6', '1/10', '1/13'), ('特奨', '12/14', '1/6', '1/11', '1/13'), ('一般（B）', '1/18', '2/4', '2/6', '2/8')]:
    add('aoi', rnd, A, apply_start=ev(s, note='WEB出願・必要書類は郵送'), apply_end=ev(e), exam=ev(ex), result=ev(rs, note='WEBで発表'))
for rnd, ex in [('みらい', '1/10'), ('一般 A日程', '1/10'), ('一般 B日程', '1/11')]:
    add('ichimura', rnd, A, apply_start=ev('12/7', note='WEB出願'), apply_end=ev('1/7'), exam=ev(ex), result=ev('1/12', note='WEBで発表'))
add('takakura', '一般A日程・自己推薦', A, apply_start=ev('12/7', note='出願登録はWEB、必要書類は郵送又は持参'), apply_end=ev('1/7'),
    exam=ev('1/11'), result=ev('1/12', note='WEBで発表'))
add('takakura', '一般B日程', A, apply_start=ev('12/7', note='出願登録はWEB、必要書類は郵送又は持参'), apply_end=ev('1/28'),
    exam=ev('1/31'), result=ev('2/1', note='WEBで発表'))
add('kokusai', 'A入試', A, apply_start=ev('12/7', note='WEB出願'), apply_end=ev('12/25', note='私学協会の一覧は12/25、募集要項のまとめは1/3（要確認）'),
    exam=ev('1/6'), result=ev('1/8', note='WEBで発表'))
add('kokusai', 'B入試', A, apply_start=ev('12/7', note='WEB出願'), apply_end=ev('1/8'), exam=ev('1/11', note='国・算・英'), result=ev('1/13', note='WEBで発表'))
add('kokusai', 'グローバル入試', A, apply_start=ev('1/4', note='WEB出願・必要書類は郵送または持参'), apply_end=ev('1/15'),
    exam=ev('1/17', note='国・算、本人と保護者の面接'), result=ev('1/21', note='WEBで発表'))
add('nanzan_m', '', A, apply_start=ev('1/7', note='WEB出願'), apply_end=ev('1/15'), exam=ev('2/6'), result=ev('2/7', note='郵送（発送日）'))
add('nanzan_f', '', A, apply_start=ev('1/4', note='WEB出願'), apply_end=ev('1/15'), exam=ev('1/30'), result=ev('1/31', note='郵送（発送日）'))
for rnd, s, e, ex, rs in [('Ⅰ期A日程', '12/20', '1/3', '1/6', '1/7'), ('Ⅰ期B日程', '12/20', '1/14', '1/16', '1/18'), ('Ⅱ期', '1/24', '2/5', '2/7', '2/8')]:
    add('seijo', rnd, A, apply_start=ev(s, note='WEB出願'), apply_end=ev(e), exam=ev(ex), result=ev(rs, note='WEBで発表'))
for rnd, e, ex, rs in [('専願選抜', '12/25', '1/6', '1/8'), ('適性検査型選抜', '12/25', '1/6', '1/8'), ('一般選抜Ⅰ', '12/25', '1/6', '1/8'), ('一般選抜Ⅱ', '1/6', '1/9', '1/12')]:
    add('seirinkan', rnd, A, apply_start=ev('12/9', note='出願登録はWEB、必要書類は郵送（期間内必着）または持参'), apply_end=ev(e), exam=ev(ex), result=ev(rs, note='WEBで発表'))
add('seirei', 'VAP選考', A, apply_start=ev('12/1', note='WEB出願'), apply_end=ev('12/7', '12:00'), docs=ev('12/8', note='出願書類の郵送（必着）'),
    exam=ev('1/9', note='記述式の総合問題'), result=ev('1/10', note='郵送（発送日）'))
add('seirei', '学科試験選考', A, apply_start=ev('12/9', note='WEB出願'), apply_end=ev('12/17', '12:00'), exam=ev('1/16'), result=ev('1/19', note='郵送（発送日）'))
add('taisei', '適性検査型', A, apply_start=ev('12/1', note='WEB出願・必要書類は郵送または窓口'), apply_end=ev('12/25'), exam=ev('1/6'), result=ev('1/8', note='WEBで発表'))
add('taisei', '特別選抜（4科・英語・専願2科・専願かがやき）', A, apply_start=ev('12/1', note='WEB出願・必要書類は郵送または窓口'), apply_end=ev('1/8'), exam=ev('1/10'), result=ev('1/13', note='WEBで発表'))
add('taisei', '一般（4科・専願2科・専願スポーツ）', A, apply_start=ev('12/1', note='WEB出願・必要書類は郵送または窓口'), apply_end=ev('1/28'), exam=ev('1/30'), result=ev('2/2', note='WEBで発表'))
add('taki', '', A, apply_start=ev('1/18', note='WEB出願（願書の郵送は該当者のみ）'), apply_end=ev('1/28'),
    docs=ev('1/22', note='必要提出書類の郵送（必着）'), exam=ev('2/7'), result=ev('2/9', note='WEBで発表'))
add('haruhi', '第1回', A, apply_start=ev('1/8', note='WEB出願'), apply_end=ev('1/19'), docs=ev('1/22', note='必要書類の郵送（必着）'),
    exam=ev('1/24'), result=ev('1/26', note='WEBで発表'))
add('haruhi', '第2回', A, apply_start=ev('1/8', note='WEB出願'), apply_end=ev('1/27'), docs=ev('1/29', note='必要書類の郵送（必着）'),
    exam=ev('1/31'), result=ev('2/2', note='WEBで発表'))
add('sakuragaoka', 'Ⅰ期（A方式）', A, apply_start=ev('12/25', note='郵送で出願'), apply_end=ev('1/12'), exam=ev('1/23', note='国・算、本人と保護者の面接'), result=ev('1/26', note='WEBで発表'))
add('sakuragaoka', 'Ⅱ期（B方式）', A, apply_start=ev('12/25', note='郵送で出願'), apply_end=ev('1/28'), exam=ev('2/6', note='国・算・英、本人と保護者の面接'), result=ev('2/9', note='WEBで発表'))
# 海陽（学校の2027年度 生徒募集要項）
K = ['school']
FINAL = '最終入学手続期限 2/9(火) 15:00'
add('kaiyo', '特別給費生入試', K, apply_start=ev('11/23', '00:00', 'WEB出願'), apply_end=ev('12/9', '15:00'), exam=ev('12/12'),
    result=ev('12/14', '12:00'), proc=ev('12/16', '15:00', '一次入学手続期限。' + FINAL), pay=ev('2/9', '15:00', '最終入学手続期限'))
add('kaiyo', '入試Ⅰ', K, apply_start=ev('11/23', '00:00', 'WEB出願'), apply_end=ev('12/16', '15:00'), exam=ev('12/19'),
    result=ev('12/21', '12:00'), proc=ev('12/23', '15:00', '一次入学手続期限。' + FINAL), pay=ev('2/9', '15:00', '最終入学手続期限'))
add('kaiyo', '入試Ⅱ', K, apply_start=ev('11/23', '00:00', 'WEB出願'), apply_end=ev('1/3', '15:00'), exam=ev('1/6', note='午前'),
    result=ev('1/8', '12:00'), proc=ev('1/12', '15:00', '一次入学手続期限。' + FINAL), pay=ev('2/9', '15:00', '最終入学手続期限'))
add('kaiyo', '視聴型入試', K, apply_start=ev('11/23', '00:00', 'WEB出願'), apply_end=ev('1/3', '15:00'), exam=ev('1/6', note='午後'),
    result=ev('1/8', '12:00'), proc=ev('1/12', '15:00', '一次入学手続期限。' + FINAL), pay=ev('2/9', '15:00', '最終入学手続期限'))
add('kaiyo', '入試Ⅲ', K, apply_start=ev('1/6', '00:00', 'WEB出願'), apply_end=ev('2/3', '15:00'), exam=ev('2/5'),
    result=ev('2/5', '22:00', '22:00までに発表'), pay=ev('2/9', '15:00', '最終入学手続期限'))

# 岐阜（岐阜県私立中学高等学校協会の入試日程）
G = ['gifu_assoc']
add('g_uguisu', '第Ⅰ期（一般・グローバル）', G, apply_start=ev('12/1'), apply_end=ev('1/8'), exam=ev('1/11'), result=ev('1/14'))
add('g_gito', '一般・専願', G, apply_start=ev('12/1'), apply_end=ev('1/8'), exam=ev('1/10'), result=ev('1/14'))
add('g_shotoku', '前期入試', G + ['school'], apply_start=ev('12/1'), apply_end=ev('1/7'), exam=ev('1/10', note='保護者と本人の面接あり'), result=ev('1/13'),
    proc=ev('1/22', note='入学手続きの締切（入学金170,000円）。奨学生資格は1/23の合格者招集日の出席が条件'))
add('g_shotoku', '後期入試', G, apply_start=ev('1/18'), apply_end=ev('2/5'), exam=ev('2/11', note='保護者と本人の面接あり'), result=ev('2/15'))
add('g_maria', '1月入試（前期）', G, apply_start=ev('12/1'), apply_end=ev('1/7'), exam=ev('1/11'), result=ev('1/12'))
add('g_maria', '2月入試（後期）', G, apply_start=ev('1/25'), apply_end=ev('2/4'), exam=ev('2/6'), result=ev('2/6'))
add('g_minokamo', '2教科型・4教科型', G, apply_start=ev('12/14'), apply_end=ev('1/13'), exam=ev('1/16', note='保護者と本人の面接あり'), result=ev('1/20'))
add('g_teikyo', '1月入試', G, apply_start=ev('12/4'), apply_end=ev('1/5'), exam=ev('1/9'), result=ev('1/14'))
add('g_teikyo', '2月入試', G, apply_start=ev('1/18'), apply_end=ev('2/3'), exam=ev('2/6'), result=ev('2/10'))
add('g_tajimi', '自己推薦', G, apply_start=ev('12/1'), apply_end=ev('1/3'), exam=ev('1/5'), result=ev('1/6'))
add('g_tajimi', '第Ⅰ期', G, apply_start=ev('12/1'), apply_end=ev('1/6'), exam=ev('1/9'), result=ev('1/13'))
add('g_tajimi', '第Ⅱ期', G, apply_start=ev('1/14'), apply_end=ev('2/3'), exam=ev('2/6'), result=ev('2/8'))
add('g_reitaku', '1期（専願・併願）', G, apply_start=ev('12/7'), apply_end=ev('1/6'), exam=ev('1/9'), result=ev('1/12'))
add('g_reitaku', '2期', G, apply_start=ev('1/13'), apply_end=ev('2/8'), exam=ev('2/13'), result=ev('2/15'))
add('g_seino', '第一次試験', G, apply_start=ev('1/12'), apply_end=ev('1/29'), exam=ev('1/30', note='作文・保護者面接・受験生面接'), result=ev('2/3'))
add('g_seino', '第二次試験', G, apply_start=ev('2/8'), apply_end=ev('3/14'), exam=ev('3/15', note='作文・保護者面接・受験生面接'), result=ev('3/17'))

# 三重（各校の公式サイト。県の一覧はない）
add('m_takada', '', K, apply_start=ev('12/1', '09:00', 'インターネット出願・検定料14,000円'), apply_end=ev('12/8', '15:00'),
    docs=ev('12/11', note='調査書の提出（必着）'), exam=ev('1/10', '08:30', '8:30集合'), result=ev('1/13', '16:00', '志願者サイトで発表'),
    pay=ev('1/22', '12:00', '入学金50,000円＋施設設備整備費300,000円。期限までに納入しないと合格取り消し'),
    brief=ev('2/6', '13:30', '出校日（第1回）'))
AK = '入学金45,000円・教育充実費250,000円'
add('m_akatsuki', 'グローバル育成選抜入試（専願）', K, apply_start=ev('12/1', note='インターネット出願'), apply_end=ev('12/21'),
    exam=ev('1/6', '08:30'), result=ev('1/7', '16:00', 'インターネットで発表'), pay=ev('1/22', note=AK))
add('m_akatsuki', '前期（一般・専願）', K, apply_start=ev('12/1', note='インターネット出願'), apply_end=ev('1/5'),
    exam=ev('1/9', '08:30'), result=ev('1/12', note='インターネットで発表'), pay=ev('1/22', note=AK))
add('m_akatsuki', '後期', K, apply_start=ev('12/1', note='インターネット出願'), apply_end=ev('1/14'),
    exam=ev('1/16', '08:30', '国語・算数'), result=ev('1/18', '18:00', 'インターネットで発表'), pay=ev('1/22', note=AK))
add('m_tsuda', '専願入試', K, apply_start=ev('12/1', note='窓口または郵送（郵送は12/21消印有効）'), apply_end=ev('12/23', note='窓口の締切'),
    exam=ev('12/26'), result=ev('12/28', note='本人宛に郵送'))
add('m_tsuda', '一般入試', K, apply_start=ev('12/1', note='窓口または郵送（郵送は1/5消印有効）'), apply_end=ev('1/7', note='窓口の締切'),
    exam=ev('1/11'), result=ev('1/12', note='本人宛に郵送。手続きの期日は合格通知で知らされる'))
add('m_mie', '一般選考', ['third'], apply_start=ev('12/1', third=True), apply_end=ev('1/4', third=True),
    exam=ev('1/10', third=True), result=ev('1/13', third=True))
for k in ['m_maryknoll', 'm_kaisei', 'm_suzuka', 'm_sjjg', 'm_kogakkan', 'm_sakura']:
    add(k, '', [])


def build():
    out = []
    counts = {}
    for key, rnd, srcs, events in R:
        name, pref, city, gender, url = SCHOOLS[key]
        counts[key] = counts.get(key, 0) + 1
        sid = key if sum(1 for r in R if r[0] == key) == 1 else f'{key}-{counts[key]}'
        sources = []
        for s in srcs:
            x = dict(SRC[s])
            if s == 'school': x['url'] = url
            sources.append(x)
        official = all(not e.get('third') for e in events.values()) and bool(events)
        if any(not SRC[s]['official'] for s in srcs) and not any(e.get('third') for e in events.values()):
            # 第三者の情報しかない学校：すべて未確認として扱う
            for e in events.values(): e['third'] = True
            official = False
        out.append({'id': sid, 'school': name, 'round': rnd, 'pref': pref, 'city': city, 'gender': gender,
                    'url': url, 'checked': CHECKED, 'verified': official, 'sources': sources, 'events': events})
    return out


if __name__ == '__main__':
    data = build()
    here = os.path.dirname(os.path.abspath(__file__))
    js = ('// 志望校リスト（東海3県の私立中学・2027年度入試）。tools/build_schools.py で作成。\n'
          '// events の third: true は、公式で確かめられず第三者サイトの情報を入れた項目。\n'
          '(function (g) {\n  g.SCHOOL_PRESETS = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n})(globalThis);\n')
    open(os.path.join(here, '..', 'js', 'schools.js'), 'w').write(js)
    print(len(data), 'rounds,', len({r['school'] for r in data}), 'schools')
