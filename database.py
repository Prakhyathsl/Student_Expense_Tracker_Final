"""Small database layer for the Expense Tracker.

Uses PostgreSQL when DATABASE_URL is configured (recommended for Render),
otherwise falls back to a local SQLite file for desktop use.
"""
import os
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_PATH = DATA_DIR / "expense_tracker.db"
SEED_EXPENSES_PATH = BASE_DIR / "seed_expenses.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


def using_postgres():
    return bool(DATABASE_URL)


@contextmanager
def connection():
    if using_postgres():
        if psycopg2 is None:
            raise RuntimeError("DATABASE_URL is set but psycopg2-binary is not installed.")
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        conn = psycopg2.connect(url, sslmode="require")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def placeholder():
    return "%s" if using_postgres() else "?"


def init_db():
    p = "%s" if using_postgres() else "?"
    with connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY,
                academic_year TEXT NOT NULL DEFAULT '',
                semester TEXT NOT NULL DEFAULT '',
                date TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                amount REAL NOT NULL DEFAULT 0,
                payment_method TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT ''
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS savings_goals (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL DEFAULT 0,
                target_date TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                created_date TEXT NOT NULL DEFAULT ''
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS savings_history (
                id INTEGER PRIMARY KEY,
                goal_id INTEGER NOT NULL,
                date TEXT NOT NULL DEFAULT '',
                amount REAL NOT NULL DEFAULT 0,
                note TEXT NOT NULL DEFAULT ''
            )
        """)

        # Seed the user's existing expense history exactly once.
        # This runs only when the database has no expenses, so future
        # expenses are preserved and the old data is never duplicated.
        cur.execute("SELECT COUNT(*) FROM expenses")
        expense_count = cur.fetchone()[0]
        if expense_count == 0 and SEED_EXPENSES_PATH.exists():
            try:
                with SEED_EXPENSES_PATH.open("r", encoding="utf-8") as seed_file:
                    seed_expenses = json.load(seed_file)
                sql = (
                    "INSERT INTO expenses "
                    "(id, academic_year, semester, date, category, amount, payment_method, description) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)"
                    if using_postgres() else
                    "INSERT INTO expenses "
                    "(id, academic_year, semester, date, category, amount, payment_method, description) "
                    "VALUES (?,?,?,?,?,?,?,?)"
                )
                for e in seed_expenses:
                    cur.execute(sql, (
                        int(e.get("id", 0)),
                        str(e.get("academic_year", "")),
                        str(e.get("semester", "")),
                        str(e.get("date", "")),
                        str(e.get("category", "")),
                        float(e.get("amount", 0)),
                        str(e.get("payment_method", "")),
                        str(e.get("description", "")),
                    ))
                print(f"Seeded {len(seed_expenses)} existing expenses.")
            except Exception as error:
                print("ERROR SEEDING EXISTING EXPENSES:", error)


def _rows(cur):
    rows = cur.fetchall()
    if using_postgres():
        return [dict(row) for row in rows]
    return [dict(row) for row in rows]


def get_expenses():
    init_db()
    with connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, academic_year, semester, date, category, amount, payment_method, description FROM expenses ORDER BY id")
        return _rows(cur)


def save_expenses(expenses):
    init_db()
    with connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM expenses")
        sql = "INSERT INTO expenses (id, academic_year, semester, date, category, amount, payment_method, description) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)" if using_postgres() else "INSERT INTO expenses (id, academic_year, semester, date, category, amount, payment_method, description) VALUES (?,?,?,?,?,?,?,?)"
        for e in expenses:
            cur.execute(sql, (
                int(e.get("id", 0)),
                str(e.get("academic_year", "")),
                str(e.get("semester", "")),
                str(e.get("date", "")),
                str(e.get("category", "")),
                float(e.get("amount", 0)),
                str(e.get("payment_method", "")),
                str(e.get("description", "")),
            ))


def read_savings_data():
    init_db()
    with connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name, target_amount, target_date, description, created_date FROM savings_goals ORDER BY id")
        goals = _rows(cur)
        cur.execute("SELECT id, goal_id, date, amount, note FROM savings_history ORDER BY id")
        history = _rows(cur)
        return goals, history


def save_savings_data(goals, history):
    init_db()
    with connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM savings_history")
        cur.execute("DELETE FROM savings_goals")
        goal_sql = "INSERT INTO savings_goals (id,name,target_amount,target_date,description,created_date) VALUES (%s,%s,%s,%s,%s,%s)" if using_postgres() else "INSERT INTO savings_goals (id,name,target_amount,target_date,description,created_date) VALUES (?,?,?,?,?,?)"
        history_sql = "INSERT INTO savings_history (id,goal_id,date,amount,note) VALUES (%s,%s,%s,%s,%s)" if using_postgres() else "INSERT INTO savings_history (id,goal_id,date,amount,note) VALUES (?,?,?,?,?)"
        for g in goals:
            cur.execute(goal_sql, (int(g["id"]), g.get("name", ""), float(g.get("target_amount", 0)), g.get("target_date", ""), g.get("description", ""), g.get("created_date", "")))
        for h in history:
            cur.execute(history_sql, (int(h["id"]), int(h["goal_id"]), h.get("date", ""), float(h.get("amount", 0)), h.get("note", "")))
