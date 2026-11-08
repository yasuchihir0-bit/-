# claude.ai の Artifact 用に、CSS と JS を 1 枚の HTML にまとめる
# python3 calendar/tools/build_artifact.py <出力先.html>
import os, re, sys
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
read = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
html = read('index.html')
body = re.search(r'<body>(.*?)<script', html, re.S).group(1).strip()
js = '\n'.join(read(p) for p in ['js/core.js', 'js/schools.js', 'js/app.js'])
css = read('css/style.css') + '\n.topbar { top: env(safe-area-inset-top, 0px); }\n'
out = f'''<title>受験スケジュール</title>
<meta name="description" content="東海3県の私立中学の出願・試験・合格発表・手続きの日程をまとめて管理する受験カレンダー">
<style>
{css}</style>
{body}
<script>
{js.replace('</script', '<\\/script')}
</script>
'''
open(sys.argv[1], 'w', encoding='utf-8').write(out)
print(sys.argv[1], len(out.encode()) // 1024, 'KB')
