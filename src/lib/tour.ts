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
  /** `data-tour` value(s) of controls to click before highlighting (e.g. a tab chain). */
  open?: string | string[];
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
    target: "inspector-panel",
    title: "🎛️ The Inspector",
    body: "Every editing tool now lives in one place on the right: colour grading, media, effects, clip properties and text/captions. The left panel is a dedicated full-width Media Pool, so the workspace stays clean and symmetric.",
    placement: "left",
  },
  {
    target: "inspector-categories",
    title: "Five top-level categories",
    body: "Color, Media, Effects, Clip and Text. Pick a category and its nested sub-tabs appear directly underneath — no more hunting through one long row of tabs, and switching never touches your playhead or selected clip.",
    placement: "left",
  },
  {
    target: "studio-left-panel",
    title: "Full-width Media Pool",
    body: "The Media Pool owns the entire left panel now. Import clips and select them directly; effects, transforms and colour live in the Inspector on the right.",
    placement: "right",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-effects"],
    title: "Effects — searchable library",
    body: "Use the sticky search bar to find an effect by name, then click to drop it on the V3 track at the playhead. Effects are grouped (Transform & Camera, Color & Grade, Light & Atmosphere, Film & Retro) with industry-standard names like Zoom In, Punch In, Camera Shake and Orbit Drift. Applied effects appear below with an Intensity slider, and AI background removal sits at the bottom.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-text", "inspector-sub-text-captions"],
    title: "Text › Captions (text + styles)",
    body: "Select a text or image overlay to edit its text, font, alignment, colours (Text Color / Background Pill / Shadow & Stroke), size, position, rotation and opacity. The same tab holds the Motion presets (Typewriter, Drop-in, Bounce, Fade Spin, Slide Up) and the global Caption Style — animation, word highlight, outline and highlight colour. Use “Add Text / Caption Overlay” to drop a new overlay at the playhead.",
    placement: "left",
  },
  {
    target: "motion-presets",
    open: ["inspector-cat-text", "inspector-sub-text-captions"],
    title: "Motion presets",
    body: "Five pre-baked in/out animations for titles and overlays — Typewriter (word-by-word reveal), Drop-in (smooth glide from the top), Bounce (elastic scale with a soft overshoot), Fade Spin (fade + rotation) and Slide Up. All of them run on a cubic-bezier(0.16, 1, 0.3, 1) curve and play on top of your keyframes and caption animation.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-clip", "inspector-sub-clip-transform"],
    title: "Clip › Transform & Cutout",
    body: "Chroma Key/Cutout with an eyedropper and tolerance slider, precise Trim In/Out, Framing (Fit vs Fill & Crop with X/Y position), one-click platform framing presets (TikTok, Reels, YouTube…), and the black vs blurred letterbox fill.",
    placement: "left",
  },
  {
    target: "clip-keyframes",
    open: ["inspector-cat-clip", "inspector-sub-clip-keyframes"],
    title: "Clip › Keyframes",
    body: "Its own dedicated sub-tab. Animate the clip's Position X/Y, Scale/Zoom and Rotation — each with a ◆ Add-keyframe toggle at the playhead. With no keyframes the sliders edit the base pose; once a keyframe exists, edits auto-key and the renderer interpolates between them. The same tab also holds the selected text/overlay keyframes.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-clip", "inspector-sub-clip-speed"],
    title: "Clip › Speed — velocity ramping",
    body: "Pick a speed preset (Jump Cut, Slow Motion, Bullet Time…) or draw a custom velocity curve. Click the graph to add keyframes, drag them to shape the ramp, and read the 0.25×–5× axis gridlines.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-text", "inspector-sub-text-captions"],
    title: "Text › Captions — AI captions & styles",
    body: "Choose the spoken language and auto-generate AI captions on-device (with a live progress bar), or type/dictate a script and generate timed captions from it. 23 caption styles are one click away. Captions stay locked to the audio: short silences are bridged so subtitles never flicker off between phrases, and razor cuts re-index them so each half of a split clip keeps the right words.",
    placement: "left",
  },
  {
    target: "transcript",
    open: ["inspector-cat-text", "inspector-sub-text-captions"],
    title: "Transcript editing — cut video by deleting words",
    body: "Once AI captions exist, the transcript appears below the caption list. Click the words you want gone (they turn red and strike through), then hit “Delete & ripple”: the clip is cut at both ends of that range, the timeline closes the gap, and every caption re-times itself so text and audio stay perfectly in sync. It works exactly like editing a text document.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-media", "inspector-sub-media-audio"],
    title: "Media › Sound Effects",
    body: "Royalty-free UI and cinematic sound effects, synthesized on-device, grouped by category — click to drop one at the playhead. Import your own audio and mix it: per-track mute, solo, volume and fade in/out.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-text", "inspector-sub-text-stickers"],
    title: "Text › Stickers — 140+ overlays",
    body: "Emoji, Badges, Arrows, Buttons and Lower Thirds — over 140 ready-made stickers. Click any sticker to drop it on the V2 overlay track at the playhead; emoji become text overlays, SVG stickers become image overlays you can resize on the canvas.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-media", "inspector-sub-media-record"],
    title: "Media › Record — screen, camera & narration",
    body: "Capture your screen, a window or your webcam directly in the browser. Keep “Capture microphone (narration)” ticked and watch the input-level meter to be sure audio is live. The result is a single combined WebM with its audio baked in, so it drops onto V1 as one clip that plays and exports with sound. Badges show whether the microphone and tab audio were captured, and a warning appears if the mic was blocked.",
    placement: "left",
  },
  {
    target: "inspector-body",
    open: ["inspector-cat-media", "inspector-sub-media-studio"],
    title: "Media › Studio — sports & gaming generators",
    body: "14 ready-made template generators (Cricket Jersey, Match Day Poster, Esports Clan Logo, Tournament Bracket, Live Scoreboard, Stream Starting Soon, Highlight Reel, Sponsor Board…). Type your details, tweak the font/colours/curvature, then send the artwork to the V2 overlay track.",
    placement: "left",
  },
  {
    target: "inspector-panel",
    title: "That's the Inspector ✅",
    body: "Five categories, nested sub-tabs, one place for every tool. Hit Next for the colour-grading deep dive, or Exit whenever you like.",
    placement: "left",
  },
];

/* ------------------------------------------------------------------ */
/* 2. Right panel — colour & scopes                                    */
/* ------------------------------------------------------------------ */

const RIGHT_STEPS: TourStep[] = [
  {
    target: "lumetri-panel",
    open: ["inspector-cat-color", "inspector-sub-color-wheels"],
    title: "🎨 Lumetri color & scopes",
    body: "The complete grading suite, split into three compact sub-tabs — Wheels, Correction and Presets — so nothing is buried in a wall of sliders. Every change applies in real time to the Program Monitor and is burned into your export.",
    placement: "left",
  },
  {
    target: "inspector-subtabs",
    open: ["inspector-cat-color", "inspector-sub-color-wheels"],
    title: "Color sub-tabs",
    body: "Wheels for three-way tonal colour, Correction for the 13 primary sliders, and Presets for the 20-look gallery plus the live luma scope. Switching sub-tabs animates smoothly and keeps your playhead and selected clip intact.",
    placement: "left",
  },
  {
    target: "color-wheels",
    open: ["inspector-cat-color", "inspector-sub-color-wheels"],
    title: "Wheels",
    body: "Three large wheels stacked top-to-bottom in the pro grading-suite layout — Shadows / Lift, Midtones / Gamma and Highlights / Gain, each with its label directly above. Drag anywhere inside a wheel to tint that tonal range; each wheel has its own Reset button (so clearing shadows never touches midtones or highlights), and double-clicking a wheel recentres just that wheel.",
    placement: "left",
  },
  {
    target: "color-sliders",
    open: ["inspector-cat-color", "inspector-sub-color-corrections"],
    title: "Basic correction & sliders",
    body: "Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks, Vibrance, Saturation, Temperature, Tint, Sharpness and Clarity — each with a slider and a precise numeric field, plus a Reset Color Adjustments button.",
    placement: "left",
  },
  {
    target: "cinematic-presets",
    open: ["inspector-cat-color", "inspector-sub-color-presets"],
    title: "Cinematic presets",
    body: "Five quick looks (Teal & Orange, Moody Noir, Cyberpunk, Golden Hour…) plus 15 more behind “More (+15)”. Pick one, then dial the Intensity slider to blend it in.",
    placement: "left",
  },
  {
    target: "luma-scope",
    open: ["inspector-cat-color", "inspector-sub-color-presets"],
    title: "Live luma waveform",
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
    title: "Track headers — locks, mute & solo",
    body: "Per lane: M mutes (and the V1 mute gates the clip's own audio), S solos — soloing an audio lane silences every other lane, and soloing a video lane hides the other video lanes so you can inspect one layer — the padlock locks the lane (blocking drag, trim, split and delete) and the eye hides it from the preview and the export. On A2 the eye is replaced by the microphone button for live voiceover recording.",
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
    body: "Your base footage in sequence order. Drag a clip to slide it in time — it magnetically snaps to the playhead, the In/Out marks and neighbouring clip edges. White handles on each side trim the in/out points, the amber junction icon between touching clips adds a transition (cross dissolve, dip to black, whip pan, glitch cut, zoom), and right-clicking a clip opens Split / Ripple delete / Delete. Position, scale and rotation can be keyframed from the Clip tab.",
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
    target: "tutorial-button",
    title: "👋 Replay this tour any time",
    body: "That's the Tutorial button — right next to Storage and Export. It opens this menu with the four section guides and the full studio tour, so you can revisit any part of the interface whenever you need a refresher. The rest of this guide covers the Program Monitor, header and export controls.",
    placement: "bottom",
    advanceOnClick: true,
  },
  {
    target: "save-indicator",
    title: "Autosave checkpoints",
    body: "Your project is checkpointed to IndexedDB automatically — a debounced save after every edit, plus a 60-second heartbeat — and the playhead is restored if the tab ever crashes. This dot shows the live state: grey “Unsaved changes”, pulsing amber “Auto-saving…”, green “All changes saved”.",
    placement: "bottom",
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
    body: "Scrub the timeline, step frame-by-frame with the arrow keys, undo/redo (Ctrl+Z / Ctrl+Y — the buttons grey out when there's nothing to undo), play/pause (Space) and toggle Loop. Undo covers clip edits, splits, ripple deletes, track locks and colour grading; scrubbing and zooming are deliberately excluded.",
    placement: "top",
  },
  {
    target: "marks",
    title: "Mark In / Mark Out",
    body: "Set an In and Out point (shortcuts I and O) to define the region that loops and exports. The bracket overlay on the ruler shows exactly what will be rendered.",
    placement: "top",
  },
  {
    target: "studio-menu-bar",
    title: "Compact studio menu",
    body: "The top studio bar now holds the compact production menus, aspect ratio, export resolution, Tutorial and Export. Project navigation and every editing action live here without consuming vertical canvas space.",
    placement: "bottom",
  },
];

export const TOUR_CATEGORIES: TourCategory[] = [
  {
    id: "left",
    emoji: "🎛️",
    title: "Inspector Guide",
    blurb: "Media library, audio, recording, Studio, effects, clip keyframes, speed, text, captions & stickers.",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
    steps: LEFT_STEPS,
  },
  {
    id: "right",
    emoji: "🎨",
    title: "Right Panel Guide",
    blurb: "Large stacked colour wheels, 13 sliders, presets gallery & live Luma scope.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/40",
    steps: RIGHT_STEPS,
  },
  {
    id: "timeline",
    emoji: "🎞️",
    title: "Timeline Workspace Guide",
    blurb: "V1–V3 & A1–A3 lanes, razor, ripple delete, locks, mute/solo, snapping and transitions.",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/40",
    steps: TIMELINE_STEPS,
  },
  {
    id: "monitor",
    emoji: "📺",
    title: "Program Monitor & Header Guide",
    blurb: "Tutorial button, autosave, storage, aspect ratios, blur fill, transport, Mark In/Out & export.",
    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
    steps: MONITOR_STEPS,
  },
];

export function buildFullTour(): TourStep[] {
  return TOUR_CATEGORIES.flatMap((category) => category.steps);
}
