# -*- coding: utf-8 -*-
"""在定时采集前，把网页数据 (docs/data/policies.json) 中的新政策合并进
policy_records.db，确保本地推送上来的政策不会被后续 JSON 重新生成覆盖丢失。"""
import json
import os
import sqlite3
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'policy_records.db')
SOURCES = [
    os.path.join(BASE, 'docs', 'data', 'policies.json'),
    os.path.join(BASE, 'web', 'data', 'policies.json'),
]


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    existing_fp = {r[0] for r in cur.execute('select fingerprint from policies')}
    existing_url = {r[0] for r in cur.execute('select url from policies')}
    existing_title = {r[0] for r in cur.execute('select title from policies')}
    added = 0
    for src in SOURCES:
        if not os.path.exists(src):
            continue
        try:
            d = json.load(open(src, encoding='utf-8'))
        except Exception as e:
            print('读取失败 %s: %s' % (src, e))
            continue
        entries = d.get('data') if isinstance(d, dict) else d
        for e in entries or []:
            fp = e.get('fingerprint')
            if (not fp or fp in existing_fp
                    or e.get('url') in existing_url
                    or e.get('title') in existing_title):
                continue
            cur.execute(
                'insert into policies (fingerprint,title,url,source,pub_date,'
                'category,summary,created_at,pushed_at,is_pushed) '
                'values (?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),?,?)',
                (fp, e.get('title'), e.get('url'), e.get('source'),
                 e.get('pub_date'), e.get('category'), e.get('summary') or '',
                 e.get('created_at'), e.get('pushed_at'),
                 1 if e.get('is_pushed') else 0))
            existing_fp.add(fp)
            existing_url.add(e.get('url'))
            existing_title.add(e.get('title'))
            added += 1
    conn.commit()
    total = cur.execute('select count(*) from policies').fetchone()[0]
    print('网页数据合并完成：新增 %d 条，数据库共 %d 条' % (added, total))
    return 0


if __name__ == '__main__':
    sys.exit(main())
