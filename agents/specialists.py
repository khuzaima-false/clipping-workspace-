"""Developer specialist definitions and feature routing for the CLI."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .models import SpecialistId


@dataclass(frozen=True)
class Specialist:
    id: SpecialistId
    label: str
    role: str
    goal: str
    backstory: str
    focus: str
    keywords: tuple[tuple[str, int], ...]
    starter_steps: tuple[str, ...]
    starter_risks: tuple[str, ...]
    starter_tests: tuple[str, ...]
    reference_files: tuple[str, ...]


DESIGN = Specialist(
    id="design",
    label="UI_UX_Design_Specialist",
    role="UI_UX_Design_Specialist",
    goal=(
        "Own the visual system: layout, Tailwind styling, responsive behavior, "
        "dark-mode palettes, and UX polish without changing feature logic."
    ),
    backstory=(
        "You are Forgevyn's product designer and front-end stylist. You know the "
        "Tailwind v4 token system, the dark zinc/violet UI, the 4-panel desktop "
        "editor, the CapCut-style mobile editor, and the marketing site. You "
        "produce exact component-level styling changes that preserve behavior."
    ),
    focus=(
        "Visual layout, Tailwind CSS design systems, component styling, UX "
        "polish, dark-mode palettes, typography, spacing, responsive layouts, "
        "and accessibility."
    ),
    keywords=(
        ("design", 3),
        ("redesign", 3),
        ("restyle", 3),
        ("ui", 3),
        ("ux", 3),
        ("tailwind", 3),
        ("styling", 3),
        ("dark mode", 3),
        ("palette", 3),
        ("color palette", 3),
        ("design system", 3),
        ("component styling", 3),
        ("look and feel", 3),
        ("layout", 2),
        ("css", 2),
        ("style", 2),
        ("theme", 2),
        ("responsive", 2),
        ("breakpoint", 2),
        ("typography", 2),
        ("spacing", 2),
        ("visual", 2),
        ("polish", 2),
        ("aesthetic", 2),
        ("branding", 2),
        ("font", 1),
        ("gradient", 1),
        ("glass", 1),
        ("shadow", 1),
        ("hover", 1),
        ("focus state", 1),
        ("dark", 2),
        ("light mode", 2),
        ("accessibility", 2),
        ("visual hierarchy", 2),
        ("alignment", 1),
        ("grid", 1),
        ("flex", 1),
        ("contrast", 1),
        ("icon", 1),
        ("animation", 1),
        ("transition", 1),
        ("panel", 1),
        ("modal", 1),
        ("card", 1),
    ),
    starter_steps=(
        "Audit `src/app/globals.css` and the affected components for the existing Tailwind tokens and classes.",
        "Map the visual change at mobile (<=767px) and desktop (>=768px) breakpoints; preserve the `md:hidden` / `hidden md:flex` split.",
        "Use existing zinc/violet/glass tokens for dark-mode, spacing, and typography; avoid ad-hoc color values.",
        "Keep state, event handlers, and Tauri/Next logic untouched; this is presentation and UX only.",
        "Check contrast, focus/hover states, overflow, and visual regressions before finishing.",
    ),
    starter_risks=(
        "Breaking the mobile/desktop layout split or hiding controls at a breakpoint.",
        "Low contrast or inaccessible focus states in the dark palette.",
        "Inconsistent spacing/typography tokens causing a patchwork UI.",
        "Layout shift or horizontal overflow on small screens.",
        "Over-styling that hides content or changes interaction behavior.",
    ),
    starter_tests=(
        "`npx tsc --noEmit`, `npm run lint`, `npm run build`.",
        "Screenshot the affected screens at 360px, 768px, and 1280px.",
        "Check dark mode, keyboard focus, hover states, and horizontal overflow.",
        "Confirm the mobile editor is unchanged behind `md:hidden`.",
    ),
    reference_files=(
        "src/app/globals.css",
        "src/app/page.tsx",
        "src/components/shell/header.tsx",
        "src/components/shell/sidebar.tsx",
        "src/components/marketing/hero-preview.tsx",
        "src/components/marketing/auth-actions.tsx",
        "src/components/editor/desktop-editor.tsx",
        "src/components/editor/studio-modules.tsx",
        "src/components/ui/modal.tsx",
        "src/components/ui/logo.tsx",
        "src/components/ui/skeleton.tsx",
    ),
)

CORE = Specialist(
    id="core",
    label="Feature_Specialist_Core",
    role="Feature_Specialist_Core",
    goal=(
        "Own client-side feature logic: React/Next.js state, timeline canvas "
        "architecture, interactions, and editor workflows without breaking "
        "persistence, undo, or preview/export parity."
    ),
    backstory=(
        "You are a senior React/Next.js engineer on Forgevyn. You know the "
        "Zustand editor store, timeline drag/trim/ripple math, Web Audio/Canvas "
        "interactions, IndexedDB autosave, color/LUT preview behavior, and the "
        "desktop/mobile editor split. You produce surgical state and component "
        "changes with tests."
    ),
    focus=(
        "React/Next.js state logic, Zustand store, timeline canvas architecture, "
        "clip interactions and workflows, client-side features (including "
        "color/LUT/render behavior), and local persistence."
    ),
    keywords=(
        ("core", 3),
        ("feature", 2),
        ("react", 2),
        ("next", 2),
        ("state", 3),
        ("zustand", 3),
        ("store", 2),
        ("hook", 2),
        ("interaction", 2),
        ("workflow", 2),
        ("timeline", 3),
        ("canvas", 2),
        ("playhead", 2),
        ("clip", 2),
        ("track", 2),
        ("drag", 2),
        ("drop", 2),
        ("trim", 2),
        ("split", 2),
        ("razor", 2),
        ("ripple", 2),
        ("waveform", 2),
        ("keyframe", 1),
        ("overlay", 1),
        ("caption", 1),
        ("inspector", 1),
        ("editor", 1),
        ("client-side", 2),
        ("browser", 1),
        ("indexeddb", 2),
        ("localstorage", 2),
        ("undo", 2),
        ("redo", 2),
        ("selection", 1),
        ("keyboard", 2),
        ("shortcut", 2),
        ("mobile", 1),
        ("desktop", 1),
        ("color", 1),
        ("colour", 1),
        ("grading", 1),
        ("grade", 1),
        ("lut", 1),
        ("webgl", 1),
        ("shader", 1),
        ("glsl", 1),
        ("wheel", 1),
        ("saturation", 1),
        ("exposure", 1),
        ("chroma", 1),
        ("rgb", 1),
        ("hsl", 1),
        ("hsv", 1),
        ("render", 1),
        ("filter", 1),
        ("effects", 1),
        ("playback", 1),
        ("audio", 1),
    ),
    starter_steps=(
        "Trace the feature through the Zustand store and the desktop/mobile components before proposing state changes.",
        "Preserve the 500-step undo/redo history, IndexedDB autosave schema, clip start/trim/ripple math, and preview/export parity.",
        "Implement the smallest coherent state/component change; keep mobile and desktop behavior separated.",
        "Check keyboard, pointer, and touch interactions, effect cleanup, and playhead synchronization.",
        "Verify with tsc/lint/build plus interaction, undo, and project-reload tests.",
    ),
    starter_risks=(
        "Breaking undo/redo or the IndexedDB autosave schema.",
        "Playhead drift after zooming or scrolling the timeline.",
        "Pointer capture / touch-event conflicts between drag and trim handles.",
        "State desynchronization after clip switches or project reloads.",
        "Preview and export diverging when the render path changes.",
        "Mobile and desktop editors diverging behind the breakpoint split.",
    ),
    starter_tests=(
        "`npx tsc --noEmit`, `npm run lint`, `npm run build`.",
        "Drag, trim, split (S), and ripple delete a clip; undo and redo each step.",
        "Reload the project and confirm clips, captions, and autosave survive.",
        "Exercise the mobile touch path at a sub-768px viewport.",
        "Compare a preview frame and an exported frame for the same grade/effect.",
    ),
    reference_files=(
        "src/store/editor.ts",
        "src/components/editor/desktop-editor.tsx",
        "src/components/editor/mobile-editor.tsx",
        "src/components/editor/waveform.tsx",
        "src/lib/timeline-drag.ts",
        "src/lib/tracks.ts",
        "src/lib/waveform-peaks.ts",
        "src/lib/video-storage.ts",
        "src/lib/render.ts",
        "src/lib/captions.ts",
        "src/lib/stickers.ts",
        "src/app/(workspace)/editor/page.tsx",
    ),
)

BACKEND = Specialist(
    id="backend",
    label="Feature_Specialist_Backend",
    role="Feature_Specialist_Backend",
    goal=(
        "Own the Tauri v2/Rust and system layer: IPC handlers, async state, "
        "export pipelines, performance, and deep system tasks with minimal, "
        "well-permissioned changes."
    ),
    backstory=(
        "You are a systems engineer for the Forgevyn Tauri 2 desktop shell. "
        "You debug command handlers, capabilities, async locks, window "
        "lifecycle, updater/process plugins, WebCodecs/ffmpeg export pipelines, "
        "and cross-platform performance bottlenecks."
    ),
    focus=(
        "Tauri v2 Rust IPC handlers, capabilities/plugins, async state, export "
        "pipelines (WebCodecs/ffmpeg/muxer), performance optimization, and deep "
        "system tasks."
    ),
    keywords=(
        ("backend", 3),
        ("rust", 3),
        ("tauri", 3),
        ("ipc", 3),
        ("cargo", 3),
        ("tokio", 3),
        ("crash", 3),
        ("panic", 3),
        ("leak", 3),
        ("bottleneck", 3),
        ("updater", 3),
        ("capability", 3),
        ("invoke", 3),
        ("exporter", 3),
        ("webcodecs", 3),
        ("ffmpeg", 3),
        ("mutex", 2),
        ("memory", 2),
        ("performance", 2),
        ("profiling", 2),
        ("export", 2),
        ("muxer", 2),
        ("encoder", 2),
        ("filesystem", 2),
        ("plugin", 2),
        ("serde", 2),
        ("command", 2),
        ("handler", 2),
        ("relaunch", 2),
        ("async state", 3),
        ("state management", 2),
        ("deadlock", 3),
        ("lock", 2),
        ("pipeline", 1),
        ("bug", 1),
        ("fix", 1),
        ("error", 1),
        ("crate", 1),
        ("async", 1),
        ("await", 1),
        ("thread", 1),
        ("window", 1),
        ("json", 1),
        ("process", 1),
        ("signing", 1),
        ("release", 1),
        ("wasm", 1),
    ),
    starter_steps=(
        "Reproduce and trace the system path: TS invoke → capability → Rust command/plugin, or the export pipeline.",
        "Check async state, lock ordering/poisoning, IPC payload sizes, window lifecycle, and error propagation.",
        "Keep IPC handlers async where they can block; avoid holding locks across awaits and add only the minimum capabilities.",
        "For export/performance work: profile the pipeline, measure encode/mux cost, and preserve output parity.",
        "Run `cargo check` / `cargo clippy`, rebuild the Tauri app, and exercise the affected export/perf path.",
    ),
    starter_risks=(
        "Deadlocks or lock poisoning in shared Tauri state.",
        "Blocking the webview/main thread with synchronous IPC work.",
        "Missing capability permissions causing deploy-only failures.",
        "Breaking the signed updater/process plugin setup or the release pipeline.",
        "Export pipeline regressions across resolutions/formats or platforms.",
        "Platform-specific path/permission behavior on macOS or Linux.",
    ),
    starter_tests=(
        "`cargo check` and `cargo clippy` in `src-tauri/`.",
        "`npm run tauri:build` or the GitHub release workflow.",
        "Reproduce the original bug on Windows and confirm it is gone.",
        "Exercise the affected IPC/export path with large payloads or long renders.",
        "Profile frame encode/mux time and check UI responsiveness.",
    ),
    reference_files=(
        "src-tauri/src/lib.rs",
        "src-tauri/src/main.rs",
        "src-tauri/tauri.conf.json",
        "src-tauri/Cargo.toml",
        "src-tauri/capabilities/default.json",
        "src/lib/tauri.ts",
        "src/lib/exporter.ts",
        "src/lib/recorder.ts",
        "src/lib/media-storage.ts",
        "src/lib/audio.ts",
    ),
)


SPECIALISTS: dict[str, Specialist] = {
    specialist.id: specialist for specialist in (DESIGN, CORE, BACKEND)
}

# Core is the default for generic feature work. Ties favor core, then design,
# then backend; explicit prefixes/--agent always override.
ORDER: tuple[SpecialistId, ...] = ("core", "design", "backend")
DEFAULT_SPECIALIST: SpecialistId = "core"

ALIASES: dict[str, SpecialistId] = {
    # New primary prefixes
    "design": "design",
    "ui": "design",
    "ux": "design",
    "feature": "core",
    "core": "core",
    "backend": "backend",
    "rust": "backend",
    # Backward-compatible aliases from the previous division
    "frontend": "core",
    "timeline": "core",
    "color": "core",
    "colour": "core",
    "grading": "core",
    "grade": "core",
    "bug": "backend",
    "tauri": "backend",
}

PREFIX_RE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$")


def route_feature(text: str) -> SpecialistId:
    """Pick the specialist with the strongest keyword score (default: core)."""
    lowered = text.lower()
    scores: dict[SpecialistId, int] = {}
    for specialist in SPECIALISTS.values():
        score = 0
        for keyword, weight in specialist.keywords:
            pattern = rf"\b{re.escape(keyword)}\b"
            score += len(re.findall(pattern, lowered)) * weight
        scores[specialist.id] = score

    best = max(
        ORDER,
        key=lambda specialist_id: (
            scores[specialist_id],
            -ORDER.index(specialist_id),
        ),
    )
    return best if scores[best] > 0 else DEFAULT_SPECIALIST


def parse_feature_spec(
    raw: str,
    forced: SpecialistId | None = None,
) -> tuple[str, SpecialistId]:
    """Parse ``design: …`` / ``core: …`` / ``backend: …`` prefixes.

    ``forced`` (the CLI ``--agent`` flag) wins over a prefix.
    """
    text = raw.strip()
    if not text:
        raise ValueError("Feature prompt cannot be empty.")

    prefix_specialist: SpecialistId | None = None
    match = PREFIX_RE.match(text)
    if match:
        key = match.group(1).strip().lower()
        if key in ALIASES:
            prefix_specialist = ALIASES[key]
            text = match.group(2).strip()

    if not text:
        raise ValueError("Feature prompt cannot be empty after the specialist prefix.")

    return text, forced or prefix_specialist or route_feature(text)


def get_specialist(specialist_id: SpecialistId) -> Specialist:
    try:
        return SPECIALISTS[specialist_id]
    except KeyError as exc:
        raise ValueError(f"Unknown specialist: {specialist_id}") from exc
