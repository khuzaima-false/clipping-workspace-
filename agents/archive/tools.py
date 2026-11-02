# ARCHIVED 2026-11-02: the old project scaffold/snapshot tools.
# The dev-team CLI uses repo_tools.py instead.

"""Deterministic filesystem tools used by the CrewAI agents.

The agents reason about the results, but the actual folder/manifest work is
performed here with explicit path validation and no LLM-controlled file writes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from crewai.tools import tool

REQUIRED_DIRS = ("media", "exports", "snapshots", "notes")
PROJECT_MANIFEST = "project.json"


@dataclass
class ScaffoldRecord:
    project_root: Path
    project_name: str
    manifest_path: Path | None = None
    manifest_created: bool = False
    created_dirs: list[str] = field(default_factory=list)
    existing_dirs: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)


@dataclass
class SnapshotRecord:
    project_root: Path
    snapshot_path: Path
    exists: bool = False
    checked: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def _dump(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


def make_scaffold_tool(record: ScaffoldRecord):
    """Build the initialization tool bound to one validated project root."""

    @tool("initialize_project_structure")
    def initialize_project_structure(project_name: str = "") -> str:
        """Create the standard Forgevyn project folders and project.json.

        Call this exactly once for the project root. Pass the human-readable
        project name. Never writes outside the project root.
        """
        root = record.project_root
        root.mkdir(parents=True, exist_ok=True)

        name = (project_name or record.project_name).strip() or record.project_name

        for dirname in REQUIRED_DIRS:
            target = root / dirname
            if target.is_dir():
                record.existing_dirs.append(dirname)
            elif target.exists():
                record.conflicts.append(
                    f"{dirname} exists but is not a directory"
                )
            else:
                target.mkdir(parents=True, exist_ok=True)
                record.created_dirs.append(dirname)

        manifest = root / PROJECT_MANIFEST
        record.manifest_path = manifest

        if manifest.exists():
            record.manifest_created = False
        elif not record.conflicts:
            now = datetime.now(timezone.utc).isoformat()  # noqa: UP017 - Python 3.10
            manifest.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "name": name,
                        "createdAt": now,
                        "updatedAt": now,
                        "managedBy": "Forgevyn CrewAI",
                        "structure": list(REQUIRED_DIRS),
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            record.manifest_created = True

        return _dump(
            {
                "ok": not record.conflicts,
                "project_root": str(root),
                "project_name": name,
                "manifest_path": str(manifest),
                "manifest_created": record.manifest_created,
                "created_dirs": record.created_dirs,
                "existing_dirs": record.existing_dirs,
                "conflicts": record.conflicts,
            }
        )

    return initialize_project_structure


def make_verify_tool(record: SnapshotRecord):
    """Build the read-only snapshot verification tool."""

    @tool("verify_local_snapshot")
    def verify_local_snapshot() -> str:
        """Verify a local snapshot has project.json and the standard folders.

        Call this exactly once for the configured snapshot path. Read-only.
        """
        root = record.snapshot_path
        record.exists = root.is_dir()

        for filename in (PROJECT_MANIFEST,):
            record.checked.append(filename)
            if not (root / filename).is_file():
                record.missing.append(filename)

        for dirname in REQUIRED_DIRS:
            relative = f"{dirname}/"
            record.checked.append(relative)
            if not (root / dirname).is_dir():
                record.missing.append(relative)

        return _dump(
            {
                "ok": record.exists and not record.missing,
                "project_root": str(record.project_root),
                "snapshot_path": str(root),
                "exists": record.exists,
                "checked": record.checked,
                "missing": record.missing,
            }
        )

    return verify_local_snapshot
