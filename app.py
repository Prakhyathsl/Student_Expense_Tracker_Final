from flask import Flask, render_template, request, jsonify, send_file
from pathlib import Path
from threading import Lock
from datetime import datetime, date
import pandas as pd
import shutil
import re
import math


# ============================================================
# APP
# ============================================================

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Your OLD Excel file
OLD_EXCEL = DATA_DIR / "Student_Expense_Tracker.xlsx"

# Main Excel file used by the application
MASTER_EXCEL = DATA_DIR / "Expense_Tracker_Master.xlsx"

SHEET_NAME = "Expenses"

FILE_LOCK = Lock()


# ============================================================
# EXCEL COLUMNS
# ============================================================

COLUMNS = [
    "ID",
    "Academic Year",
    "Semester",
    "Date",
    "Category",
    "Amount (₹)",
    "Payment Method",
    "Description"
]


# ============================================================
# ACADEMIC YEAR / SEMESTER
# ============================================================

YEAR_SEMESTERS = {
    "1st Year": ["1st Sem", "2nd Sem"],
    "2nd Year": ["3rd Sem", "4th Sem"],
    "3rd Year": ["5th Sem", "6th Sem"],
    "4th Year": ["7th Sem", "8th Sem"]
}


YEAR_ORDER = {
    "1st Year": 1,
    "2nd Year": 2,
    "3rd Year": 3,
    "4th Year": 4
}


SEMESTER_ORDER = {
    "1st Sem": 1,
    "2nd Sem": 2,
    "3rd Sem": 3,
    "4th Sem": 4,
    "5th Sem": 5,
    "6th Sem": 6,
    "7th Sem": 7,
    "8th Sem": 8
}


# ============================================================
# HELPERS
# ============================================================

def clean_value(value):
    """Convert Excel values safely to strings."""
    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass

    return str(value).strip()


def normalize_payment_method(value):
    """Normalize payment-method text to one canonical value."""
    text = clean_value(value)
    if not text:
        return ""

    canonical = {
        "cash": "Cash",
        "upi": "UPI",
        "card": "Card",
        "bank transfer": "Bank Transfer",
        "other": "Other"
    }
    return canonical.get(text.casefold(), text)


def clean_number(value):
    """Convert amount to float."""
    if value is None:
        return 0.0

    try:
        if pd.isna(value):
            return 0.0
    except Exception:
        pass

    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return 0.0
        return float(value)

    text = str(value).strip()
    text = text.replace("₹", "")
    text = text.replace(",", "")
    text = text.replace("Rs.", "")
    text = text.replace("Rs", "")
    text = text.strip()

    try:
        return float(text)
    except ValueError:
        return 0.0


def normalize_header(header):
    """Normalize Excel column names."""
    text = clean_value(header).lower()

    text = text.replace("₹", "")
    text = text.replace("(rs)", "")
    text = text.replace("(inr)", "")
    text = text.replace("(rupees)", "")

    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")

    return text


HEADER_ALIASES = {
    "id": "ID",

    "academic_year": "Academic Year",
    "academicyear": "Academic Year",
    "year": "Academic Year",

    "semester": "Semester",
    "sem": "Semester",

    "date": "Date",

    "category": "Category",

    "amount": "Amount (₹)",
    "amount_rs": "Amount (₹)",
    "amount_r": "Amount (₹)",
    "amount_inr": "Amount (₹)",
    "amount": "Amount (₹)",

    "payment_method": "Payment Method",
    "paymentmethod": "Payment Method",
    "payment": "Payment Method",

    "description": "Description",
    "details": "Description",
    "remark": "Description",
    "remarks": "Description"
}


def normalize_academic_year(value):
    text = clean_value(value)

    if not text:
        return ""

    lower = text.lower()

    mapping = {
        "1": "1st Year",
        "1st": "1st Year",
        "1st year": "1st Year",
        "first year": "1st Year",

        "2": "2nd Year",
        "2nd": "2nd Year",
        "2nd year": "2nd Year",
        "second year": "2nd Year",

        "3": "3rd Year",
        "3rd": "3rd Year",
        "3rd year": "3rd Year",
        "third year": "3rd Year",

        "4": "4th Year",
        "4th": "4th Year",
        "4th year": "4th Year",
        "fourth year": "4th Year"
    }

    return mapping.get(lower, text)


def normalize_semester(value):
    text = clean_value(value)

    if not text:
        return ""

    lower = text.lower()

    mapping = {
        "1": "1st Sem",
        "sem 1": "1st Sem",
        "semester 1": "1st Sem",
        "1st sem": "1st Sem",
        "1st semester": "1st Sem",

        "2": "2nd Sem",
        "sem 2": "2nd Sem",
        "semester 2": "2nd Sem",
        "2nd sem": "2nd Sem",
        "2nd semester": "2nd Sem",

        "3": "3rd Sem",
        "sem 3": "3rd Sem",
        "semester 3": "3rd Sem",
        "3rd sem": "3rd Sem",
        "3rd semester": "3rd Sem",

        "4": "4th Sem",
        "sem 4": "4th Sem",
        "semester 4": "4th Sem",
        "4th sem": "4th Sem",
        "4th semester": "4th Sem",

        "5": "5th Sem",
        "sem 5": "5th Sem",
        "semester 5": "5th Sem",
        "5th sem": "5th Sem",
        "5th semester": "5th Sem",

        "6": "6th Sem",
        "sem 6": "6th Sem",
        "semester 6": "6th Sem",
        "6th sem": "6th Sem",
        "6th semester": "6th Sem",

        "7": "7th Sem",
        "sem 7": "7th Sem",
        "semester 7": "7th Sem",
        "7th sem": "7th Sem",
        "7th semester": "7th Sem",

        "8": "8th Sem",
        "sem 8": "8th Sem",
        "semester 8": "8th Sem",
        "8th sem": "8th Sem",
        "8th semester": "8th Sem"
    }

    return mapping.get(lower, text)


def format_date(value):
    """
    Always return DD-MM-YYYY.
    Handles:
    - datetime
    - date
    - Excel timestamps
    - DD-MM-YYYY
    - DD/MM/YYYY
    - YYYY-MM-DD
    - other common formats
    """

    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass

    if isinstance(value, (datetime, date)):
        return value.strftime("%d-%m-%Y")

    text = str(value).strip()

    if not text:
        return ""

    # Remove timestamp after date
    if " " in text:
        first_part = text.split(" ")[0]

        if re.match(r"^\d{4}-\d{2}-\d{2}$", first_part):
            text = first_part

    formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m-%d-%Y",
        "%m/%d/%Y"
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%d-%m-%Y")
        except ValueError:
            continue

    # Pandas fallback
    try:
        parsed = pd.to_datetime(text, dayfirst=True, errors="coerce")

        if not pd.isna(parsed):
            return parsed.strftime("%d-%m-%Y")
    except Exception:
        pass

    return text


def valid_date(date_text):
    try:
        parsed = datetime.strptime(date_text, "%d-%m-%Y")

        # Make sure the date is genuinely valid
        return parsed.strftime("%d-%m-%Y") == date_text
    except ValueError:
        return False


def safe_json_number(value):
    value = float(value or 0)

    if math.isnan(value) or math.isinf(value):
        return 0.0

    return round(value, 2)


# ============================================================
# READ EXCEL
# ============================================================

def read_excel_file(path):
    """
    Read an Excel file and convert different possible column
    names into the application's standard structure.
    """

    if not path.exists():
        return []

    try:
        df = pd.read_excel(
            path,
            sheet_name=SHEET_NAME
        )
    except Exception:
        try:
            df = pd.read_excel(path)
        except Exception as error:
            print("Excel read error:", error)
            return []

    if df.empty:
        return []

    # Rename columns
    rename_map = {}

    for column in df.columns:
        normalized = normalize_header(column)

        if normalized in HEADER_ALIASES:
            rename_map[column] = HEADER_ALIASES[normalized]

    df = df.rename(columns=rename_map)

    # Make sure all required columns exist
    for column in COLUMNS:
        if column not in df.columns:
            df[column] = ""

    df = df[COLUMNS]

    records = []

    for _, row in df.iterrows():

        record = {
            "id": clean_number(row["ID"]),
            "academic_year": normalize_academic_year(
                row["Academic Year"]
            ),
            "semester": normalize_semester(
                row["Semester"]
            ),
            "date": format_date(
                row["Date"]
            ),
            "category": clean_value(
                row["Category"]
            ),
            "amount": clean_number(
                row["Amount (₹)"]
            ),
            "payment_method": clean_value(
                row["Payment Method"]
            ),
            "description": clean_value(
                row["Description"]
            )
        }

        # Ignore completely empty rows
        if (
            not record["academic_year"]
            and not record["semester"]
            and not record["date"]
            and not record["category"]
            and record["amount"] == 0
            and not record["payment_method"]
            and not record["description"]
        ):
            continue

        records.append(record)

    return records


# ============================================================
# SAVE EXCEL
# ============================================================

def save_records(records):
    """
    Write all application records to the master Excel file.
    """

    rows = []

    for record in records:

        rows.append({
            "ID": int(record["id"]),
            "Academic Year": record["academic_year"],
            "Semester": record["semester"],
            "Date": record["date"],
            "Category": record["category"],
            "Amount (₹)": float(record["amount"]),
            "Payment Method": record["payment_method"],
            "Description": record["description"]
        })

    df = pd.DataFrame(rows, columns=COLUMNS)

    # Always create the file, even when there are no records
    with pd.ExcelWriter(
        MASTER_EXCEL,
        engine="openpyxl"
    ) as writer:

        df.to_excel(
            writer,
            sheet_name=SHEET_NAME,
            index=False
        )

        worksheet = writer.book[SHEET_NAME]

        # Freeze header
        worksheet.freeze_panes = "A2"

        # Column widths
        widths = {
            "A": 8,
            "B": 18,
            "C": 15,
            "D": 15,
            "E": 25,
            "F": 16,
            "G": 20,
            "H": 45
        }

        for column, width in widths.items():
            worksheet.column_dimensions[column].width = width


# ============================================================
# OLD DATA MIGRATION
# ============================================================

def record_key(record):
    return (
        normalize_academic_year(record["academic_year"]),
        normalize_semester(record["semester"]),
        format_date(record["date"]),
        clean_value(record["category"]).lower(),
        round(float(record["amount"]), 2),
        clean_value(record["payment_method"]).lower(),
        clean_value(record["description"]).lower()
    )


def migrate_old_data():
    """
    Import old Student_Expense_Tracker.xlsx records into the
    master file.

    The original old file is NEVER deleted or modified.
    """

    with FILE_LOCK:

        old_records = read_excel_file(OLD_EXCEL)
        master_records = read_excel_file(MASTER_EXCEL)

        # Nothing to migrate
        if not old_records and not master_records:
            if not MASTER_EXCEL.exists():
                save_records([])
            return

        combined = []
        existing_keys = set()

        # Master data first
        for record in master_records:

            key = record_key(record)

            if key in existing_keys:
                continue

            combined.append(record)
            existing_keys.add(key)

        # Then old data
        for record in old_records:

            key = record_key(record)

            if key in existing_keys:
                continue

            combined.append(record)
            existing_keys.add(key)

        # Re-number IDs sequentially
        for index, record in enumerate(combined, start=1):
            record["id"] = index

        save_records(combined)

        print(
            f"Excel ready: {len(combined)} expense records."
        )


# ============================================================
# GET ALL RECORDS
# ============================================================

def get_all_records():
    with FILE_LOCK:
        return read_excel_file(MASTER_EXCEL)


# ============================================================
# ROUTE
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
# GET EXPENSES
# ============================================================

@app.route("/api/expenses", methods=["GET"])
def api_get_expenses():

    try:
        records = get_all_records()

        return jsonify(records)

    except Exception as error:
        print("GET expenses error:", error)

        return jsonify({
            "error": str(error)
        }), 500


# ============================================================
# ADD EXPENSE
# ============================================================

@app.route("/api/expenses", methods=["POST"])
def api_add_expense():

    data = request.get_json(silent=True) or {}

    academic_year = normalize_academic_year(
        data.get("academic_year", "")
    )

    semester = normalize_semester(
        data.get("semester", "")
    )

    entered_date = clean_value(
        data.get("date", "")
    )

    category = clean_value(
        data.get("category", "")
    )

    payment_method = normalize_payment_method(
        data.get("payment_method", "")
    )

    description = clean_value(
        data.get("description", "")
    )

    amount = clean_number(
        data.get("amount", 0)
    )

    # --------------------------------------------------------
    # Validation
    # --------------------------------------------------------

    if academic_year not in YEAR_SEMESTERS:
        return jsonify({
            "error": "Invalid academic year."
        }), 400

    if semester not in YEAR_SEMESTERS[academic_year]:
        return jsonify({
            "error": "Invalid semester for the selected academic year."
        }), 400

    if not valid_date(entered_date):
        return jsonify({
            "error": "Date must be in DD-MM-YYYY format."
        }), 400

    if not category:
        return jsonify({
            "error": "Category is required."
        }), 400

    if amount < 0:
        return jsonify({
            "error": "Amount cannot be negative."
        }), 400

    with FILE_LOCK:

        records = read_excel_file(MASTER_EXCEL)

        new_id = 1

        if records:
            new_id = max(
                int(record["id"])
                for record in records
            ) + 1

        new_record = {
            "id": new_id,
            "academic_year": academic_year,
            "semester": semester,
            "date": entered_date,
            "category": category,
            "amount": amount,
            "payment_method": payment_method,
            "description": description
        }

        records.append(new_record)

        save_records(records)

    return jsonify({
        "success": True,
        "expense": new_record
    }), 201


# ============================================================
# UPDATE EXPENSE
# ============================================================

@app.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def api_update_expense(expense_id):

    data = request.get_json(silent=True) or {}

    academic_year = normalize_academic_year(
        data.get("academic_year", "")
    )

    semester = normalize_semester(
        data.get("semester", "")
    )

    entered_date = clean_value(
        data.get("date", "")
    )

    category = clean_value(
        data.get("category", "")
    )

    amount = clean_number(
        data.get("amount", 0)
    )

    payment_method = normalize_payment_method(
        data.get("payment_method", "")
    )

    description = clean_value(
        data.get("description", "")
    )

    if academic_year not in YEAR_SEMESTERS:
        return jsonify({
            "error": "Invalid academic year."
        }), 400

    if semester not in YEAR_SEMESTERS[academic_year]:
        return jsonify({
            "error": "Invalid semester for the selected academic year."
        }), 400

    if not valid_date(entered_date):
        return jsonify({
            "error": "Date must be in DD-MM-YYYY format."
        }), 400

    if not category:
        return jsonify({
            "error": "Category is required."
        }), 400

    if amount < 0:
        return jsonify({
            "error": "Amount cannot be negative."
        }), 400

    with FILE_LOCK:

        records = read_excel_file(MASTER_EXCEL)

        target = None

        for record in records:
            if int(record["id"]) == expense_id:
                target = record
                break

        if target is None:
            return jsonify({
                "error": "Expense not found."
            }), 404

        target["academic_year"] = academic_year
        target["semester"] = semester
        target["date"] = entered_date
        target["category"] = category
        target["amount"] = amount
        target["payment_method"] = payment_method
        target["description"] = description

        save_records(records)

    return jsonify({
        "success": True,
        "expense": target
    })


# ============================================================
# DELETE EXPENSE
# ============================================================

@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def api_delete_expense(expense_id):

    with FILE_LOCK:

        records = read_excel_file(MASTER_EXCEL)

        original_count = len(records)

        records = [
            record
            for record in records
            if int(record["id"]) != expense_id
        ]

        if len(records) == original_count:
            return jsonify({
                "error": "Expense not found."
            }), 404

        # Re-number IDs
        for index, record in enumerate(records, start=1):
            record["id"] = index

        save_records(records)

    return jsonify({
        "success": True
    })


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.route("/api/stats", methods=["GET"])
def api_stats():

    try:
        records = get_all_records()

        total_expenses = sum(
            float(record["amount"])
            for record in records
        )

        transaction_count = len(records)

        average_expense = (
            total_expenses / transaction_count
            if transaction_count
            else 0
        )

        # ----------------------------------------------------
        # Highest Expense
        # ----------------------------------------------------

        highest_expense = None

        if records:
            highest = max(
                records,
                key=lambda record: float(record["amount"])
            )

            highest_expense = {
                "id": int(highest["id"]),
                "amount": safe_json_number(highest["amount"]),
                "category": highest["category"],
                "date": highest["date"]
            }

        # ----------------------------------------------------
        # Latest Expense
        # ----------------------------------------------------

        latest_expense = None

        if records:

            def date_sort_key(record):
                try:
                    return datetime.strptime(
                        record["date"],
                        "%d-%m-%Y"
                    )
                except Exception:
                    return datetime.min

            latest = max(
                records,
                key=lambda record: (
                    date_sort_key(record),
                    int(record["id"])
                )
            )

            latest_expense = {
                "id": int(latest["id"]),
                "amount": safe_json_number(latest["amount"]),
                "category": latest["category"],
                "date": latest["date"]
            }

        # ----------------------------------------------------
        # Current Month
        # ----------------------------------------------------

        now = datetime.now()

        current_month_total = 0.0

        monthly_totals = {}

        for record in records:

            try:
                parsed_date = datetime.strptime(
                    record["date"],
                    "%d-%m-%Y"
                )

                month_key = (
                    parsed_date.year,
                    parsed_date.month
                )

                monthly_totals[month_key] = (
                    monthly_totals.get(
                        month_key,
                        0
                    )
                    +
                    float(record["amount"])
                )

                if (
                    parsed_date.year == now.year
                    and parsed_date.month == now.month
                ):
                    current_month_total += float(
                        record["amount"]
                    )

            except Exception:
                continue

        active_months = len(monthly_totals)

        monthly_average = (
            total_expenses / active_months
            if active_months
            else 0
        )

        # ----------------------------------------------------
        # Category Totals
        # ----------------------------------------------------

        category_totals = {}

        for record in records:

            category = (
                record["category"]
                or "Other"
            )

            category_totals[category] = (
                category_totals.get(category, 0)
                +
                float(record["amount"])
            )

        category_totals = {
            key: safe_json_number(value)
            for key, value
            in sorted(
                category_totals.items(),
                key=lambda item: item[1],
                reverse=True
            )
        }

        # ----------------------------------------------------
        # Academic Year Totals
        # ----------------------------------------------------

        year_totals = {
            "1st Year": 0.0,
            "2nd Year": 0.0,
            "3rd Year": 0.0,
            "4th Year": 0.0
        }

        for record in records:

            year = record["academic_year"]

            if year in year_totals:
                year_totals[year] += float(
                    record["amount"]
                )

        year_totals = {
            key: safe_json_number(value)
            for key, value
            in year_totals.items()
        }

        # ----------------------------------------------------
        # Semester Totals
        # ----------------------------------------------------

        semester_totals = {
            "1st Sem": 0.0,
            "2nd Sem": 0.0,
            "3rd Sem": 0.0,
            "4th Sem": 0.0,
            "5th Sem": 0.0,
            "6th Sem": 0.0,
            "7th Sem": 0.0,
            "8th Sem": 0.0
        }

        for record in records:

            semester = record["semester"]

            if semester in semester_totals:
                semester_totals[semester] += float(
                    record["amount"]
                )

        semester_totals = {
            key: safe_json_number(value)
            for key, value
            in semester_totals.items()
        }

        # ----------------------------------------------------
        # Payment Totals
        # ----------------------------------------------------

        payment_totals = {}

        for record in records:

            method = (
                record["payment_method"]
                or "Other"
            )

            payment_totals[method] = (
                payment_totals.get(method, 0)
                +
                float(record["amount"])
            )

        payment_totals = {
            key: safe_json_number(value)
            for key, value
            in payment_totals.items()
        }

        # Make sure Cash and UPI always exist
        payment_totals.setdefault("Cash", 0.0)
        payment_totals.setdefault("UPI", 0.0)

        # Dedicated Cash Spending value. This is calculated directly
        # from the current records and matches payment methods without
        # depending on exact capitalization/spacing in old Excel data.
        cash_spending = sum(
            float(record.get("amount", 0) or 0)
            for record in records
            if str(record.get("payment_method", "")).strip().casefold() == "cash"
        )

        # ----------------------------------------------------
        # Return
        # ----------------------------------------------------

        return jsonify({
            "total_expenses": safe_json_number(
                total_expenses
            ),

            "transaction_count":
                transaction_count,

            "average_expense":
                safe_json_number(
                    average_expense
                ),

            "this_month":
                safe_json_number(
                    current_month_total
                ),

            "monthly_average":
                safe_json_number(
                    monthly_average
                ),

            "highest_expense":
                highest_expense,

            "latest_expense":
                latest_expense,

            "category_totals":
                category_totals,

            "year_totals":
                year_totals,

            "semester_totals":
                semester_totals,

            "payment_totals":
                payment_totals,

            "cash_spending":
                safe_json_number(cash_spending)
        })

    except Exception as error:

        print("STATS ERROR:", error)

        return jsonify({
            "error": str(error)
        }), 500


# ============================================================
# DOWNLOAD EXCEL
# ============================================================

@app.route("/download-excel")
def download_excel():

    if not MASTER_EXCEL.exists():
        with FILE_LOCK:
            save_records([])

    return send_file(
        MASTER_EXCEL,
        as_attachment=True,
        download_name="Expense_Tracker_Master.xlsx"
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "master_file": str(MASTER_EXCEL),
        "old_file_exists": OLD_EXCEL.exists(),
        "master_file_exists": MASTER_EXCEL.exists(),
        "records": len(get_all_records())
    })


# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 60)
    print("PERSONAL EXPENSE TRACKER")
    print("=" * 60)
    print("Data folder:", DATA_DIR)
    print("Old Excel:", OLD_EXCEL)
    print("Master Excel:", MASTER_EXCEL)
    print()

    # Import old records
    migrate_old_data()

    print()
    print(
        "Total records:",
        len(get_all_records())
    )

    print()
    print("Open:")
    print("http://127.0.0.1:5000")
    print("=" * 60)
    print()

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )
