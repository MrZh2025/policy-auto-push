# -*- coding: utf-8 -*-
"""把 _t/policies.json 中的新政策导入 policy_records.db 并重新生成静态 JSON。"""
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SRC = r'C:\Users\Administrator\tunnel_ws\_t\policies.json'

conn = sqlite3.connect('policy_records.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

d = json.load(open(SRC, encoding='utf-8'))
entries = d['data'] if isinstance(d, dict) else d

existing_fp = {r[0] for r in cur.execute('select fingerprint from policies')}
existing_url = {r[0] for r in cur.execute('select url from policies')}
existing_title = {r[0] for r in cur.execute('select title from policies')}

added = 0
for e in entries:
    fp = e.get('fingerprint')
    if not fp or fp in existing_fp or e.get('url') in existing_url or e.get('title') in existing_title:
        continue
    cur.execute(
        'insert into policies (fingerprint,title,url,source,pub_date,category,summary,created_at,pushed_at,is_pushed) '
        'values (?,?,?,?,?,?,?,?,?,?)',
        (fp, e.get('title'), e.get('url'), e.get('source'), e.get('pub_date'),
         e.get('category'), e.get('summary') or '',
         e.get('created_at') or '2026-08-20 09:25:42', e.get('pushed_at'),
         1 if e.get('is_pushed') else 0))
    existing_fp.add(fp)
    existing_url.add(e.get('url'))
    existing_title.add(e.get('title'))
    added += 1
conn.commit()
print('added', added, 'total', cur.execute('select count(*) from policies').fetchone()[0])

# 与 main.py 相同口径导出静态 JSON
from database import PolicyDatabase
db = PolicyDatabase()
for data_dir in ['web/data', 'docs/data']:
    os.makedirs(data_dir, exist_ok=True)
    with db._get_connection() as c2:
        cc = c2.cursor()
        cc.execute('SELECT * FROM policies ORDER BY pub_date DESC, id DESC LIMIT 200')
        all_policies = [dict(r) for r in cc.fetchall()]
        cc.execute('SELECT category, COUNT(*) as cnt FROM policies GROUP BY category')
        cat_stats = {r['category']: r['cnt'] for r in cc.fetchall()}
    json.dump({'code': 0, 'data': all_policies, 'count': len(all_policies)},
              open(os.path.join(data_dir, 'policies.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    json.dump({'code': 0, 'data': {'stats': db.get_stats(), 'categories': cat_stats}},
              open(os.path.join(data_dir, 'stats.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
print('exported', len(all_policies))
