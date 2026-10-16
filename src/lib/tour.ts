/**
 * Guided-tour content for the Forgevyn studio.
 *
 * Every step targets an element by its `data-tour` key. Steps whose target is
 * missing (e.g. the desktop workspace on a phone) are skipped automatically by
 * the runner, so the same definitions work on every screen size.
 */

export type TourStep = {
  /** `data-tour` value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** `data-tour` value of a control to click before highlighting (e.g. a tab). */
  open?: string;
  /** Preferred tooltip side; the runner flips it when there isn't room. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Advance to the next step when the user clicks the highlighted element. */
  advanceOnClick?: boolean;
};

export type TourCategoryId = "left" | "right" | "timeline" | "monitor";

export type TourCategory = {
  id: TourCategoryId;
  emoji: string;
  title: string;
  blurb: string;
  accent: string;
  steps: TourStep[];
};

/* ------------------------------------------------------------------ */
/* 1. Left panel — the tool / project bin                              */
/* ------------------------------------------------------------------ */

const LEFT_STEPS: TourStep[] = [
  {
    target: "left-panel",
    title: "🖥️ The tool panel",
    body: "Every editing tool lives here. The tabs across the top switch between Media, Effects, Props, Clip, Speed, Captions, Audio, Stickers, Record and Studio — the panel below always follows the active tab.",
    placement: "right",
  },
  {
    target: "tab-strip",
    title: "Ten workspaces, one click away",
    body: "This strip is horizontally scrollable. Drag or swipe it to reach Studio / Record on a narrow window. Clicking a tab switches the whole panel.",
    placement: "bottom",
  },
  {
    target: "left-panel-body",
    open: "tab-media",
    title: "Media — import & manage clips",
    body: "Import MP4/WebM files (multi-select supported) from the pinned action bar, then scroll the media bin below it independently — the list keeps its own scrollbar so long sequences never push the panel or the reserved ad space out of place. Each row shows its trimmed length, a checkbox for batch export, and a trash icon to remove it.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-effects",
    title: "Effects — 35 looks & moves",
    body: "Effects are grouped (Camera, Motion, Light, Distortion, Retro, Glitch…). Click any effect to drop it on the V3 track at the playhead. Applied effects appear below with an Intensity slider and a delete button.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-properties",
    title: "Props — overlay text, keyframes, motion & AI",
    body: "Select a text or image overlay to edit its text, font, fill/background colour, alignment, size, position, rotation and opacity. Add keyframes at the playhead to animate scale/position/opacity (the renderer interpolates between them), pick an in/out Motion preset (Typewriter, Drop-in, Bounce, Fade Spin, Slide Up), run AI background removal, and tune the global caption animation (pop, bounce, karaoke, typewriter, neon) with word-highlight and outline toggles.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-clip",
    title: "Clip — cutout, trim & framing",
    body: "Chroma Key/Cutout with an eyedropper and tolerance slider, precise Trim In/Out, Framing (Fit vs Fill & Crop with X/Y position), one-click platform framing presets (TikTok, Reels, YouTube…), and the black vs blurred letterbox fill.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-speed",
    title: "Speed — velocity ramping",
    body: "Pick a speed preset (Jump Cut, Slow Motion, Bullet Time…) or draw a custom velocity curve. Click the graph to add keyframes, drag them to shape the ramp, and read the 0.25×–5× axis gridlines.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-captions",
    title: "Captions — AI captions, styles & the transcript",
    body: "Choose the spoken language and auto-generate AI captions on-device (with a live progress bar), or type/dictate a script and generate timed captions from it. 23 caption styles are one click away. Once AI captions exist you get an editable Transcript: click words to select them and hit “Delete & ripple” to cut that exact range out of the clip while every caption stays in sync.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-audio",
    title: "Audio — 36 SFX & the mixer",
    body: "36 royalty-free sound effects, synthesized on-device, grouped by category — click to drop one at the playhead. Import your own audio and mix it: per-track mute, solo, volume and fade in/out.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-stickers",
    title: "Stickers — 46 overlays",
    body: "Browse sticker categories and click any sticker to drop it on the V2 overlay track at the playhead. Emoji stickers become text overlays; SVG stickers become image overlays you can resize on the canvas.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-record",
    title: "Record — screen, camera & narration",
    body: "Capture your screen, a window or your webcam directly in the browser. Keep “Capture microphone (narration)” ticked and watch the input-level meter to be sure audio is live. The result is a single combined WebM with its audio baked in, so it drops onto V1 as one clip that plays and exports with sound. Badges show whether the microphone and tab audio were captured, and a warning appears if the mic was blocked.",
    placement: "right",
  },
  {
    target: "left-panel-body",
    open: "tab-studio",
    title: "Studio — sports & gaming generators",
    body: "14 ready-made template generators (Cricket Jersey, Match Day Poster, Esports Clan Logo, Tournament Bracket, Live Scoreboard, Stream Starting Soon, Highlight Reel, Sponsor Board…). Type your details, tweak the font/colours/curvature, then send the artwork to the V2 overlay track.",
    placement: "right",
  },
  {
    target: "tab-studio",
    title: "Studio tab located ✅",
    body: "That's the whole left panel. Hit Next for the colour-grading panel on the right, or Exit whenever you like.",
    placement: "bottom",
  },
];

/* ------------------------------------------------------------------ */
/* 2. Right panel — colour & scopes                                    */
/* ------------------------------------------------------------------ */

const RIGHT_STEPS: TourStep[] = [
  {
    target: "lumetri-panel",
    title: "🎨 Lumetri color & scopes",
    body: "The complete grading suite, split into three compact sub-tabs — Wheels, Corrections and Presets — so nothing is buried in a wall of sliders. Every change applies in real time to the Program Monitor and is burned into your export.",
    placement: "left",
  },
  {
    target: "lumetri-tabs",
    title: "Three sub-tabs",
    body: "Wheels for three-way tonal colour, Corrections for the 13 primary sliders, and Presets for the 20-look gallery plus the live luma scope. Switching tabs animates smoothly and the panel stays compact.",
    placement: "left",
  },
  {
    target: "color-wheels",
    open: "lumetri-tab-wheels",
    title: "Tab 1 · Colour wheels",
    body: "Three-way colour wheels for tonal ranges: Lift shapes the shadows, Gamma the midtones and Gain the highlights. Drag inside a wheel to tint that range, and use Reset to clear the whole grade.",
    placement: "left",
  },
  {
    target: "color-sliders",
    open: "lumetri-tab-corrections",
    title: "Tab 2 · Corrections & sliders",
    body: "Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks, Vibrance, Saturation, Temperature, Tint, Sharpness and Clarity — each with a slider and a precise numeric field, plus a Reset Color Adjustments button.",
    placement: "left",
  },
  {
    target: "cinematic-presets",
    open: "lumetri-tab-presets",
    title: "Tab 3 · Cinematic presets",
    body: "Five quick looks (Teal & Orange, Moody Noir, Cyberpunk, Golden Hour…) plus 15 more behind “More (+15)”. Pick one, then dial the Intensity slider to blend it in.",
    placement: "left",
  },
  {
    target: "luma-scope",
    open: "lumetri-tab-presets",
    title: "Tab 3 · Live luma waveform",
    body: "A real-time 256-bin luminance histogram sampled from the Program Monitor, so you can see crushing blacks or clipping highlights as you grade. It lives beside the presets gallery.",
    placement: "left",
  },
];

/* ------------------------------------------------------------------ */
/* 3. Timeline                                                         */
/* ------------------------------------------------------------------ */

const TIMELINE_STEPS: TourStep[] = [
  {
    target: "timeline",
    title: "🎞️ The timeline workspace",
    body: "A full multi-track NLE: V3 effects, V2 overlays, V1 video, and three audio lanes (A1–A3). Clips are draggable, trimmable and snappable.",
    placement: "top",
  },
  {
    target: "timeline-toolbar",
    title: "Toolbar & timecode",
    body: "The running timecode on the left, the razor/ripple tools in the middle, and the zoom controls on the right.",
    placement: "bottom",
  },
  {
    target: "timeline-split",
    title: "✂️ Razor blade (Split)",
    body: "Cuts the selected clip at the exact playhead into two independent clips. Shortcut: S.",
    placement: "bottom",
    advanceOnClick: true,
  },
  {
    target: "timeline-ripple",
    title: "Ripple delete",
    body: "Deletes the selected clip and slides every later clip on the track left to close the gap. Shortcut: Shift+Delete.",
    placement: "bottom",
    advanceOnClick: true,
  },
  {
    target: "timeline-zoom",
    title: "Zoom & viewport",
    body: "The magnifier slider scales the timecode ruler. Zooming keeps the time under the middle of the view pinned, so your viewport never jumps.",
    placement: "bottom",
  },
  {
    target: "track-headers",
    title: "Track headers & locks",
    body: "Per lane: M mutes, S solos, the padlock locks the lane (blocking drag, trim, split and delete) and the eye hides it from the preview and the export. On A2 the eye is replaced by the microphone button for live voiceover recording.",
    placement: "right",
  },
  {
    target: "v3-lane",
    title: "V3 — effects lane",
    body: "Timed visual effects from the Effects tab. Drag a block to retime it, drag its edges to trim, right-click for delete.",
    placement: "right",
  },
  {
    target: "v2-lane",
    title: "V2 — overlay lane",
    body: "Text, stickers, images and Studio artwork. Drag to move, trim the edges to change when it appears, right-click to delete, and click to select it for the on-canvas handles.",
    placement: "right",
  },
  {
    target: "v1-lane",
    title: "V1 — video lane",
    body: "Your base footage in sequence order. Drag a clip to slide it in time — it magnetically snaps to the playhead, the In/Out marks and neighbouring clip edges. White handles on each side trim the in/out points, and the amber junction icon between touching clips adds a transition (cross dissolve, dip to black, whip pan, glitch cut, zoom).",
    placement: "right",
  },
  {
    target: "a1-lane",
    title: "A1–A3 — audio lanes",
    body: "Imported music and sound effects, drawn with real decoded waveforms. Drag to reposition, trim the edges, and use the lane M/S buttons to mute or solo the whole lane in preview and export.",
    placement: "right",
  },
  {
    target: "timeline-ruler",
    title: "Ruler, playhead & marks",
    body: "Click or drag anywhere on the ruler to scrub. The fuchsia playhead follows playback, and the blue brackets show the In/Out region that loops and exports.",
    placement: "bottom",
  },
];

/* ------------------------------------------------------------------ */
/* 4. Program monitor & header                                         */
/* ------------------------------------------------------------------ */

const MONITOR_STEPS: TourStep[] = [
  {
    target: "editor-title",
    title: "📺 Project title",
    body: "Click to rename the project inline. Enter saves, Escape cancels — the change is written to your library immediately.",
    placement: "bottom",
  },
  {
    target: "save-indicator",
    title: "Autosave checkpoints",
    body: "Your project is checkpointed to IndexedDB automatically — a debounced save after every edit, plus a 60-second heartbeat — and the playhead is restored if the tab ever crashes. This dot shows the live state: grey “Unsaved changes”, pulsing amber “Auto-saving…”, green “All changes saved”.",
    placement: "bottom",
  },
  {
    target: "storage-button",
    title: "Storage & cache",
    body: "Open the storage utility to see how much of your browser quota Forgevyn is using, with a breakdown of media blobs, project autosaves and source backups. From there you can clear unused cache, purge project blobs or delete old checkpoints — all failure-safe.",
    placement: "bottom",
    advanceOnClick: true,
  },
  {
    target: "export-resolution",
    title: "Resolution & bitrate presets",
    body: "Choose 720p, 1080p, 4K or 9:16. Each preset carries its own target dimensions and bitrate for the encoder.",
    placement: "bottom",
  },
  {
    target: "export-button",
    title: "Export",
    body: "Renders the marked region to an MP4 with WebCodecs. Progress is shown inside the button, and exports are unlimited.",
    placement: "bottom",
  },
  {
    target: "program-monitor",
    title: "Program monitor",
    body: "The live canvas — graded, keyed and composited exactly as it will export. The studio layout gives it every spare pixel between the two tool panels. Drag a selected overlay directly on the canvas to reposition it, or grab a corner handle to resize it.",
    placement: "left",
  },
  {
    target: "aspect-group",
    title: "Aspect ratio",
    body: "Switch between 9:16 (Reels/TikTok), 16:9 (YouTube), 1:1 (feed) and 21:9 (cinematic). The canvas and export both follow.",
    placement: "bottom",
  },
  {
    target: "monitor-meta",
    title: "Quality & blur fill",
    body: "Your output resolution and frame rate, the HD toggle for crisp high-quality scaling, and Blur Fill — a blurred, cover-scaled background behind letterboxed or mismatched media.",
    placement: "bottom",
  },
  {
    target: "transport",
    title: "Transport controls",
    body: "Scrub the timeline, step frame-by-frame with the arrow keys, undo/redo, play/pause (Space) and toggle Loop.",
    placement: "top",
  },
  {
    target: "marks",
    title: "Mark In / Mark Out",
    body: "Set an In and Out point (shortcuts I and O) to define the region that loops and exports. The bracket overlay on the ruler shows exactly what will be rendered.",
    placement: "top",
  },
  {
    target: "header-bar",
    title: "Studio header & exit",
    body: "In the studio the header is stripped back to the Forgevyn brand plus a prominent “Back to Projects” button — the dashboard / channels / sponsorships nav rail is hidden while you edit so nothing distracts from the canvas.",
    placement: "bottom",
  },
];

export const TOUR_CATEGORIES: TourCategory[] = [
  {
    id: "left",
    emoji: "🖥️",
    title: "Left Panel Guide",
    blurb: "Editing tools, effects, captions, audio library & speed curves.",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
    steps: LEFT_STEPS,
  },
  {
    id: "right",
    emoji: "🎨",
    title: "Right Panel Guide",
    blurb: "Colour wheels, 13 sliders, presets gallery & Luma scope.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/40",
    steps: RIGHT_STEPS,
  },
  {
    id: "timeline",
    emoji: "🎞️",
    title: "Timeline Workspace Guide",
    blurb: "Multi-track lanes, razor, ripple delete, locks & snapping.",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/40",
    steps: TIMELINE_STEPS,
  },
  {
    id: "monitor",
    emoji: "📺",
    title: "Program Monitor & Header Guide",
    blurb: "Aspect ratios, blur fill, Mark In/Out & HD export config.",
    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
    steps: MONITOR_STEPS,
  },
];

export function buildFullTour(): TourStep[] {
  return TOUR_CATEGORIES.flatMap((category) => category.steps);
}
