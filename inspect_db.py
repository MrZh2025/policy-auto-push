# -*- coding: utf-8 -*-
import sqlite3
c = sqlite3.connect('policy_records.db')
c.row_factory = sqlite3.Row
print(c.execute("select sql from sqlite_master where name='policies'").fetchone()[0])
print('rows', c.execute('select count(*) from policies').fetchone()[0])
print('maxdate', c.execute('select max(pub_date) from policies').fetchone()[0])
r = dict(c.execute('select * from policies order by id desc limit 1').fetchone())
for k, v in r.items():
    print(k, '=', str(v)[:80])
