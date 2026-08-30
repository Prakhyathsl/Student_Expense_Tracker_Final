# Render deployment

This project is prepared for Render as a Flask web service.

## Important data-storage note

The app now uses a database for live data:
- Local desktop use: SQLite (`data/expense_tracker.db`)
- Hosted use: PostgreSQL when the `DATABASE_URL` environment variable is set

Do **not** rely on the local SQLite file on a Render Free web service for permanent data. Render Free web services have an ephemeral filesystem. Configure `DATABASE_URL` to a persistent PostgreSQL database before using the live app with real data.

## Deploy

1. Create a Render account.
2. Put this project in a GitHub repository.
3. In Render choose **New -> Web Service** and connect the repository.
4. Build command:
   `pip install -r requirements.txt`
5. Start command:
   `gunicorn --bind 0.0.0.0:$PORT app:app`
6. Add an environment variable:
   `DATABASE_URL=<your PostgreSQL connection string>`
7. Deploy.
8. Open the generated `https://...onrender.com` URL.

The app automatically creates its database tables on first request.

## Local use

Run:

`python app.py`

or use the existing `run.bat` if included.
