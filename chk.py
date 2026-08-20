import sqlite3
c = sqlite3.connect('policy_records.db').cursor()
print(c.execute("select count(*) from policies").fetchone())
print(c.execute("select count(*) from policies where category='核医药'").fetchone())
