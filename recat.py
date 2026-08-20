# -*- coding: utf-8 -*-
import sqlite3, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
conn = sqlite3.connect('policy_records.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
new_sum = '【放射性药品许可改革】自2025年1月20日起取消“医疗机构使用放射性药品（一、二类）许可”，医疗机构使用配制的放射性制剂须向省级药监部门申请核发相应等级《放射性药品使用许可证》，配套落实《放射性药品管理办法》修订；同时取消药品批发/零售企业筹建审批。'
cur.execute("update policies set category='核医药', summary=? where url like '%6998966%'", (new_sum,))
conn.commit()
print('updated', cur.rowcount)
from database import PolicyDatabase
db = PolicyDatabase()
for data_dir in ['web/data', 'docs/data']:
    with db._get_connection() as c2:
        cc = c2.cursor()
        cc.execute('SELECT * FROM policies ORDER BY pub_date DESC, id DESC LIMIT 200')
        all_policies = [dict(r) for r in cc.fetchall()]
        cc.execute('SELECT category, COUNT(*) as cnt FROM policies GROUP BY category')
        cat_stats = {r['category']: r['cnt'] for r in cc.fetchall()}
    json.dump({'code': 0, 'data': all_policies, 'count': len(all_policies)},
              open(os.path.join(data_dir, 'policies.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    json.dump({'code': 0, 'data': {'stats': db.get_stats(), 'categories': cat_stats}},
              open(os.path.join(data_dir, 'stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('cats', cat_stats)
