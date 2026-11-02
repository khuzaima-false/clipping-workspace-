# Archived server components

As of **2026-11-02**, the Forgevyn CrewAI integration is a **local CLI dev
team**, not an HTTP service.

These files are kept for reference only:

- `service.py` — the previous FastAPI bridge (`GET /health`, `POST /run`).
- `tools.py` — the previous project-scaffold/snapshot tools.

They are **not imported** by `agents.main` and no server runs on port `8765`.
`fastapi` and `uvicorn` were removed from `agents/requirements.txt`.

Restoring the bridge would also require the pre-refactor `models.py` / `crew.py`
and those two web dependencies; it is not part of the current workflow.
