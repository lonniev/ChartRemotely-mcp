"""A Neon stand-in that actually runs the store's SQL, on SQLite.

The string-matching fakes prove what was ASKED; this one proves what the
database is left holding, which is what a cap or a sweep is for. Only the
handful of Postgres spellings the store uses are translated: ``$n``
placeholders, ``now()``, ``interval 'n seconds'`` and ``EXTRACT(EPOCH ...)``.
Time is a number the test moves, so a two-hour TTL needs no sleeping.
"""

from __future__ import annotations

import re
import sqlite3


class SqliteNeon:
    def __init__(self, cipher=None, clock: float = 1_700_000_000.0) -> None:
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("ATTACH ':memory:' AS op")
        self.clock = clock
        self.sql: list[str] = []
        if cipher is not None:
            self._cipher = cipher

    def _t(self, table: str) -> str:
        return f"op.{table}"

    def _translate(self, sql: str) -> str:
        sql = re.sub(r"interval '(\d+) seconds'", r"\1", sql)
        sql = re.sub(r"EXTRACT\(EPOCH FROM ([\w.]+)\)", r"\1", sql)
        sql = sql.replace("now()", repr(self.clock))
        sql = sql.replace("gen_random_uuid()", "(lower(hex(randomblob(16))))")
        sql = re.sub(r"DEFAULT ([\d.]+)", r"DEFAULT (\1)", sql)
        sql = sql.replace("ADD COLUMN IF NOT EXISTS", "ADD COLUMN")
        # SQLite names an index's schema on the index, not the table.
        sql = re.sub(r"CREATE INDEX IF NOT EXISTS (\w+) ON op\.", r"CREATE INDEX IF NOT EXISTS op.\1 ON ", sql)
        return re.sub(r"\$(\d+)", r"?\1", sql)

    async def _execute(self, sql: str, params=None):
        self.sql.append(sql)
        try:
            cur = self.db.execute(self._translate(sql), params or [])
        except sqlite3.OperationalError as exc:
            if "duplicate column" in str(exc):
                return {"rows": []}
            raise
        return {"rows": [dict(r) for r in cur.fetchall()]}

    def rows(self, table: str) -> list[dict]:
        return [dict(r) for r in self.db.execute(f"SELECT * FROM op.{table}")]

    def tables(self) -> set[str]:
        return {r[0] for r in self.db.execute("SELECT name FROM op.sqlite_master WHERE type = 'table'")}
