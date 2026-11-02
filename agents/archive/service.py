# ARCHIVED 2026-11-02: the old FastAPI HTTP bridge.
# Not imported by the dev-team CLI; kept for reference only.
# Restoring it requires fastapi/uvicorn plus the pre-refactor models/crew.

"""Local-only FastAPI bridge for the Forgevyn crew.

Run with:
    python -m agents.service
    # or: uvicorn agents.service:app --host 127.0.0.1 --port 8765

The Next.js/Tauri app calls POST /run and reads JSON. This module deliberately
does not import CrewAI at startup, so /health and the API docs keep working
while the Python environment is being set up.
"""

from __future__ import annotations

import logging
import platform

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    ConfigurationError,
    get_settings,
    python_supported,
    resolve_project_path,
    resolve_snapshot_path,
)
from .models import HealthResponse, RunRequest, RunResponse

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Forgevyn Crew Service",
    version="0.1.0",
    description=(
        "Local bridge for the Project Manager and Asset Tracker CrewAI agents. "
        "Bind to 127.0.0.1 only â€” this service can create project folders."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "service": "forgevyn-crew",
        "health": "/health",
        "run": "/run",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    crewai_installed = False
    crewai_version: str | None = None
    try:
        import crewai

        crewai_installed = True
        crewai_version = getattr(crewai, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        logger.debug("CrewAI is not importable: %s", exc)

    return HealthResponse(
        status="ok",
        crewai_installed=crewai_installed,
        crewai_version=crewai_version,
        llm_configured=bool(settings.api_key),
        model=settings.model,
        process=settings.process,
        python_version=platform.python_version(),
        python_supported=python_supported(),
    )


@app.post("/run", response_model=RunResponse)
def run_crew(request: RunRequest) -> RunResponse:
    try:
        project_root = resolve_project_path(request.project_path)
        snapshot_path = resolve_snapshot_path(request.snapshot_path, project_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        # Imported lazily so the bridge boots without the ML dependency stack.
        from .crew import run_workflow
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "CrewAI is not installed or could not be imported "
                f"({exc.name}). Use Python 3.12/3.13 and run "
                "`pip install -r agents/requirements.txt`."
            ),
        ) from exc

    try:
        return run_workflow(
            task=request.task,
            project_root=project_root,
            project_name=request.project_name,
            snapshot_path=snapshot_path,
        )
    except ConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Crew execution failed: {exc}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
