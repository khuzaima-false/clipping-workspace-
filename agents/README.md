# Forgevyn Dev Crew

An **offline multi-agent dev-team CLI** for planning Forgevyn features. It runs
three CrewAI specialists locally from your terminal and prints code plans,
file-level changes, risks, tests, and ready-to-paste DeepSeek implementation
prompts.

The old FastAPI bridge is archived in `agents/archive/`; there is no server on
port `8765` and FastAPI/uvicorn are no longer required.

## Specialists

| Specialist | Focus | Primary prefixes |
| --- | --- | --- |
| **UI_UX_Design_Specialist** | Visual layout, Tailwind CSS design systems, component styling, UX polish, dark-mode palettes, responsive layouts | `design:`, `ui:` |
| **Feature_Specialist_Core** | React/Next.js state logic, timeline canvas architecture, user interactions, client-side features, local persistence | `feature:`, `core:` |
| **Feature_Specialist_Backend** | Tauri v2 Rust IPC handlers, async state, export pipelines, performance optimization, deep system tasks | `backend:`, `rust:` |

Generic feature work defaults to **Feature_Specialist_Core**. Ties favor core,
then design, then backend. Legacy aliases still work: `timeline:` / `color:` /
`grading:` -> core, `bug:` / `tauri:` -> backend, `frontend:` -> core, and
`ux:` -> design.

The agents have **read-only repo tools** (`list_repo_files`, `read_repo_file`,
`search_repo`) so they inspect the real code instead of guessing. `read_repo_file`
supports `start_char` paging for large files. Paths are sandboxed to the repo;
`.env`, keys, and other sensitive files are blocked.

## Setup

The environment is already installed at `agents/.venv` with Python 3.13.17 and
CrewAI 1.15.33. On a fresh machine:

```powershell
cd "C:\Users\user\Desktop\clippin workspace"
py install 3.13          # if Python 3.13 is not installed
py -3.13 -m venv agents\.venv
.\agents\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r agents\requirements.txt
Copy-Item agents\.env.example agents\.env
```

macOS / Linux:

```bash
python3.13 -m venv agents/.venv
source agents/.venv/bin/activate
pip install -r agents/requirements.txt
cp agents/.env.example agents/.env
```

## Configure

Edit `agents/.env`:

```dotenv
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_API_BASE=https://api.deepseek.com/v1
CREW_LLM_PROVIDER=deepseek
CREW_MODEL=deepseek/deepseek-chat
AGENTS_MAX_WORKERS=3
```

- **DeepSeek** is the default. **OpenAI** or any OpenAI-compatible endpoint also
  works (`CREW_LLM_PROVIDER=openai-compatible`, `OPENAI_API_BASE=...`).
- `--dry-run` needs **no API key**; it emits deterministic plans and prompts.
- `OTEL_SDK_DISABLED=true` is set for local-first privacy; CrewAI tracing is
  also disabled in code for CLI runs.

## CLI usage

Run from the repository root:

```powershell
cd "C:\Users\user\Desktop\clippin workspace"
.\agents\.venv\Scripts\Activate.ps1
```

### One feature (offline dry run - no key)

```powershell
python -m agents.main --dry-run -f "design: refine the dark-mode palette on the settings page"
```

### Multiple features in parallel (default)

```powershell
python -m agents.main `
  -f "design: polish the editor toolbar and dark-mode palette" `
  -f "core: add clip drag-and-drop between tracks" `
  -f "backend: fix the async IPC state bug in the Tauri updater"
```

Each feature is routed to the matching specialist and runs concurrently
(default: 3 workers). Use `--sequential` or `--workers 1` for rate-limited APIs.

### Auto-routing / forcing a specialist

```powershell
# Auto-detect from keywords (generic fallback: core)
python -m agents.main --dry-run -f "make the settings panel responsive with Tailwind"

# Force one specialist for every feature
python -m agents.main --agent backend -f "the desktop updater fails to relaunch"

# Explicit prefixes: design:, core:, backend: (or ui:, feature:, rust:)
python -m agents.main --dry-run -f "core: add a color wheel reset button"
```

### Output formats

```powershell
# Human-readable report (default)
python -m agents.main --dry-run -f "core: ..."

# Machine-readable JSON
python -m agents.main --dry-run --json -f "core: ..."

# Save plan.json + report.md
python -m agents.main --dry-run --out agents/out -f "core: ..."
```

### Features from a file

`features.json`:

```json
[
  "design: refine the dark-mode palette on the settings page",
  "core: add clip drag-and-drop between tracks",
  "backend: fix the async IPC state bug in the Tauri updater"
]
```

```powershell
python -m agents.main --features-file features.json
```

### Positional prompt

```powershell
python -m agents.main "add a color wheel reset button to the core editor"
```

### Full LLM mode

Remove `--dry-run` and ensure `DEEPSEEK_API_KEY` is set:

```powershell
python -m agents.main --verbose -f "design: ..." -f "backend: ..."
```

The specialists read the repo through the tools, produce a `DevPlan` per
feature, and include a `deepseek_prompt` you can paste into DeepSeek for the
actual implementation.

## Output schema

```json
{
  "generated_at": "2026-11-02T...",
  "repo_root": "C:\\...\\clippin workspace",
  "model": "deepseek/deepseek-chat",
  "mode": "crew",
  "results": [
    {
      "feature": "add clip drag-and-drop between tracks",
      "specialist": "Feature_Specialist_Core",
      "plan": {
        "feature": "...",
        "specialist": "Feature_Specialist_Core",
        "summary": "...",
        "implementation_steps": ["..."],
        "files": [{ "path": "src/components/editor/desktop-editor.tsx", "change": "..." }],
        "risks": ["..."],
        "test_plan": ["..."],
        "deepseek_prompt": "..."
      },
      "error": null
    }
  ]
}
```

`--dry-run` sets `"mode": "dry-run"` and `"model": "dry-run"`; the plan contains
the deterministic specialist steps and a full DeepSeek prompt instead of
LLM-generated file analysis.

## Repo tools

The agents can call:

- `list_repo_files(directory, pattern, limit)` - walk the repo, excluding
  `node_modules`, `.next`, `out`, `target`, `.venv`, etc.
- `read_repo_file(path, max_chars, start_char)` - read a text file, page through
  long files with `start_char`, capped at 40k chars per page.
- `search_repo(query, file_pattern, limit)` - case-insensitive literal/regex
  search returning `path:line: text`.

All are read-only and sandboxed to `AGENTS_REPO_ROOT` (default: this repo).
`.env` and `src-tauri/keys/**` are blocked, and leading `/`, `./`, or `@` path
prefixes are normalized.

## Verification

```powershell
python -m agents.main --help

# Offline end-to-end: three features, three specialists
python -m agents.main --dry-run `
  -f "design: polish the toolbar and dark-mode palette" `
  -f "core: add clip drag-and-drop" `
  -f "backend: fix IPC state bug"

# Import check
python -c "import crewai, crewai_tools, agents.main, agents.crew; print('ok')"

# Syntax check without walking .venv
python -m compileall -q -x "\.venv" agents
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `DEEPSEEK_API_KEY is not set` | Add it to `agents/.env`, or use `--dry-run`. |
| CrewAI install fails on Python 3.14 | Use Python 3.12/3.13 (`py install 3.13`). |
| `No module named agents` | Run from the repository root. |
| Rate limit / too many parallel calls | `--sequential` or `--workers 1`. |
| Wrong specialist picked | Use a `design:` / `core:` / `backend:` prefix or `--agent design/core/backend`. |
| Unicode print error on Windows | The CLI forces UTF-8; update to Windows Terminal if glyphs look wrong. |

## Archived HTTP bridge

The previous `service.py` (FastAPI `/health`, `/run`) is now
`agents/archive/service.py` and is **not used**. `agents/archive/tools.py`
keeps the old scaffold/snapshot tools for reference. No server is started by
the CLI.

## Requirements

- Python **3.10-3.13** (CrewAI 1.15.33 excludes 3.14+)
- An LLM API key for full crew mode (DeepSeek by default)
- No HTTP server, no FastAPI/uvicorn
