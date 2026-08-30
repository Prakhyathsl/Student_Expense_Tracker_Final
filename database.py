"""Database layer for the Personal Student Expense Tracker.

PostgreSQL is used when DATABASE_URL is configured (recommended for Render).
Otherwise, local SQLite is used for desktop development.

The database schema is initialized only once per application process.
PostgreSQL connections are reused through a small thread-safe connection pool.
"""

import os
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from threading import Lock

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import ThreadedConnectionPool
except ImportError:
    psycopg2 = None
    RealDictCursor = None
    ThreadedConnectionPool = None


# ============================================================
# PATHS / CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SQLITE_PATH = DATA_DIR / "expense_tracker.db"

SEED_EXPENSES_PATH = BASE_DIR / "seed_expenses.json"

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


# ============================================================
# DATABASE STATE
# ============================================================

_db_initialized = False
_db_init_lock = Lock()

_postgres_pool = None
_postgres_pool_lock = Lock()


# ============================================================
# DATABASE TYPE
# ============================================================

def using_postgres():
    """Return True when Render/PostgreSQL is configured."""
    return bool(DATABASE_URL)


def placeholder():
    """Return the correct SQL placeholder."""
    return "%s" if using_postgres() else "?"


# ============================================================
# POSTGRES CONNECTION POOL
# ============================================================

def _get_postgres_pool():
    """Create the PostgreSQL connection pool once and reuse it."""

    global _postgres_pool

    if _postgres_pool is not None:
        return _postgres_pool

    if psycopg2 is None or ThreadedConnectionPool is None:
        raise RuntimeError(
            "DATABASE_URL is set but psycopg2-binary is not installed."
        )

    with _postgres_pool_lock:

        if _postgres_pool is None:

            url = DATABASE_URL

            # Render sometimes provides postgres:// URLs.
            if url.startswith("postgres://"):
                url = "postgresql://" + url[len("postgres://"):]

            _postgres_pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=5,
                dsn=url,
                sslmode="require"
            )

    return _postgres_pool


# ============================================================
# CONNECTION
# ============================================================

@contextmanager
def connection():
    """Get a database connection.

    PostgreSQL:
        Uses a reusable connection pool.

    SQLite:
        Opens the local database normally.
    """

    if using_postgres():

        pool = _get_postgres_pool()

        conn = pool.getconn()

        try:
            yield conn
            conn.commit()

        except Exception:
            conn.rollback()
            raise

        finally:
            pool.putconn(conn)

    else:

        conn = sqlite3.connect(
            SQLITE_PATH,
            timeout=30,
            check_same_thread=False
        )

        conn.row_factory = sqlite3.Row

        try:
            yield conn
            conn.commit()

        except Exception:
            conn.rollback()
            raise

        finally:
            conn.close()


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():
    """Initialize database tables only once per process."""

    global _db_initialized

    if _db_initialized:
        return

    with _db_init_lock:

        # Another thread may have initialized it
        # while this thread was waiting for the lock.
        if _db_initialized:
            return

        print("Initializing database...")

        with connection() as conn:

            cur = conn.cursor()

            # ------------------------------------------------
            # EXPENSES
            # ------------------------------------------------

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

            # ------------------------------------------------
            # SAVINGS GOALS
            # ------------------------------------------------

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

            # ------------------------------------------------
            # SAVINGS HISTORY
            # ------------------------------------------------

            cur.execute("""
                CREATE TABLE IF NOT EXISTS savings_history (
                    id INTEGER PRIMARY KEY,
                    goal_id INTEGER NOT NULL,
                    date TEXT NOT NULL DEFAULT '',
                    amount REAL NOT NULL DEFAULT 0,
                    note TEXT NOT NULL DEFAULT ''
                )
            """)

            # ------------------------------------------------
            # SEED OLD EXPENSE DATA
            # ------------------------------------------------

            cur.execute("SELECT COUNT(*) FROM expenses")
            expense_count = cur.fetchone()[0]

            if (
                expense_count == 0
                and SEED_EXPENSES_PATH.exists()
            ):

                try:

                    with SEED_EXPENSES_PATH.open(
                        "r",
                        encoding="utf-8"
                    ) as seed_file:

                        seed_expenses = json.load(seed_file)

                    sql = (
                        """
                        INSERT INTO expenses
                        (
                            id,
                            academic_year,
                            semester,
                            date,
                            category,
                            amount,
                            payment_method,
                            description
                        )
                        VALUES
                        (%s,%s,%s,%s,%s,%s,%s,%s)
                        """
                        if using_postgres()
                        else
                        """
                        INSERT INTO expenses
                        (
                            id,
                            academic_year,
                            semester,
                            date,
                            category,
                            amount,
                            payment_method,
                            description
                        )
                        VALUES
                        (?,?,?,?,?,?,?,?)
                        """
                    )

                    inserted = 0

                    for e in seed_expenses:

                        cur.execute(
                            sql,
                            (
                                int(e.get("id", 0)),
                                str(e.get("academic_year", "")),
                                str(e.get("semester", "")),
                                str(e.get("date", "")),
                                str(e.get("category", "")),
                                float(e.get("amount", 0)),
                                str(e.get("payment_method", "")),
                                str(e.get("description", "")),
                            )
                        )

                        inserted += 1

                    print(
                        f"Seeded {inserted} existing expenses."
                    )

                except Exception as error:

                    print(
                        "ERROR SEEDING EXISTING EXPENSES:",
                        error
                    )

                    raise

            cur.close()

        _db_initialized = True

        print("Database ready.")


# ============================================================
# ROW CONVERSION
# ============================================================

def _rows(cur):
    """Convert database rows into normal Python dictionaries."""

    rows = cur.fetchall()

    if not rows:
        return []

    # PostgreSQL RealDictCursor already returns dictionaries.
    if isinstance(rows[0], dict):
        return [dict(row) for row in rows]

    # SQLite rows / normal tuples.
    columns = [
        description[0]
        for description in cur.description
    ]

    return [
        dict(zip(columns, row))
        for row in rows
    ]


# ============================================================
# EXPENSES - READ
# ============================================================

def get_expenses():

    # No expensive database initialization here.
    init_db()

    with connection() as conn:

        if using_postgres():

            cur = conn.cursor(
                cursor_factory=RealDictCursor
            )

        else:

            cur = conn.cursor()

        cur.execute("""
            SELECT
                id,
                academic_year,
                semester,
                date,
                category,
                amount,
                payment_method,
                description
            FROM expenses
            ORDER BY id
        """)

        result = _rows(cur)

        cur.close()

        return result


# ============================================================
# EXPENSES - SAVE
# ============================================================

def save_expenses(expenses):

    init_db()

    with connection() as conn:

        cur = conn.cursor()

        # Existing application behavior:
        # replace the complete expense list.
        cur.execute("DELETE FROM expenses")

        sql = (
            """
            INSERT INTO expenses
            (
                id,
                academic_year,
                semester,
                date,
                category,
                amount,
                payment_method,
                description
            )
            VALUES
            (%s,%s,%s,%s,%s,%s,%s,%s)
            """
            if using_postgres()
            else
            """
            INSERT INTO expenses
            (
                id,
                academic_year,
                semester,
                date,
                category,
                amount,
                payment_method,
                description
            )
            VALUES
            (?,?,?,?,?,?,?,?)
            """
        )

        for e in expenses:

            cur.execute(
                sql,
                (
                    int(e.get("id", 0)),
                    str(e.get("academic_year", "")),
                    str(e.get("semester", "")),
                    str(e.get("date", "")),
                    str(e.get("category", "")),
                    float(e.get("amount", 0)),
                    str(e.get("payment_method", "")),
                    str(e.get("description", "")),
                )
            )

        cur.close()


# ============================================================
# SAVINGS - READ
# ============================================================

def read_savings_data():

    init_db()

    with connection() as conn:

        if using_postgres():

            cur = conn.cursor(
                cursor_factory=RealDictCursor
            )

        else:

            cur = conn.cursor()

        # Goals
        cur.execute("""
            SELECT
                id,
                name,
                target_amount,
                target_date,
                description,
                created_date
            FROM savings_goals
            ORDER BY id
        """)

        goals = _rows(cur)

        # Savings history
        cur.execute("""
            SELECT
                id,
                goal_id,
                date,
                amount,
                note
            FROM savings_history
            ORDER BY id
        """)

        history = _rows(cur)

        cur.close()

        return goals, history


# ============================================================
# SAVINGS - SAVE
# ============================================================

def save_savings_data(goals, history):

    init_db()

    with connection() as conn:

        cur = conn.cursor()

        # Remove old snapshot.
        cur.execute(
            "DELETE FROM savings_history"
        )

        cur.execute(
            "DELETE FROM savings_goals"
        )

        # ----------------------------------------------------
        # GOALS
        # ----------------------------------------------------

        goal_sql = (
            """
            INSERT INTO savings_goals
            (
                id,
                name,
                target_amount,
                target_date,
                description,
                created_date
            )
            VALUES
            (%s,%s,%s,%s,%s,%s)
            """
            if using_postgres()
            else
            """
            INSERT INTO savings_goals
            (
                id,
                name,
                target_amount,
                target_date,
                description,
                created_date
            )
            VALUES
            (?,?,?,?,?,?)
            """
        )

        for g in goals:

            cur.execute(
                goal_sql,
                (
                    int(g["id"]),
                    str(g.get("name", "")),
                    float(
                        g.get(
                            "target_amount",
                            0
                        )
                    ),
                    str(
                        g.get(
                            "target_date",
                            ""
                        )
                    ),
                    str(
                        g.get(
                            "description",
                            ""
                        )
                    ),
                    str(
                        g.get(
                            "created_date",
                            ""
                        )
                    ),
                )
            )

        # ----------------------------------------------------
        # SAVINGS HISTORY
        # ----------------------------------------------------

        history_sql = (
            """
            INSERT INTO savings_history
            (
                id,
                goal_id,
                date,
                amount,
                note
            )
            VALUES
            (%s,%s,%s,%s,%s)
            """
            if using_postgres()
            else
            """
            INSERT INTO savings_history
            (
                id,
                goal_id,
                date,
                amount,
                note
            )
            VALUES
            (?,?,?,?,?)
            """
        )

        for h in history:

            cur.execute(
                history_sql,
                (
                    int(h["id"]),
                    int(h["goal_id"]),
                    str(
                        h.get(
                            "date",
                            ""
                        )
                    ),
                    float(
                        h.get(
                            "amount",
                            0
                        )
                    ),
                    str(
                        h.get(
                            "note",
                            ""
                        )
                    ),
                )
            )

        cur.close()
