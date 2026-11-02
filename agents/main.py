"""CLI for the Forgevyn offline multi-agent dev team.

Examples:
    python -m agents.main --dry-run -f "timeline: add clip drag-and-drop"
    python -m agents.main -f "color: add LUT import" -f "rust: fix IPC deadlock"
    python -m agents.main --sequential -f "..."
    python -m agents.main --dry-run --out agents/out -f "..."
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from pathlib import Path
from typing import cast

from .models import DevPlan, FeatureRequest, PlanBundle, SpecialistId
from .specialists import parse_feature_spec


def _configure_stdio() -> None:
    """Avoid UnicodeEncodeError on Windows when prompts contain emoji/glyphs."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        with contextlib.suppress(Exception):
            reconfigure(encoding="utf-8", errors="replace")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m agents.main",
        description=(
            "Plan multiple Forgevyn features with four developer specialists "
            "(Design, Core, Backend, Tester)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            '  python -m agents.main --dry-run -f "design: refine the dark-mode palette"\n'
            '  python -m agents.main -f "core: add clip drag-and-drop" -f "backend: fix Tauri IPC deadlock"\n'
            '  python -m agents.main --agent design -f "..."\n'
            '  python -m agents.main --dry-run --out agents/out -f "..."\n'
        ),
    )
    parser.add_argument(
        "prompt",
        nargs="*",
        help="Optional feature prompt (words are joined into one feature).",
    )
    parser.add_argument(
        "-f",
        "--feature",
        action="append",
        default=[],
        metavar="TEXT",
        help=(
            "Feature request; repeat for multiple features. Prefix with "
            "design:, core:, backend:, or tester: to force a specialist."
        ),
    )
    parser.add_argument(
        "--features-file",
        type=Path,
        default=None,
        help="JSON array of feature strings.",
    )
    parser.add_argument(
        "--agent",
        choices=("auto", "design", "core", "backend", "tester"),
        default="auto",
        help="Force one specialist for every feature (default: auto-route).",
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run features one at a time (default: parallel).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Parallel workers (default: AGENTS_MAX_WORKERS or 3; max 8).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Skip LLM calls and emit deterministic plans plus DeepSeek "
            "implementation prompts. No API key required."
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full PlanBundle as JSON.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write plan.json and report.md into this directory.",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=None,
        help="Repository root (default: AGENTS_REPO_ROOT or the Forgevyn repo).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose CrewAI execution logging.",
    )
    return parser


def _load_features_file(path: Path) -> list[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read {path}: {exc}") from exc

    if not isinstance(data, list):
        raise TypeError("--features-file must contain a JSON array of strings.")

    features: list[str] = []
    for index, item in enumerate(data):
        if not isinstance(item, str):
            raise TypeError(
                f"--features-file item {index} is not a string; use prefixes "
                "such as 'rust: ...' for specialist routing."
            )
        features.append(item)
    return features


def _collect_features(args: argparse.Namespace) -> list[str]:
    raw: list[str] = list(args.feature)
    if args.prompt:
        raw.append(" ".join(args.prompt))
    if args.features_file:
        raw.extend(_load_features_file(args.features_file))
    return [item.strip() for item in raw if item.strip()]


def _format_plan_block(plan: DevPlan, index: int, total: int) -> list[str]:
    lines = [
        "=" * 78,
        f"[{index}/{total}] {plan.specialist or 'Specialist'}",
        f"Feature: {plan.feature}",
        "",
    ]

    if plan.summary:
        lines.extend(["Summary:", f"  {plan.summary}", ""])

    if plan.implementation_steps:
        lines.append("Plan:")
        for step_index, step in enumerate(plan.implementation_steps, 1):
            lines.append(f"  {step_index}. {step}")
        lines.append("")

    if plan.files:
        lines.append("Files / changes:")
        for file in plan.files:
            lines.append(f"  - {file.path or '<path missing>'}")
            if file.change:
                lines.append(f"    {file.change}")
        lines.append("")

    if plan.risks:
        lines.append("Risks:")
        for risk in plan.risks:
            lines.append(f"  - {risk}")
        lines.append("")

    if plan.test_plan:
        lines.append("Test plan:")
        for test in plan.test_plan:
            lines.append(f"  - {test}")
        lines.append("")

    if plan.deepseek_prompt:
        lines.append("DeepSeek implementation prompt:")
        lines.append("-" * 78)
        lines.append(plan.deepseek_prompt)
        lines.append("-" * 78)
        lines.append("")

    return lines


def format_text(bundle: PlanBundle) -> str:
    total = len(bundle.results)
    lines = [
        f"Forgevyn Dev Crew | {total} feature(s) | {bundle.mode} | {bundle.model}",
        f"Repo: {bundle.repo_root}",
        f"Generated: {bundle.generated_at}",
        "",
    ]

    for index, result in enumerate(bundle.results, 1):
        if result.error or result.plan is None:
            lines.extend(
                [
                    "=" * 78,
                    f"[{index}/{total}] {result.specialist}",
                    f"Feature: {result.feature}",
                    f"ERROR: {result.error or 'No plan returned.'}",
                    "",
                ]
            )
            continue
        lines.extend(_format_plan_block(result.plan, index, total))

    failures = sum(1 for result in bundle.results if result.error)
    planned = total - failures
    lines.append(f"Done: {planned}/{total} feature(s) planned.")
    return "\n".join(lines)


def format_markdown(bundle: PlanBundle) -> str:
    total = len(bundle.results)
    lines = [
        "# Forgevyn Dev Crew Plan",
        "",
        f"- Generated: {bundle.generated_at}",
        f"- Repo: `{bundle.repo_root}`",
        f"- Mode: `{bundle.mode}`",
        f"- Model: `{bundle.model}`",
        f"- Features: {total}",
        "",
    ]

    for index, result in enumerate(bundle.results, 1):
        lines.append(f"## {index}. {result.specialist}: {result.feature}")
        lines.append("")

        if result.error or result.plan is None:
            lines.append(f"**ERROR:** {result.error or 'No plan returned.'}")
            lines.append("")
            continue

        plan = result.plan
        if plan.summary:
            lines.extend(["### Summary", "", plan.summary, ""])

        if plan.implementation_steps:
            lines.extend(["### Implementation plan", ""])
            lines.extend(
                f"{step_index}. {step}"
                for step_index, step in enumerate(plan.implementation_steps, 1)
            )
            lines.append("")

        if plan.files:
            lines.extend(["### Files / changes", ""])
            for file in plan.files:
                lines.append(f"- `{file.path}`")
                if file.change:
                    lines.append(f"  - {file.change}")
            lines.append("")

        if plan.risks:
            lines.extend(["### Risks", ""])
            lines.extend(f"- {risk}" for risk in plan.risks)
            lines.append("")

        if plan.test_plan:
            lines.extend(["### Test plan", ""])
            lines.extend(f"- {test}" for test in plan.test_plan)
            lines.append("")

        if plan.deepseek_prompt:
            lines.extend(
                [
                    "### DeepSeek implementation prompt",
                    "",
                    "```text",
                    plan.deepseek_prompt,
                    "```",
                    "",
                ]
            )

    failures = sum(1 for result in bundle.results if result.error)
    lines.extend(
        [
            "---",
            "",
            f"{total - failures}/{total} feature(s) planned.",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    _configure_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.workers is not None and not 1 <= args.workers <= 8:
        parser.error("--workers must be between 1 and 8.")

    try:
        raw_features = _collect_features(args)
    except (TypeError, ValueError) as exc:
        parser.error(str(exc))

    if not raw_features:
        parser.error("Provide at least one feature (positional prompt or --feature).")
    # Imported after parsing so --help works without the crew dependencies.
    from .config import ConfigurationError, get_settings, python_supported
    from .crew import run_features

    try:
        settings = get_settings()
    except ConfigurationError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2

    if not python_supported():
        print(
            "Warning: CrewAI 1.15.33 requires Python 3.10-3.13; this interpreter "
            "may fail to run the crew.",
            file=sys.stderr,
        )

    forced_specialist: SpecialistId | None = (
        None
        if args.agent == "auto"
        else cast(SpecialistId, args.agent)
    )

    try:
        requests: list[FeatureRequest] = []
        for raw in raw_features:
            text, specialist = parse_feature_spec(
                raw, forced=forced_specialist
            )
            requests.append(
                FeatureRequest(feature=text, specialist=specialist)
            )
    except ValueError as exc:
        print(f"Invalid feature: {exc}", file=sys.stderr)
        return 2

    repo_root = (args.repo or settings.repo_root).expanduser().resolve()
    if not repo_root.is_dir():
        print(f"Repository not found: {repo_root}", file=sys.stderr)
        return 2

    if not args.dry_run:
        try:
            settings.require_api_key()
        except ConfigurationError as exc:
            print(f"{exc}", file=sys.stderr)
            print("Tip: use --dry-run to generate prompts without an API key.", file=sys.stderr)
            return 2

    workers = args.workers if args.workers is not None else settings.max_workers

    try:
        bundle = run_features(
            requests,
            repo_root=repo_root,
            plan_only=args.dry_run,
            sequential=args.sequential,
            workers=workers,
            verbose=args.verbose or settings.verbose,
        )
    except ConfigurationError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001 - top-level CLI error boundary
        print(f"Dev crew failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(bundle.model_dump_json(indent=2))
    else:
        print(format_text(bundle))

    if args.out:
        out_dir = args.out.expanduser().resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        plan_path = out_dir / "plan.json"
        report_path = out_dir / "report.md"
        plan_path.write_text(bundle.model_dump_json(indent=2), encoding="utf-8")
        report_path.write_text(format_markdown(bundle), encoding="utf-8")
        print(
            f"Wrote {plan_path} and {report_path}",
            file=sys.stderr if args.json else sys.stdout,
        )

    failures = sum(1 for result in bundle.results if result.error)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
