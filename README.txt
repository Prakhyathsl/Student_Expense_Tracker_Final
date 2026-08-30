Student Expense Tracker - Final

This version does NOT include the Monthly Budget / Monthly Allowance feature.
The existing Dashboard, Expenses, Categories, Academic Year & Semester, Savings, Backup & Export, and Settings features are preserved.

Run:
  python app.py

Then open http://127.0.0.1:5000

Keep your existing data folder if you already have one.


Existing data
--------------
The user's existing 57 expense records are included in seed_expenses.json.
They are imported automatically only when the database is empty. New expenses
continue from the existing records and are not overwritten by the seed.
The imported records total ₹871,344.16.

Live hosting
------------
For Render, set DATABASE_URL to a persistent PostgreSQL database. The seed
records will be inserted once into that database if it is empty.
