# AI Patent Editor

![CI](https://github.com/Paul-543NA/AI-patent-editor/actions/workflows/ci.yml/badge.svg)

**Streaming LLM-powered patent claim analysis with an agentic iterative improvement workflow**

A full-stack web application that brings real-time AI assistance to patent drafting. The system reviews patent claims against formal legal grammar rules as you type, and can autonomously apply those improvements claim-by-claim with live progress telemetry — all without blocking the editor.

---

## Overview

Patent claims have formal legal grammar rules — antecedent basis, transitional phrases, claim dependency structure — that make them an unusually well-defined structured-output evaluation task for LLMs. Unlike general text editing, you can check LLM output against explicit rules programmatically, not just vibe-check it. This makes the patent domain a good testbed for building a production-quality AI-assisted editor where reliability matters.

The project focuses on three engineering problems that come up in any production LLM application:

1. **Streaming structured output is unreliable** — JSON streamed over WebSocket arrives in arbitrary chunks. The client implements a fault-tolerant multi-strategy parser rather than assuming the response is well-formed.
2. **Single-shot improvement is insufficient** — a reviewer that identifies issues and an editor that rewrites claims are separate concerns. Conflating them into one prompt increases hallucination risk. The upgrade workflow separates them and runs up to 5 review-then-edit cycles.
3. **Long-running AI operations need decoupled telemetry** — the upgrade endpoint uses HTTP for the final result and a separate WebSocket channel for per-claim progress updates, so the UI stays responsive throughout.

---

## Screenshots

![App screenshot](media/Screenshot%202026-04-05%20at%2018.10.32.png)

## Demo

<video src="media/app_demp.mov" controls width="100%"></video>

---

## Key Technical Features

**Fault-tolerant streaming JSON parsing**
The AI review endpoint streams structured JSON over WebSocket in chunks. Because the client concatenates chunks until a sentinel `--- Done sending suggestions ---` is received, the complete response may be malformed at chunk boundaries (truncated strings, missing commas). The client (`AppContext.tsx`) implements three recovery strategies applied in priority order:
1. Extract individual issue objects via regex and parse each independently.
2. Attempt structural JSON repair (missing commas, unquoted keys, trailing commas) on failed objects.
3. Last resort: mine key-value patterns from the raw string to reconstruct suggestion fields.

**Iterative agentic improvement loop**
`SimpleDocumentUpgradeWorkflow` runs up to 5 review-then-edit cycles. Each iteration calls `review_document()` to get structured suggestions, groups them by target claim, applies the highest-severity suggestion per claim (one at a time to avoid conflicting edits), then feeds the improved document back into the next iteration. The loop terminates early if the reviewer returns zero suggestions, preventing unnecessary API calls.

**Dual-channel async telemetry**
The upgrade flow uses two communication channels simultaneously: the HTTP POST to `/document/{id}/upgrade` blocks until completion and returns the final summary; a separate WebSocket at `/ws/upgrade/{document_id}/{session_id}` streams per-claim progress cards in real time. The client opens the WebSocket before issuing the HTTP request to avoid missing early updates. UUID session IDs allow multiple concurrent upgrades across documents.

**Dual-parse architecture**
The editor stores and renders HTML (via TipTap/ProseMirror). The AI review receives plain text via `strip_html()`. This keeps the LLM context clean and avoids wasting tokens on markup while preserving rich formatting in the editor.

**Debounced WebSocket on keystroke**
Document changes are sent to the review endpoint with a 500ms debounce (`AppContext.tsx`). This limits API calls during active typing without introducing noticeable latency for the suggestions response.

**Thread-safe in-memory SQLite**
`db.py` uses SQLAlchemy's `StaticPool` — a non-obvious choice required for in-memory SQLite when multiple threads share the same connection. Without it, SQLite's thread-safety restrictions cause intermittent failures under FastAPI's async request handling.

---

## Architecture

```
Browser
  ├── TipTap Editor (HTML content)
  │
  ├── WebSocket /ws  ──────────────────────────────── FastAPI
  │     └── debounced on keystroke (500ms)           └── strip_html()
  │           └── streams JSON chunks ◄──────────────── OpenAI stream (json_object mode)
  │                 └── 3-strategy parser in AppContext
  │
  ├── WebSocket /ws/upgrade/{doc_id}/{session_id} ──── SimpleDocumentUpgradeWorkflow
  │     └── per-claim progress events                   ├── iteration 1..N (max 5)
  │           ├── upgrade_started                       │   ├── review_document() → suggestions
  │           ├── suggestions_found                     │   └── _upgrade_single_claim() per claim
  │           ├── processing_suggestion                 └── reconstruct → new DocumentVersion
  │           ├── suggestion_applied / skipped
  │           └── upgrade_complete
  │
  └── HTTP REST (Axios)
        ├── GET  /documents                     → list all patents
        ├── GET  /document/{id}                 → load patent (current version content)
        ├── GET  /document/{id}/versions        → version history
        ├── POST /document/{id}/version         → create new version
        ├── PUT  /document/{id}/version/{vid}   → update version content
        ├── POST /document/{id}/switch-version/{vid}
        ├── DELETE /document/{id}/version/{vid}
        ├── POST /save/{id}/version/{vid}       → save current content
        └── POST /document/{id}/upgrade         → trigger agentic upgrade
```

---

## ML Engineering Design Decisions

**Why an iterative loop instead of single-shot improvement**
A single prompt that both identifies issues and rewrites all claims is prone to hallucinating technical scope (adding claims that weren't in the original, broadening or narrowing claims unintentionally). Separating the reviewer from the editor keeps each prompt focused: `review_document` produces a structured list of issues against explicit rules; `_upgrade_single_claim` rewrites exactly one claim in response to exactly one suggestion. The loop then measures whether applying a suggestion eliminated it from the next review pass, giving an implicit quality signal.

**Temperature 0.2 for claim editing**
Legal text requires consistency above creativity. A temperature of 0.2 keeps claim rewrites close to the original language while still allowing necessary corrections. The description generator uses 0.3 (slightly more creative since it generates new prose rather than editing existing claims). The reviewer uses the model's default temperature since suggestion variety is acceptable there.

**Claim-to-paragraph mapping**
The review prompt instructs the model to identify the paragraph number of each issue. Patent claims are paragraphs, so numbers are 1:1 in well-structured documents. The mapping `max(1, min(suggestion.paragraph, len(claims)))` clamps out-of-range paragraph numbers rather than dropping the suggestion. This is an approximation — it works because the model's paragraph numbering tracks claim numbering closely when the document is well-structured, and the clamping prevents index errors on edge cases.

---

## Tech Stack

| | Frontend | Backend |
|---|---|---|
| **Framework** | React 18 + TypeScript | FastAPI 0.110 |
| **Build** | Vite 5 | Uvicorn |
| **Editor** | TipTap 2 (ProseMirror) | — |
| **Styling** | Tailwind CSS 4 + Emotion | — |
| **State** | React Context + hooks | — |
| **HTTP** | Axios | — |
| **WebSocket** | react-use-websocket | websockets 12 |
| **Database** | — | SQLAlchemy 2 + SQLite |
| **Validation** | — | Pydantic 2 |
| **AI** | — | OpenAI SDK (async streaming) |
| **Container** | Docker + Compose | Docker + Compose |

---

## Quick Start

### Docker (recommended)

```bash
cp server/.env.example server/.env
# Add your OpenAI API key to server/.env

docker-compose up --build
```

App runs at `http://localhost:5173`. Backend API at `http://localhost:8000`.

### Local development

**Backend**
```bash
cd server
python -m venv env && source env/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your OPENAI_API_KEY
uvicorn app.__main__:app --reload
```

**Frontend**
```bash
cd client
npm install
npm run dev
```

---

## Project Structure

```
├── client/                         # React + TypeScript frontend
│   └── src/
│       ├── App.tsx                 # App shell
│       ├── contexts/AppContext.tsx  # Central state, WebSocket handling, JSON parser
│       └── internal/               # UI components
│           ├── Document.tsx
│           ├── Editor.tsx
│           ├── SuggestionCard.tsx
│           ├── PatentSelector/
│           ├── VersionSelector/
│           └── UpgradeProgressOverlay/
├── server/                         # FastAPI Python backend
│   └── app/
│       ├── __main__.py             # All routes + WebSocket endpoints
│       ├── models.py               # SQLAlchemy models
│       ├── schemas.py              # Pydantic schemas
│       ├── utils.py                # HTML → plain text
│       └── internal/
│           ├── ai.py               # OpenAI async streaming
│           ├── prompt.py           # Patent review system prompt
│           ├── simple_upgrade_workflow.py  # Agentic improvement loop
│           ├── data.py             # Seed patent documents
│           └── db.py               # Database setup
└── docker-compose.yml
```

---

## Known Limitations

- **Ephemeral database** — SQLite runs in-memory (`sqlite:///:memory:`). All data resets on server restart. This is intentional for demo reproducibility; switching to file-based or hosted Postgres requires changing one line in `db.py`.
- **No authentication** — suitable for local/demo use only.
- **CORS wildcard** — `allow_origins=["*"]` is fine for local development; restrict in production.
- **API cost** — `gpt-4o-mini` costs approximately $0.002 per review. A production deployment would need rate limiting and cost caps per user.
- **Two sample patents** — the seed data includes two hardcoded patents. Adding more documents requires inserting rows into the `Document` and `DocumentVersion` tables on startup.
