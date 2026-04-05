# Patent Editor Backend

## Layout

Application code is in the `app/` directory. Core logic lives in `app/internal/`.

```
app
├── __main__.py                     # FastAPI app and all routes
├── models.py                       # SQLAlchemy ORM models (Document, DocumentVersion)
├── schemas.py                      # Pydantic request/response schemas
├── utils.py                        # HTML stripping utility
├── internal
│   ├── ai.py                       # OpenAI async streaming integration
│   ├── data.py                     # Seed patent documents
│   ├── db.py                       # SQLAlchemy engine + session factory
│   ├── prompt.py                   # System prompt for patent claim review
│   └── simple_upgrade_workflow.py  # Agentic iterative document improvement workflow
```

## First-time setup

```sh
# Create a virtual environment
python -m venv env

# Activate your virtual environment
source env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Make sure you create a `.env` file (see `.env.example`) with your OpenAI API key.

## Running locally

```sh
uvicorn app.__main__:app --reload
```

## Database

On startup, the app initialises an in-memory SQLite database and seeds it with two sample patent documents. This is intentionally ephemeral — every server restart begins with a clean, reproducible state. To use a persistent database, change the `DATABASE_URL` in `app/internal/db.py`.
