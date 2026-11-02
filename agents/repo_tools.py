"""Read-only, sandboxed repository tools for the developer agents."""

from __future__ import annotations

import fnmatch
import os
import re
from pathlib import Path

from crewai.tools import tool

IGNORED_DIRS = {
    ".git",
    ".next",
    ".turbo",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "out",
    "target",
    "dist",
    "build",
    "coverage",
    ".idea",
    ".vscode",
}
SENSITIVE_NAMES = {
    ".env",
    ".env.local",
    "id_rsa",
    "id_ed25519",
}
SENSITIVE_SUFFIXES = (".pem", ".key", ".p12", ".pfx")
BINARY_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".bmp",
    ".mp4",
    ".webm",
    ".mov",
    ".mkv",
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".zip",
    ".gz",
    ".tar",
    ".whl",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".wasm",
    ".map",
}


def _is_sensitive(relative: Path) -> bool:
    name = relative.name
    if name in SENSITIVE_NAMES:
        return True
    if name.startswith(".env.") and name != ".env.example":
        return True
    if name.endswith(SENSITIVE_SUFFIXES):
        return True
    return bool(
        len(relative.parts) >= 2
        and relative.parts[0] == "src-tauri"
        and relative.parts[1] == "keys"
    )


def _normalize_repo_path(raw: str) -> str:
    """Accept LLM-style paths such as ``/src/...``, ``./src/...``, ``@src/...``."""
    value = (raw or "").strip().strip('"').strip("'")
    value = value.removeprefix("@")
    while value.startswith("./"):
        value = value[2:]
    # A model may send a web-style leading slash; treat it as repo-relative.
    # Keep real Windows drive paths (C:\...) and UNC paths intact.
    if value.startswith(("/", "\\")) and not re.match(r"^[A-Za-z]:[\\/]", value):
        value = value.lstrip("/\\")
    return value


def _safe_path(root: Path, raw: str) -> Path:
    candidate = (root / _normalize_repo_path(raw)).expanduser().resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"'{raw}' is outside the repository.")
    return candidate


def _positive_int(value: object, default: int, maximum: int) -> int:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return max(1, min(parsed, maximum))


def _is_ignored(relative: Path) -> bool:
    return any(part in IGNORED_DIRS for part in relative.parts)


def make_repo_tools(root: Path):
    """Create the read-only tools bound to one repository root."""
    repo_root = root.expanduser().resolve()

    @tool("list_repo_files")
    def list_repo_files(
        directory: str = ".",
        pattern: str = "*",
        limit: int = 200,
    ) -> str:
        """List repository files under a directory.

        Args:
            directory: Repo-relative directory (default: repository root).
            pattern: fnmatch pattern, e.g. "*.tsx" or "src/**/*.ts".
            limit: Maximum number of entries to return (1-500).
        """
        try:
            base = _safe_path(repo_root, directory)
        except ValueError as exc:
            return f"Error: {exc}"

        if not base.is_dir():
            return f"Error: '{directory}' is not a directory."

        max_entries = _positive_int(limit, 200, 500)
        matches: list[str] = []
        truncated = False

        for current, dirs, files in os.walk(base):
            current_path = Path(current)
            dirs[:] = sorted(
                name
                for name in dirs
                if name not in IGNORED_DIRS
                and not _is_sensitive((current_path / name).relative_to(repo_root))
            )
            for name in sorted(files):
                full = current_path / name
                relative = full.relative_to(repo_root)
                if _is_sensitive(relative):
                    continue
                rel_posix = relative.as_posix()
                if fnmatch.fnmatch(rel_posix, pattern) or fnmatch.fnmatch(name, pattern):
                    matches.append(rel_posix)
                    if len(matches) >= max_entries:
                        truncated = True
                        break
            if truncated:
                break

        if not matches:
            return f"No files matched '{pattern}' under '{directory}'."

        header = f"{len(matches)} file(s) under '{directory}' matching '{pattern}'"
        if truncated:
            header += f" (limited to {max_entries})"
        return header + ":\n" + "\n".join(matches)

    @tool("read_repo_file")
    def read_repo_file(
        path: str,
        max_chars: int = 14_000,
        start_char: int = 0,
    ) -> str:
        """Read a UTF-8 text file from the repository.

        Args:
            path: Repo-relative file path, e.g. "src/store/editor.ts".
            max_chars: Maximum characters to return (default 14000, cap 40000).
            start_char: Character offset to start from (for paging long files).
        """
        relative = Path(_normalize_repo_path(path))
        if _is_ignored(relative):
            return (
                f"Error: '{path}' is inside an ignored build/dependency directory."
            )
        if _is_sensitive(relative):
            return f"Error: '{path}' is a sensitive file and cannot be read by the crew."

        try:
            target = _safe_path(repo_root, path)
        except ValueError as exc:
            return f"Error: {exc}"

        if not target.is_file():
            return f"Error: '{path}' is not a file."

        try:
            size = target.stat().st_size
        except OSError as exc:
            return f"Error reading '{path}': {exc}"

        if size > 4_000_000:
            return (
                f"Error: '{path}' is too large ({size} bytes). "
                "Read a smaller source file or narrow the task."
            )

        limit = _positive_int(max_chars, 14_000, 40_000)
        try:
            content = target.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return f"Error reading '{path}': {exc}"

        total = len(content)
        try:
            start = max(0, min(int(start_char), total))
        except (TypeError, ValueError):
            start = 0
        end = min(start + limit, total)

        start_line = content.count("\n", 0, start) + 1
        numbered = [
            f"{start_line + offset:5d}  {line}"
            for offset, line in enumerate(content[start:end].splitlines())
        ]

        header = (
            f"# {target.relative_to(repo_root).as_posix()} "
            f"({total} chars; showing {start}-{end})"
        )
        body = "\n".join(numbered)
        if end < total:
            body += (
                f"\n\n[... next page: call read_repo_file with "
                f"start_char={end} ...]"
            )
        return header + "\n" + body

    @tool("search_repo")
    def search_repo(
        query: str,
        file_pattern: str = "*.ts,*.tsx,*.rs,*.json,*.md",
        limit: int = 40,
    ) -> str:
        """Search repository text files (literal or regex, case-insensitive).

        Args:
            query: Symbol, keyword, or regular expression, e.g. "keydown" or "splitClip".
            file_pattern: Comma-separated fnmatch patterns (default: TS/TSX/Rust/JSON/MD).
            limit: Maximum matching lines to return (1-200).
        """
        needle = (query or "").strip()
        if not needle:
            return "Error: a search query is required."

        try:
            pattern = re.compile(needle, re.IGNORECASE)
        except re.error:
            pattern = re.compile(re.escape(needle), re.IGNORECASE)

        patterns = [
            part.strip()
            for part in re.split(r"[;,]", file_pattern)
            if part.strip()
        ] or ["*"]
        max_matches = _positive_int(limit, 40, 200)
        matches: list[str] = []
        truncated = False

        for current, dirs, files in os.walk(repo_root):
            current_path = Path(current)
            dirs[:] = sorted(name for name in dirs if name not in IGNORED_DIRS)
            for name in sorted(files):
                full = current_path / name
                relative = full.relative_to(repo_root)
                if _is_sensitive(relative) or _is_ignored(relative):
                    continue
                rel_posix = relative.as_posix()
                if not any(
                    fnmatch.fnmatch(rel_posix, item)
                    or fnmatch.fnmatch(name, item)
                    for item in patterns
                ):
                    continue
                if full.suffix.lower() in BINARY_SUFFIXES:
                    continue
                try:
                    if full.stat().st_size > 1_500_000:
                        continue
                    with full.open("r", encoding="utf-8", errors="ignore") as handle:
                        for line_number, line in enumerate(handle, 1):
                            if pattern.search(line):
                                matches.append(
                                    f"{rel_posix}:{line_number}: {line.strip()[:240]}"
                                )
                                if len(matches) >= max_matches:
                                    truncated = True
                                    break
                except OSError:
                    continue
                if truncated:
                    break
            if truncated:
                break

        if not matches:
            return f"No matches for '{query}' in {file_pattern}."

        header = f"{len(matches)} match(es) for '{query}'"
        if truncated:
            header += f" (limited to {max_matches})"
        return header + ":\n" + "\n".join(matches)

    return [list_repo_files, read_repo_file, search_repo]
