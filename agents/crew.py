"""Three-specialist CrewAI dev team + parallel planning orchestration."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings, get_settings
from .models import (
    DevPlan,
    FeatureRequest,
    FeatureResult,
    PlanBundle,
)
from .repo_tools import make_repo_tools
from .specialists import Specialist, get_specialist

logger = logging.getLogger(__name__)

_VERIFICATION_RULES = (
    "- Mobile components live behind `md:hidden`; desktop panels behind "
    "`hidden md:flex`. Preserve that split.\n"
    "- Preserve the IndexedDB project schema, the 500-step undo/redo history, "
    "and preview/export parity.\n"
    "- Keep existing Tauri and Next.js code working; avoid unrelated "
    "dependencies or refactors.\n"
    "- Verify with `npx tsc --noEmit`, `npm run lint`, and `npm run build`."
)


def build_llm(settings: Settings | None = None):
    """Create the LiteLLM-backed model for a specialist."""
    from crewai import LLM

    cfg = settings or get_settings()
    cfg.require_api_key()

    kwargs: dict[str, Any] = {
        "model": cfg.model,
        "temperature": cfg.temperature,
    }
    if cfg.api_key:
        kwargs["api_key"] = cfg.api_key
    if cfg.api_base:
        kwargs["base_url"] = cfg.api_base
    return LLM(**kwargs)


def _build_agent(
    specialist: Specialist,
    llm,
    tools: list,
    verbose: bool,
):
    from crewai import Agent

    return Agent(
        role=specialist.role,
        goal=specialist.goal,
        backstory=specialist.backstory,
        tools=tools,
        llm=llm,
        verbose=verbose,
        allow_delegation=False,
        max_iter=6,
    )


def _task_description(
    request: FeatureRequest,
    specialist: Specialist,
    repo_root: Path,
) -> str:
    files = "\n".join(f"  - {path}" for path in specialist.reference_files)
    return (
        f"You are the {specialist.label} for the Forgevyn desktop video editor.\n\n"
        f"FEATURE REQUEST\n{request.feature}\n\n"
        f"YOUR FOCUS\n{specialist.focus}\n\n"
        f"REPOSITORY\n{repo_root}\n\n"
        f"START WITH THESE FILES\n{files}\n\n"
        "INSTRUCTIONS\n"
        "1. Use `search_repo` to find the relevant symbols and files quickly, "
        "then `list_repo_files` / `read_repo_file` to inspect them. Never "
        "invent APIs or paths. For long files, page with `start_char` instead "
        "of re-reading the same range. Call each tool at most twice and never "
        "repeat an identical call.\n"
        "2. Design the smallest coherent change that fits the existing "
        "architecture and preserves current behavior.\n"
        "3. List the exact repo-relative files to modify and the concrete "
        "change for each (not vague advice).\n"
        "4. Call out risks, edge cases, and a test plan.\n"
        "5. Write a ready-to-paste `deepseek_prompt` that a coding model can "
        "execute in a fresh session.\n"
        "6. Return one DevPlan JSON object with these fields: feature, "
        "specialist, summary, implementation_steps, files (path/change), "
        "risks, test_plan, deepseek_prompt.\n\n"
        f"CONSTRAINTS\n{_VERIFICATION_RULES}\n"
    )


def build_deepseek_prompt(
    feature: str,
    specialist: Specialist,
    repo_root: Path,
) -> str:
    """Deterministic, copy-paste prompt used by --dry-run and as a fallback."""
    files = "\n".join(f"- {path}" for path in specialist.reference_files)
    return (
        f"You are implementing a change in the Forgevyn repository at {repo_root}.\n\n"
        f"ROLE\n{specialist.label}\n\n"
        f"FOCUS\n{specialist.focus}\n\n"
        f"FEATURE REQUEST\n{feature}\n\n"
        f"RELEVANT FILES - INSPECT FIRST\n{files}\n\n"
        "IMPLEMENTATION RULES\n"
        "- Read the existing code before changing it and preserve public APIs "
        "unless a change is required.\n"
        "- Keep the mobile/desktop split: mobile UI behind `md:hidden`, desktop "
        "panels behind `hidden md:flex`.\n"
        "- Preserve the IndexedDB stores, 500-step undo/redo history, and "
        "preview/export parity.\n"
        "- Design: use existing Tailwind tokens, preserve dark-mode contrast "
        "and responsive layouts, and do not change feature logic.\n"
        "- Core: verify clip start/trim/ripple math, playhead sync, pointer "
        "capture, undo/redo, and local persistence.\n"
        "- Backend: keep IPC commands async where needed, add the minimum "
        "capability for new commands, avoid holding locks across awaits, keep "
        "the updater/process plugins intact, and profile export/performance "
        "paths.\n"
        "- Do not add HTTP services, unrelated dependencies, or broad "
        "refactors.\n"
        "- After editing, run `npx tsc --noEmit`, `npm run lint`, and "
        "`npm run build` (and `cargo check` for Rust changes).\n\n"
        "OUTPUT\n"
        "1. A short summary of the change.\n"
        "2. An ordered implementation plan.\n"
        "3. For each file: exact path, the change, and why.\n"
        "4. Risks/edge cases and a test plan.\n"
        "Then implement the change."
    )


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Tolerate common LLM shape drift before validating DevPlan."""
    for field in ("implementation_steps", "risks", "test_plan"):
        value = payload.get(field)
        if isinstance(value, str):
            payload[field] = [value]
        elif value is None:
            payload[field] = []

    files = payload.get("files")
    if isinstance(files, str):
        payload["files"] = [{"path": files, "change": ""}]
    elif isinstance(files, list):
        payload["files"] = [
            {"path": item, "change": ""}
            if isinstance(item, str)
            else item
            for item in files
            if isinstance(item, (str, dict))
        ]
    elif files is None:
        payload["files"] = []

    return payload


def _coerce_plan(output: Any) -> DevPlan | None:
    candidates: list[dict[str, Any]] = []

    pydantic_value = getattr(output, "pydantic", None)
    if isinstance(pydantic_value, DevPlan):
        return pydantic_value
    if pydantic_value is not None:
        if hasattr(pydantic_value, "model_dump"):
            candidates.append(pydantic_value.model_dump())
        elif isinstance(pydantic_value, dict):
            candidates.append(pydantic_value)

    json_dict = getattr(output, "json_dict", None)
    if isinstance(json_dict, dict):
        candidates.append(json_dict)

    raw = getattr(output, "raw", "") or ""
    if raw.strip():
        try:
            from json_repair import repair_json

            repaired = repair_json(raw, return_objects=True)
            if isinstance(repaired, dict):
                candidates.append(repaired)
        except Exception as exc:  # noqa: BLE001 - best-effort parsing
            logger.debug("Could not parse raw plan JSON: %s", exc)

    for candidate in candidates:
        try:
            return DevPlan.model_validate(_normalize_payload(dict(candidate)))
        except Exception as exc:  # noqa: BLE001 - try the next candidate
            logger.debug("Rejected plan candidate: %s", exc)
    return None


def plan_with_crew(
    request: FeatureRequest,
    *,
    repo_root: Path,
    settings: Settings,
    verbose: bool,
) -> DevPlan:
    from crewai import Crew, Process, Task

    specialist = get_specialist(request.specialist)
    llm = build_llm(settings)
    tools = make_repo_tools(repo_root)
    agent = _build_agent(specialist, llm, tools, verbose)

    task = Task(
        description=_task_description(request, specialist, repo_root),
        expected_output=(
            "A single DevPlan JSON object with a summary, ordered steps, exact "
            "files/changes, risks, a test plan, and a DeepSeek prompt."
        ),
        agent=agent,
        output_pydantic=DevPlan,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=verbose,
        memory=False,
        cache=False,
        # Local-first CLI: never prompt to upload execution traces.
        tracing=False,
        share_crew=False,
    )
    output = crew.kickoff()

    plan = _coerce_plan(output)
    if plan is None:
        plan = DevPlan(summary=(getattr(output, "raw", "") or "").strip()[:4000])

    plan.feature = request.feature
    plan.specialist = specialist.label
    if not plan.deepseek_prompt:
        plan.deepseek_prompt = build_deepseek_prompt(
            request.feature, specialist, repo_root
        )
    return plan


def dry_run_plan(
    request: FeatureRequest,
    *,
    repo_root: Path,
) -> DevPlan:
    specialist = get_specialist(request.specialist)
    steps = [
        f"Read {path} to confirm the current API."
        for path in specialist.reference_files[:4]
    ]
    steps.extend(specialist.starter_steps)

    return DevPlan(
        feature=request.feature,
        specialist=specialist.label,
        summary=(
            f"Offline dry-run plan for '{request.feature}' from the "
            f"{specialist.label} perspective. Use the DeepSeek prompt below "
            "for the full implementation plan."
        ),
        implementation_steps=steps,
        files=[],
        risks=list(specialist.starter_risks),
        test_plan=list(specialist.starter_tests),
        deepseek_prompt=build_deepseek_prompt(
            request.feature, specialist, repo_root
        ),
    )


def run_features(
    requests: list[FeatureRequest],
    *,
    repo_root: Path,
    plan_only: bool,
    sequential: bool,
    workers: int,
    verbose: bool,
) -> PlanBundle:
    """Run the requested features in parallel (default) or sequentially."""
    if not requests:
        raise ValueError("At least one feature request is required.")

    settings = get_settings()
    if not plan_only:
        settings.require_api_key()

    worker_count = max(1, min(int(workers), len(requests), 8))

    def run_one(request: FeatureRequest) -> FeatureResult:
        specialist = get_specialist(request.specialist)
        try:
            plan = (
                dry_run_plan(request, repo_root=repo_root)
                if plan_only
                else plan_with_crew(
                    request,
                    repo_root=repo_root,
                    settings=settings,
                    verbose=verbose,
                )
            )
            return FeatureResult(
                feature=request.feature,
                specialist=specialist.label,
                plan=plan,
            )
        except Exception as exc:  # noqa: BLE001 - one failure must not stop the batch
            return FeatureResult(
                feature=request.feature,
                specialist=specialist.label,
                error=f"{type(exc).__name__}: {exc}",
            )

    if sequential or len(requests) == 1:
        results = [run_one(request) for request in requests]
    else:
        with ThreadPoolExecutor(max_workers=worker_count) as pool:
            results = list(pool.map(run_one, requests))

    return PlanBundle(
        generated_at=datetime.now(timezone.utc).isoformat(),
        repo_root=str(repo_root),
        model="dry-run" if plan_only else settings.model,
        mode="dry-run" if plan_only else "crew",
        results=results,
    )


__all__ = [
    "build_deepseek_prompt",
    "build_llm",
    "dry_run_plan",
    "plan_with_crew",
    "run_features",
]
