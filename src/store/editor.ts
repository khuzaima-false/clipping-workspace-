import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import {
  loadProjectMedia,
  loadVideoSource,
  saveProjectMedia,
  saveVideoSource,
  type StoredAssetMeta,
  type StoredAudio,
  type TimelineClip,
  type TransitionType,
  type VideoAsset,
} from "@/lib/video-storage";
import {
  deleteMediaFile,
  getMediaFile,
  newMediaId,
  saveMediaFile,
} from "@/lib/media-storage";
import { renderSoundEffect, SOUND_EFFECTS, type SoundEffectId } from "@/lib/sfx";
import { audioPreview } from "@/lib/audio-preview";
import type { CaptionLanguageId } from "@/lib/transcribe";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "21:9";
/** How mismatched media fills the canvas behind the letterboxed frame. */
export type CanvasFill = "black" | "blur";
export type VideoFit = "contain" | "cover";
export type OverlayAlign = "left" | "center" | "right";

/** A single spoken word with its timing (seconds from the start of the video). */
export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

/** How AI-generated words animate as they are spoken. */
export type CaptionAnimation =
  | "none"
  | "pop"
  | "bounce"
  | "karaoke"
  | "typewriter"
  | "fadeIn"
  | "neon";

/** One-tap social caption looks. */
export type CaptionPreset = "classic" | "karaoke" | "bounce" | "neonBox";

/** Global styling applied to every auto-generated caption overlay. */
export type CaptionStyle = {
  /** Highlight the word currently being spoken (Hormozi / CapCut style). */
  activeWordHighlight: boolean;
  /** Draw a thick black outline behind caption text for contrast. */
  textStroke: boolean;
  /** Per-word entrance animation preset. */
  animation: CaptionAnimation;
  /** Fill color for the active/highlighted word. */
  highlightColor: string;
  /** Selected social-media caption look (drives the fields above). */
  preset: CaptionPreset;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  activeWordHighlight: true,
  textStroke: true,
  animation: "pop",
  highlightColor: "#facc15",
  preset: "classic",
};

/** Chroma-key (green/blue screen) settings. Runs entirely on the CPU canvas. */
export type ChromaKeySettings = {
  enabled: boolean;
  /** Key color, hex. */
  color: string;
  /** 0..100 — how far a pixel may stray from the key color before it is cut. */
  tolerance: number;
  /** 0..100 — softens the cut edge to avoid a hard, aliased matte. */
  feather: number;
};

export const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  enabled: false,
  color: "#00ff00",
  tolerance: 32,
  feather: 22,
};

/**
 * A transform keyframe for an overlay. Values are linear-interpolated between
 * adjacent keyframes during playback so overlays can animate over time.
 */
export type OverlayKeyframe = {
  id: string;
  /** Position on the timeline (seconds) where this pose applies. */
  time: number;
  /** Scale multiplier, 1 = the overlay's base size. */
  scale: number;
  /** Horizontal anchor, 0..100 (% of canvas width). */
  x: number;
  /** Vertical anchor, 0..100 (% of canvas height). */
  y: number;
  /** Opacity, 0..100. */
  opacity: number;
  /** Rotation, degrees. */
  rotation: number;
};

/** Default frame rate used for frame-stepping and export. */
export const DEFAULT_FPS = 30;

/** Colour-grading controls applied to the video frame before overlays. */
export type ColorAdjustments = {
  /** -100..100 (%) */
  brightness: number;
  /** -100..100 (%) overall exposure, stacked on brightness. */
  exposure: number;
  /** -100..100 (%) */
  contrast: number;
  /** -100..100 (%) */
  saturation: number;
  /** -180..180 (degrees) — a.k.a. temperature tilt. */
  hue: number;
  /** -100..100 — green/magenta tint (folded into hue-rotate). */
  tint: number;
  /** 0..20 (px) */
  blur: number;
};

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  tint: 0,
  blur: 0,
};

/**
 * An external audio track / sound effect layered on top of the video.
 * Times are in seconds on the master timeline.
 */
export type AudioTrack = {
  id: string;
  /** Stable id of the persisted source blob in media storage. */
  mediaId: string;
  name: string;
  /** Object URL for preview playback. */
  url: string;
  /** Original upload, kept so the exporter can re-decode if needed. */
  file: File;
  /** Decoded PCM used for mixing and export. */
  buffer: AudioBuffer | null;
  /** Timeline position where the track starts. */
  startTime: number;
  /** Playback gain, 0..1. */
  volume: number;
  /** Offset into the source file where playback begins. */
  trimStart: number;
  /** Usable length of the source after `trimStart`. */
  duration: number;
  /** Mute this track during preview + export. */
  muted: boolean;
  /** Solo this track (all non-soloed tracks are silenced). */
  solo: boolean;
  /** Fade-in length in seconds. */
  fadeIn: number;
  /** Fade-out length in seconds. */
  fadeOut: number;
  /** True for built-in synthesized sound effects. */
  synth?: boolean;
};

export type TextOverlay = {
  id: string;
  text: string;
  /** Horizontal anchor, 0..100 (% of canvas width). */
  x: number;
  /** Vertical anchor (box center), 0..100 (% of canvas height). */
  y: number;
  fontFamily: string;
  /** Font size in output pixels (canvas is rendered at target resolution). */
  fontSize: number;
  /** Text color, hex. */
  fillColor: string;
  /** Background fill, hex — empty string means transparent. */
  bgColor: string;
  /** Inner padding around the text, output px. */
  padding: number;
  /** Background corner radius, output px. */
  radius: number;
  alignment: OverlayAlign;
  /** Rotation around the overlay's center, degrees. */
  rotation: number;
  /** Layer opacity, 0..100. */
  opacity: number;
  /** Clip the overlay to its text box (simple mask). */
  mask: boolean;
  /** Seconds from the start of the video when this overlay appears. */
  startTime: number;
  /** Seconds from the start of the video when this overlay disappears. */
  endTime: number;
  /**
   * Word-level timings for AI-generated captions. When present the renderer
   * can highlight the active word and animate words as they are spoken.
   */
  words?: CaptionWord[];
  /** Marks a caption produced by the AI transcriber so it can be replaced on regeneration. */
  auto?: boolean;
  /** Per-overlay animation; falls back to the global caption style. */
  animation?: CaptionAnimation;
  /** Bitmap overlay (PNG data URL); when set, the overlay renders as an image. */
  imageSrc?: string;
  /** Blur (px) applied behind an image overlay. */
  bgBlur?: number;
  /** Transform keyframes; when present the renderer LERPs between them. */
  keyframes?: OverlayKeyframe[];
};

/** A keyframe on the speed (velocity) curve. `time` is in source-video seconds. */
export type SpeedPoint = {
  time: number;
  speed: number;
};

export const MIN_SPEED = 0.2;
export const MAX_SPEED = 5;

/** Named velocity presets, plus `custom` once the user edits the curve. */
export type SpeedPreset = "none" | "montage" | "hero" | "bullet" | "jumpCut" | "custom";

/** Cross-clip transition presets offered by the Transitions library. */
export type TransitionPreset = {
  id: TransitionType;
  label: string;
  /** Default overlap length (seconds). */
  duration: number;
};

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: "crossDissolve", label: "Cross Dissolve", duration: 0.6 },
  { id: "dipToBlack", label: "Dip to Black", duration: 0.5 },
  { id: "whipPan", label: "Whip Pan", duration: 0.4 },
  { id: "glitchCut", label: "Glitch Cut", duration: 0.3 },
  { id: "zoomIn", label: "Zoom In", duration: 0.5 },
];

export type VideoEffectType =
  | "zoom-in"
  | "zoom-out"
  | "camera-shake"
  | "flash"
  | "blur-vignette";

/** A timed visual effect applied on top of the video frame. */
export type VideoEffect = {
  id: string;
  type: VideoEffectType;
  /** Source-video time (seconds) where the effect begins. */
  startTime: number;
  /** Effect length in seconds. */
  duration: number;
  /** Strength, 0..1. */
  intensity: number;
};

/** Sensible default length/strength for each effect preset. */
export const EFFECT_DEFAULTS: Record<
  VideoEffectType,
  { duration: number; intensity: number }
> = {
  "zoom-in": { duration: 2, intensity: 0.6 },
  "zoom-out": { duration: 2, intensity: 0.6 },
  "camera-shake": { duration: 0.8, intensity: 0.5 },
  flash: { duration: 0.5, intensity: 0.8 },
  "blur-vignette": { duration: 2, intensity: 0.6 },
};

export function clampSpeed(speed: number): number {
  return Math.min(Math.max(speed, MIN_SPEED), MAX_SPEED);
}

/** Clamps, sorts and de-duplicates a speed-point list. */
export function normalizeSpeedPoints(points: SpeedPoint[]): SpeedPoint[] {
  const cleaned = points
    .map((point) => ({
      time: Math.max(0, point.time),
      speed: clampSpeed(point.speed),
    }))
    .sort((a, b) => a.time - b.time);

  if (cleaned.length === 0) return [{ time: 0, speed: 1 }];

  const result: SpeedPoint[] = [];
  for (const point of cleaned) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(point.time - previous.time) < 0.02) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

/** Normalized shapes (0..1 of the clip) expanded across the video duration. */
const PRESET_SHAPES: Record<"montage" | "hero" | "bullet" | "jumpCut", SpeedPoint[]> = {
  montage: [
    { time: 0, speed: 1 },
    { time: 0.15, speed: 3 },
    { time: 0.45, speed: 1 },
    { time: 0.7, speed: 3 },
    { time: 1, speed: 1 },
  ],
  hero: [
    { time: 0, speed: 1 },
    { time: 0.3, speed: 0.4 },
    { time: 0.55, speed: 0.4 },
    { time: 0.8, speed: 2.2 },
    { time: 1, speed: 2.2 },
  ],
  bullet: [
    { time: 0, speed: 1.5 },
    { time: 0.35, speed: 1.5 },
    { time: 0.45, speed: 0.25 },
    { time: 0.62, speed: 0.25 },
    { time: 0.72, speed: 1.5 },
    { time: 1, speed: 1.5 },
  ],
  // Fast spikes that read like hard jump cuts without changing clip count.
  jumpCut: [
    { time: 0, speed: 1 },
    { time: 0.18, speed: 1 },
    { time: 0.2, speed: 5 },
    { time: 0.28, speed: 1 },
    { time: 0.46, speed: 1 },
    { time: 0.48, speed: 5 },
    { time: 0.56, speed: 1 },
    { time: 0.74, speed: 1 },
    { time: 0.76, speed: 5 },
    { time: 0.84, speed: 1 },
    { time: 1, speed: 1 },
  ],
};

/** Builds the keypoint list for a named preset across the clip duration. */
export function buildSpeedPreset(
  preset: SpeedPreset,
  duration: number
): SpeedPoint[] {
  if (preset === "none" || preset === "custom") {
    return [{ time: 0, speed: 1 }];
  }
  const span = duration > 0 ? duration : 1;
  return PRESET_SHAPES[preset].map((point) => ({
    time: point.time * span,
    speed: point.speed,
  }));
}

export const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
] as const;

/** Snaps a time to the 0.1s control grid and clamps it into [min, max]. */
function snapTime(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value * 10) / 10, min), max);
}

/**
 * Keeps overlay timing inside a newly known video duration (e.g. an overlay
 * created before import, or after importing a shorter clip).
 */
function clampOverlaysToDuration(
  overlays: TextOverlay[],
  duration: number
): TextOverlay[] {
  return overlays.map((overlay) => {
    const startTime = Math.min(Math.max(overlay.startTime, 0), duration);
    const endTime = Math.min(Math.max(overlay.endTime, startTime), duration);
    return startTime === overlay.startTime && endTime === overlay.endTime
      ? overlay
      : { ...overlay, startTime, endTime };
  });
}

/** Generates a collision-resistant id, falling back when `crypto.randomUUID` is unavailable. */
export function createId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Resolves every sequence clip to its absolute timeline position and length.
 * Clips without an explicit `timelineStart` flow after the previous clip, so
 * sequential projects keep their layout while dragged clips stay put.
 */
export function computeClipStarts(
  sequence: TimelineClip[]
): { clip: TimelineClip; start: number; dur: number }[] {
  let cursor = 0;
  return sequence.map((clip) => {
    const dur = Math.max(0.1, clip.trimEnd - clip.trimStart);
    const start =
      typeof clip.timelineStart === "number" && clip.timelineStart >= 0
        ? clip.timelineStart
        : cursor;
    cursor = start + dur;
    return { clip, start, dur };
  });
}

function createOverlay(duration: number): TextOverlay {
  return {
    id: createId("overlay"),
    text: "Your caption here",
    x: 50,
    y: 85,
    fontFamily: "Arial",
    fontSize: 64,
    fillColor: "#ffffff",
    bgColor: "",
    padding: 24,
    radius: 16,
    alignment: "center",
    rotation: 0,
    opacity: 100,
    mask: false,
    startTime: 0,
    // Default to the first five seconds, or the whole clip when shorter.
    endTime: duration > 0 ? Math.min(5, duration) : 5,
  };
}

/** A snapshot of everything undo/redo can restore. */
export type EditSnapshot = {
  sequence: TimelineClip[];
  overlays: TextOverlay[];
  trimStart: number;
  trimEnd: number;
  colorAdjustments: ColorAdjustments;
  activeEffects: VideoEffect[];
  aspect: AspectRatio;
  speedPoints: SpeedPoint[];
  speedPreset: SpeedPreset;
  captionStyle: CaptionStyle;
  fit: VideoFit;
  offsetX: number;
  offsetY: number;
  canvasFill: CanvasFill;
  chromaKey: ChromaKeySettings;
};

type EditorState = {
  /** Current preview/export video element (owned by the store, not React). */
  videoEl: HTMLVideoElement | null;
  videoUrl: string | null;
  videoFile: File | null;
  videoName: string | null;
  videoError: string | null;

  /** Active project id — keys the locally persisted source video. */
  projectId: string | null;
  /** True when a project is open but its source video isn't stored locally. */
  videoMissing: boolean;
  /** True while restoring a persisted source video from IndexedDB. */
  videoRestoring: boolean;

  /** Uploaded media library (multiple clips per project, persisted in IndexedDB). */
  assets: VideoAsset[];
  /** Ordered clip sequence used to merge clips into one export. */
  sequence: TimelineClip[];
  /** Sequence clip currently loaded in the preview/editor. */
  activeClipId: string | null;
  /** True while the project's media library is loading. */
  assetsLoading: boolean;
  /** Trim applied once a selected clip's metadata loads. */
  pendingTrim: { trimStart: number; trimEnd: number } | null;
  /** Source-time to seek to once the clip's metadata loads (timeline scrub). */
  pendingSeek: number | null;
  /** Spoken language used for AI caption transcription. */
  captionLanguage: CaptionLanguageId;

  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  playing: boolean;

  aspect: AspectRatio;
  fit: VideoFit;
  offsetX: number;
  offsetY: number;
  /** Background fill strategy for letterboxed / mismatched media. */
  canvasFill: CanvasFill;

  overlays: TextOverlay[];
  selectedId: string | null;

  /** Global styling for AI-generated captions. */
  captionStyle: CaptionStyle;
  /** True while the Whisper model is downloading / transcribing. */
  transcribing: boolean;
  /** Model + transcription progress, 0..100. */
  transcribingProgress: number;
  /** Human-readable status line shown in the caption progress UI. */
  transcribingStatus: string;
  /** Last transcription failure, if any. */
  transcriptionError: string | null;

  /** Frame rate used for frame stepping and export. */
  fps: number;
  /** Use high-quality canvas scaling (crisp) for preview and export. */
  hdRendering: boolean;
  /** Colour grading applied to the video frame. */
  colorAdjustments: ColorAdjustments;
  /** External audio tracks / sound effects layered on the timeline. */
  audioTracks: AudioTrack[];
  /** Last audio-import failure, if any. */
  audioTrackError: string | null;

  /** Active speed (velocity) preset. */
  speedPreset: SpeedPreset;
  /** Speed keyframes along the source-video timeline. */
  speedPoints: SpeedPoint[];
  /** Timed visual effects applied over the video frame. */
  activeEffects: VideoEffect[];
  /** Chroma-key (green screen) settings for the active clip. */
  chromaKey: ChromaKeySettings;
  /** True while the program monitor acts as a color eyedropper. */
  eyedropper: boolean;

  loadVideo: (file: File) => void;
  /** Applies raw video bytes (e.g. restored from IndexedDB) to the editor. */
  loadVideoBlob: (
    blob: Blob,
    name: string,
    options?: { autoplay?: boolean }
  ) => void;
  /** Restores the source video persisted for `projectId`, if available. */
  restoreVideo: (projectId: string) => Promise<void>;
  /** Sets the language used for AI caption transcription. */
  setCaptionLanguage: (language: CaptionLanguageId) => void;
  /** Loads the project's media library + sequence and the first clip. */
  loadProjectMedia: (projectId: string) => Promise<void>;
  /** Adds one or more videos to the library and the timeline sequence. */
  addVideoAssets: (files: FileList | File[]) => Promise<void>;
  /** Removes a library asset and any sequence clips that used it. */
  removeAsset: (assetId: string) => void;
  /** Loads a sequence clip into the preview/editor. */
  selectClip: (clipId: string) => void;
  /** Scrubs to a source time inside a clip (used by the mobile filmstrip). */
  scrubTo: (clipId: string, sourceTime: number) => void;
  /** Advances to the next clip during playback; false when on the last clip. */
  advanceClip: (wrap?: boolean) => boolean;
  /** Removes a clip from the sequence. */
  removeClip: (clipId: string) => void;
  /** Splits the active clip into two clips at the current playhead. */
  splitActiveClip: () => void;
  /** Duplicates the active clip immediately after it. */
  duplicateActiveClip: () => void;
  /** Reorders a clip up (-1) or down (+1). */
  moveClip: (clipId: string, direction: -1 | 1) => void;
  /** Repositions a clip freely along the timeline (seconds). */
  moveClipTo: (clipId: string, timelineStart: number) => void;
  /** Moves a clip to a new index in the sequence (drag-to-reorder). */
  reorderClip: (clipId: string, toIndex: number) => void;
  /** Updates a clip's trim range. */
  setClipTrim: (
    clipId: string,
    patch: { trimStart?: number; trimEnd?: number }
  ) => void;
  /** Sets (or clears) the transition blended into a clip from the previous one. */
  setClipTransition: (
    clipId: string,
    type: TransitionType | null,
    duration?: number
  ) => void;
  /** Restores an undo/redo snapshot of the editable timeline state. */
  restoreEdit: (snapshot: EditSnapshot) => void;
  /** Undo/redo stacks for the editing session (capped for safety). */
  history: EditSnapshot[];
  future: EditSnapshot[];
  undo: () => void;
  redo: () => void;
  resetEditor: () => void;
  seek: (time: number) => void;
  /** Moves the playhead by `delta` frames (negative steps backwards). */
  stepFrame: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setTrimStart: (time: number) => void;
  setTrimEnd: (time: number) => void;
  resetTrim: () => void;
  setAspect: (aspect: AspectRatio) => void;
  /** Toggle high-quality (crisp) canvas scaling. */
  setHdRendering: (enabled: boolean) => void;
  setFit: (fit: VideoFit) => void;
  setOffset: (x: number, y: number) => void;
  /** Sets the letterbox background fill strategy. */
  setCanvasFill: (fill: CanvasFill) => void;
  addOverlay: () => void;
  /** Adds a text/emoji sticker overlay at a larger default size. */
  addTextSticker: (text: string, fontSize?: number) => void;
  /** Adds a graphic (SVG data URL) sticker overlay, centered. */
  addStickerImage: (src: string) => void;
  /** Adds a bitmap (PNG data URL) overlay layer (renders on V2). */
  addImageOverlay: (src: string, duration?: number) => void;
  updateOverlay: (id: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  setOverlayStartTime: (id: string, time: number) => void;
  setOverlayEndTime: (id: string, time: number) => void;
  /** Shifts an overlay along the timeline, preserving its duration. */
  moveOverlayTo: (id: string, startTime: number) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void;
  /** Runs client-side Whisper transcription and replaces the auto captions. */
  generateAutoCaptions: () => Promise<void>;
  /** Removes every AI-generated caption, keeping hand-made overlays. */
  clearAutoCaptions: () => void;
  /** Merges a partial colour-grading update. */
  setColorAdjustment: (patch: Partial<ColorAdjustments>) => void;
  /** Restores neutral colour grading. */
  resetColorAdjustments: () => void;
  /** Decodes and appends one or more uploaded audio files. */
  addAudioFiles: (files: FileList | File[]) => Promise<void>;
  /** Decodes a recorded blob (voiceover / mic) and appends it as a track. */
  addAudioTrackFromBlob: (blob: Blob, name: string) => Promise<void>;
  updateAudioTrack: (id: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
  /** Repositions an audio track along the timeline (seconds). */
  moveAudioTrackTo: (id: string, startTime: number) => void;
  removeAudioTrack: (id: string) => void;
  /** Applies a named velocity preset (scaled to the clip duration). */
  setSpeedPreset: (preset: SpeedPreset) => void;
  setSpeedPoints: (points: SpeedPoint[]) => void;
  /** Adds a keyframe; returns with points sorted by time. */
  addSpeedPoint: (point: SpeedPoint) => void;
  /** Updates a keyframe in place (index-stable, used while dragging). */
  updateSpeedPoint: (index: number, patch: Partial<SpeedPoint>) => void;
  removeSpeedPoint: (index: number) => void;
  /** Adds an effect of `type` starting at `atTime` seconds. */
  addEffect: (type: VideoEffectType, atTime: number) => void;
  updateEffect: (
    id: string,
    patch: Partial<Omit<VideoEffect, "id" | "type">>
  ) => void;
  /** Repositions an effect along the timeline (seconds). */
  moveEffectTo: (id: string, startTime: number) => void;
  removeEffect: (id: string) => void;
  clearEffects: () => void;

  /* Chroma key (green/blue screen) */
  /** Merges a chroma-key update for the active clip. */
  setChromaKey: (patch: Partial<ChromaKeySettings>) => void;
  /** Disables and resets chroma keying. */
  resetChromaKey: () => void;
  /** Toggles the program-monitor eyedropper (color picker) mode. */
  setEyedropper: (active: boolean) => void;

  /* Overlay keyframes */
  /** Records the selected overlay's current transform at the playhead. */
  addOverlayKeyframe: (overlayId?: string) => void;
  removeOverlayKeyframe: (overlayId: string, keyframeId: string) => void;
  clearOverlayKeyframes: (overlayId: string) => void;

  /* Captions */
  /** Applies a one-tap social caption preset. */
  applyCaptionPreset: (preset: CaptionPreset) => void;
  /** Builds timed caption overlays from a typed script (no server). */
  generateCaptionsFromScript: (script: string) => Promise<void>;

  /* Sound effects */
  /** Synthesizes and appends a royalty-free sound effect. */
  addSoundEffect: (id: SoundEffectId) => Promise<void>;
};

function releaseVideo(el: HTMLVideoElement | null, url: string | null): void {
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  if (url) URL.revokeObjectURL(url);
}

/** True when the file looks like an importable video. */
function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  );
}

/** Serializes the project's media metadata to IndexedDB (best-effort). */
function persistProject(state: EditorState): void {
  if (!state.projectId) return;
  const assetMeta: StoredAssetMeta[] = state.assets.map(
    ({ id, mediaId, name, type, size, updatedAt }) => ({
      id,
      mediaId,
      name,
      type,
      size,
      updatedAt,
    })
  );
  const audioMeta: StoredAudio[] = state.audioTracks.map(
    ({ id, mediaId, name, startTime, volume, trimStart, duration, muted, solo, fadeIn, fadeOut, synth }) => ({
      id,
      mediaId,
      name,
      startTime,
      volume,
      trimStart,
      duration,
      muted,
      solo,
      fadeIn,
      fadeOut,
      synth,
    })
  );
  void saveProjectMedia(state.projectId, {
    assets: assetMeta,
    sequence: state.sequence,
    overlays: state.overlays,
    audio: audioMeta,
  }).catch(() => {
    // IndexedDB can fail (quota / private mode); the session still works.
  });
}

/** Deep-ish snapshot of the editable state (arrays/objects are immutable in the store). */
function snapshotOf(state: EditorState): EditSnapshot {
  return {
    sequence: state.sequence,
    overlays: state.overlays,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    colorAdjustments: state.colorAdjustments,
    activeEffects: state.activeEffects,
    aspect: state.aspect,
    speedPoints: state.speedPoints,
    speedPreset: state.speedPreset,
    captionStyle: state.captionStyle,
    fit: state.fit,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    canvasFill: state.canvasFill,
    chromaKey: state.chromaKey,
  };
}

/** Suppresses history capture while an undo/redo is being applied. */
let historyPaused = false;

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
  videoEl: null,
  videoUrl: null,
  videoFile: null,
  videoName: null,
  videoError: null,

  projectId: null,
  videoMissing: false,
  videoRestoring: false,

  assets: [],
  sequence: [],
  activeClipId: null,
  assetsLoading: false,
  pendingTrim: null,
  pendingSeek: null,
  captionLanguage: "auto",

  duration: 0,
  currentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  volume: 1,
  playing: false,

  aspect: "16:9",
  fit: "contain",
  offsetX: 0,
  offsetY: 0,
  canvasFill: "black",

  overlays: [],
  selectedId: null,

  captionStyle: DEFAULT_CAPTION_STYLE,
  transcribing: false,
  transcribingProgress: 0,
  transcribingStatus: "",
  transcriptionError: null,

  fps: DEFAULT_FPS,
  hdRendering: true,
  history: [],
  future: [],
  colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
  audioTracks: [],
  audioTrackError: null,

  speedPreset: "none",
  speedPoints: [{ time: 0, speed: 1 }],
  activeEffects: [],
  chromaKey: DEFAULT_CHROMA_KEY,
  eyedropper: false,

  loadVideo: (file) => {
    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!isVideo) {
      set({ videoError: "Please choose an MP4 or WebM video file." });
      return;
    }

    // Persist the raw bytes so the source survives reloads and tab closes.
    const projectId = get().projectId;
    if (projectId) {
      void saveVideoSource(projectId, file, file.name).catch(() => {
        // IndexedDB can fail (quota, private mode); playback still works now.
      });
    }

    get().loadVideoBlob(file, file.name);
  },

  loadVideoBlob: (blob, name, options) => {
    const autoplay = options?.autoplay ?? false;
    // Release the previous source before swapping in the new one.
    const previous = get();
    releaseVideo(previous.videoEl, previous.videoUrl);
    for (const track of previous.audioTracks) URL.revokeObjectURL(track.url);
    set({
      videoEl: null,
      videoUrl: null,
      videoFile: null,
      videoName: null,
      videoError: null,
      videoMissing: false,
      duration: 0,
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      playing: false,
      transcribing: false,
      transcribingProgress: 0,
      transcribingStatus: "",
      transcriptionError: null,
      audioTracks: [],
      audioTrackError: null,
      speedPreset: "none",
      speedPoints: [{ time: 0, speed: 1 }],
      activeEffects: [],
    });

    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.preload = "auto";
    el.playsInline = true;
    el.src = url;
    el.volume = get().volume;

    const applyDuration = (value: number) => {
      if (get().videoEl !== el) return;
      const preset = get().speedPreset;
      const speedPoints =
        preset === "none"
          ? [{ time: 0, speed: 1 }]
          : preset === "custom"
            ? normalizeSpeedPoints(get().speedPoints).map((point) => ({
                ...point,
                time: Math.min(point.time, value),
              }))
            : buildSpeedPreset(preset, value);
      // Restore a clip's saved trims when re-selecting it; otherwise default
      // to the full range.
      const pending = get().pendingTrim;
      const trimStart = pending
        ? Math.min(Math.max(pending.trimStart, 0), value)
        : 0;
      const trimEnd = pending
        ? Math.min(Math.max(pending.trimEnd, trimStart + 0.1), value)
        : value;
      // A timeline scrub queues a source time to land on once metadata loads.
      const pendingSeek = get().pendingSeek;
      const seekTo =
        pendingSeek !== null
          ? Math.min(Math.max(pendingSeek, trimStart), trimEnd)
          : 0;
      set({
        duration: value,
        trimStart,
        trimEnd,
        currentTime: seekTo,
        pendingTrim: null,
        pendingSeek: null,
        overlays: clampOverlaysToDuration(get().overlays, value),
        speedPoints,
      });
      if (seekTo > 0) {
        try {
          el.currentTime = seekTo;
        } catch {
          // Element not seekable yet; the next frame will settle.
        }
      }
      const activeId = get().activeClipId;
      if (activeId) get().setClipTrim(activeId, { trimStart, trimEnd });
    };

    el.addEventListener("loadedmetadata", () => {
      if (get().videoEl !== el) return;

      if (Number.isFinite(el.duration) && el.duration > 0) {
        applyDuration(el.duration);
        return;
      }

      // Some WebM files (e.g. MediaRecorder/screen-recording output) omit
      // duration metadata and report Infinity. Seeking far past the end
      // forces the browser to scan the file and fire durationchange with
      // the real duration.
      const resolveDuration = () => {
        if (get().videoEl !== el) return;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.removeEventListener("durationchange", resolveDuration);
          el.currentTime = 0;
          applyDuration(el.duration);
        }
      };
      el.addEventListener("durationchange", resolveDuration);
      el.currentTime = 1e101;
    });

    el.addEventListener("ended", () => {
      if (get().videoEl !== el) return;
      // Keep `playing` true so the preview loop can advance to the next clip
      // (or loop / stop) — the loop owns the boundary decision.
      set({ currentTime: el.currentTime });
    });

    el.addEventListener("error", () => {
      if (get().videoEl !== el) return;
      set({
        playing: false,
        videoError: "This video could not be decoded by your browser.",
      });
    });

    const file =
      blob instanceof File
        ? blob
        : new File([blob], name, { type: blob.type || "video/mp4" });

    set({
      videoEl: el,
      videoUrl: url,
      videoFile: file,
      videoName: name,
      videoMissing: false,
    });

    if (autoplay) {
      set({ playing: true });
      el.addEventListener("canplay", () => {
        if (get().videoEl !== el || !get().playing) return;
        void el.play().catch(() => {
          if (get().videoEl === el) set({ playing: false });
        });
      });
    }
  },

  restoreVideo: async (projectId) => {
    if (!projectId) return;

    const current = get();
    if (current.projectId === projectId && current.videoEl) return;
    // Switching projects: drop the previous project's in-memory source.
    if (current.projectId !== projectId) {
      get().resetEditor();
    }

    set({ projectId, videoRestoring: true, videoMissing: false });

    try {
      const stored = await loadVideoSource(projectId);
      if (get().projectId !== projectId) return; // navigated away mid-load
      if (stored) {
        get().loadVideoBlob(stored.blob, stored.name);
        set({ videoRestoring: false });
      } else {
        set({ videoRestoring: false, videoMissing: true });
      }
    } catch {
      set({ videoRestoring: false, videoMissing: true });
    }
  },

  setCaptionLanguage: (language) => set({ captionLanguage: language }),

  loadProjectMedia: async (projectId) => {
    set({ projectId, assetsLoading: true });
    try {
      const media = await loadProjectMedia(projectId);
      if (get().projectId !== projectId) return;

      // Rehydrate asset blobs from media storage (migrating legacy inline blobs).
      const assets: VideoAsset[] = [];
      for (const raw of media.assets as (StoredAssetMeta & { blob?: Blob })[]) {
        let mediaId = raw.mediaId;
        let blob: Blob | null = raw.blob ?? null;
        if (!blob && mediaId) blob = await getMediaFile(mediaId);
        if (!blob) continue; // binary missing → drop the asset
        if (!mediaId) {
          mediaId = newMediaId();
          try {
            await saveMediaFile(mediaId, blob);
          } catch {
            // ignore
          }
        }
        assets.push({
          id: raw.id,
          mediaId,
          name: raw.name,
          type: raw.type,
          size: raw.size,
          updatedAt: raw.updatedAt,
          blob,
        });
      }

      const assetIds = new Set(assets.map((asset) => asset.id));
      // Re-flow the timeline: the sequence order is the play order, so drop any
      // stale free-position offsets from older sessions.
      const sequence = media.sequence
        .filter((clip) => assetIds.has(clip.assetId))
        .map((clip) => {
          const copy = { ...clip };
          delete copy.timelineStart;
          return copy;
        });
      const overlays = (media.overlays as TextOverlay[]).filter(Boolean);

      // Rehydrate audio tracks (fetch + decode).
      const audioTracks: AudioTrack[] = [];
      for (const raw of media.audio) {
        const blob = await getMediaFile(raw.mediaId);
        if (!blob) continue;
        const file =
          blob instanceof File
            ? blob
            : new File([blob], raw.name, { type: blob.type || "audio/mpeg" });
        let buffer: AudioBuffer | null = null;
        try {
          const { decodeAudioFile } = await import("@/lib/audio");
          buffer = (await decodeAudioFile(file))?.buffer ?? null;
        } catch {
          buffer = null;
        }
        audioTracks.push({
          id: raw.id,
          mediaId: raw.mediaId,
          name: raw.name,
          url: URL.createObjectURL(blob),
          file,
          buffer,
          startTime: raw.startTime,
          volume: raw.volume,
          trimStart: raw.trimStart,
          duration: raw.duration,
          muted: raw.muted ?? false,
          solo: raw.solo ?? false,
          fadeIn: raw.fadeIn ?? 0,
          fadeOut: raw.fadeOut ?? 0,
          synth: raw.synth,
        });
      }

      set({ assets, sequence, overlays, audioTracks, assetsLoading: false });

      const firstClip = sequence[0];
      const asset = firstClip
        ? assets.find((item) => item.id === firstClip.assetId)
        : undefined;
      if (firstClip && asset) {
        set({
          activeClipId: firstClip.id,
          pendingTrim: {
            trimStart: firstClip.trimStart,
            trimEnd: firstClip.trimEnd,
          },
          pendingSeek: null,
          chromaKey: firstClip.chromaKey ?? DEFAULT_CHROMA_KEY,
        });
        get().loadVideoBlob(asset.blob, asset.name);
        return;
      }
      if (assets.length === 0) set({ videoMissing: true });
    } catch {
      set({ assetsLoading: false, videoMissing: true });
    }
  },

  addVideoAssets: async (files) => {
    const list = Array.from(files).filter(isVideoFile);
    if (list.length === 0) {
      set({ videoError: "Please choose MP4 or WebM video files." });
      return;
    }

    const assets = [...get().assets];
    const sequence = [...get().sequence];
    const newClips: TimelineClip[] = [];
    for (const file of list) {
      const mediaId = newMediaId();
      try {
        await saveMediaFile(mediaId, file);
      } catch {
        // Storage can fail (quota / private mode); the session still works.
      }
      const asset: VideoAsset = {
        id: createId("asset"),
        mediaId,
        name: file.name,
        type: file.type || "video/mp4",
        size: file.size,
        updatedAt: Date.now(),
        blob: file,
      };
      assets.push(asset);
      const clip: TimelineClip = {
        id: createId("clip"),
        assetId: asset.id,
        trimStart: 0,
        trimEnd: 0,
      };
      sequence.push(clip);
      newClips.push(clip);
    }

    set({ assets, sequence, videoError: null });
    persistProject(get());

    const firstClip = newClips[0];
    const firstAsset = assets.find((asset) => asset.id === firstClip.assetId);
    if (firstAsset) {
      set({
        activeClipId: firstClip.id,
        pendingTrim: null,
        pendingSeek: null,
        chromaKey: DEFAULT_CHROMA_KEY,
      });
      get().loadVideoBlob(firstAsset.blob, firstAsset.name);
    }
  },

  removeAsset: (assetId) => {
    const removed = get().assets.find((asset) => asset.id === assetId);
    if (removed) void deleteMediaFile(removed.mediaId);
    const assets = get().assets.filter((asset) => asset.id !== assetId);
    const sequence = get().sequence.filter((clip) => clip.assetId !== assetId);
    set({ assets, sequence });
    persistProject(get());

    const activeGone =
      !get().activeClipId ||
      !sequence.some((clip) => clip.id === get().activeClipId);
    if (activeGone && get().activeClipId) {
      const { videoEl, videoUrl } = get();
      releaseVideo(videoEl, videoUrl);
      set({
        videoEl: null,
        videoUrl: null,
        videoFile: null,
        videoName: null,
        activeClipId: null,
        pendingTrim: null,
        duration: 0,
        currentTime: 0,
        trimStart: 0,
        trimEnd: 0,
        playing: false,
        videoMissing: sequence.length === 0,
      });
      const next = sequence[0];
      if (next) get().selectClip(next.id);
    }
  },

  selectClip: (clipId) => {
    const clip = get().sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const asset = get().assets.find((item) => item.id === clip.assetId);
    if (!asset) return;
    set({
      activeClipId: clipId,
      pendingTrim: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
      pendingSeek: null,
      chromaKey: clip.chromaKey ?? DEFAULT_CHROMA_KEY,
    });
    get().loadVideoBlob(asset.blob, asset.name);
  },

  scrubTo: (clipId, sourceTime) => {
    const clip = get().sequence.find((item) => item.id === clipId);
    if (!clip) return;
    const time = Math.min(Math.max(sourceTime, clip.trimStart), clip.trimEnd);
    const active = get().activeClipId;
    const el = get().videoEl;

    // Same clip: seek directly when the element is ready, otherwise queue it.
    if (clipId === active) {
      if (el && el.readyState >= 1) get().seek(time);
      else set({ pendingSeek: time });
      return;
    }

    // Different clip: swap the source and land on `time` once it loads.
    const asset = get().assets.find((item) => item.id === clip.assetId);
    if (!asset) return;
    set({
      activeClipId: clipId,
      pendingTrim: { trimStart: clip.trimStart, trimEnd: clip.trimEnd },
      pendingSeek: time,
      chromaKey: clip.chromaKey ?? DEFAULT_CHROMA_KEY,
    });
    get().loadVideoBlob(asset.blob, asset.name);
  },

  advanceClip: (wrap = false) => {
    const { sequence, activeClipId } = get();
    if (sequence.length === 0) return false;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    let next: TimelineClip | undefined;
    if (index >= 0 && index + 1 < sequence.length) next = sequence[index + 1];
    else if (wrap) next = sequence[0];
    // Single-clip wrap loops in place; the preview loop handles it.
    if (!next || next.id === activeClipId) return false;
    const asset = get().assets.find((item) => item.id === next.assetId);
    if (!asset) return false;
    set({
      activeClipId: next.id,
      pendingTrim: { trimStart: next.trimStart, trimEnd: next.trimEnd },
      pendingSeek: next.trimStart,
      chromaKey: next.chromaKey ?? DEFAULT_CHROMA_KEY,
    });
    // Autoplay so the sequence keeps rolling from one clip into the next.
    get().loadVideoBlob(asset.blob, asset.name, { autoplay: true });
    return true;
  },

  removeClip: (clipId) => {
    const sequence = get().sequence.filter((clip) => clip.id !== clipId);
    set({ sequence });
    // Garbage-collect assets whose clips are all gone (frees media storage).
    const used = new Set(sequence.map((clip) => clip.assetId));
    const orphaned = get().assets.filter((asset) => !used.has(asset.id));
    if (orphaned.length > 0) {
      for (const asset of orphaned) void deleteMediaFile(asset.mediaId);
      set({ assets: get().assets.filter((asset) => used.has(asset.id)) });
    }
    persistProject(get());

    if (get().activeClipId === clipId) {
      const { videoEl, videoUrl } = get();
      releaseVideo(videoEl, videoUrl);
      set({
        videoEl: null,
        videoUrl: null,
        videoFile: null,
        videoName: null,
        activeClipId: null,
        pendingTrim: null,
        duration: 0,
        currentTime: 0,
        trimStart: 0,
        trimEnd: 0,
        playing: false,
        videoMissing: sequence.length === 0,
      });
      const next = sequence[0];
      if (next) get().selectClip(next.id);
    }
  },

  moveClip: (clipId, direction) => {
    const sequence = [...get().sequence];
    const index = sequence.findIndex((clip) => clip.id === clipId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sequence.length) return;
    const [clip] = sequence.splice(index, 1);
    sequence.splice(target, 0, clip);
    set({ sequence });
    persistProject(get());
  },

  moveClipTo: (clipId, timelineStart) => {
    set({
      sequence: get().sequence.map((clip) =>
        clip.id === clipId
          ? { ...clip, timelineStart: Math.max(0, timelineStart) }
          : clip
      ),
    });
    persistProject(get());
  },

  reorderClip: (clipId, toIndex) => {
    const sequence = get().sequence.slice();
    const from = sequence.findIndex((clip) => clip.id === clipId);
    if (from < 0) return;
    const [clip] = sequence.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, sequence.length));
    if (clamped === from) return;
    sequence.splice(clamped, 0, clip);
    // Reordering re-flows the timeline: drop stale free-position offsets so the
    // array order *is* the play order.
    const normalized = sequence.map((item) => {
      const copy = { ...item };
      delete copy.timelineStart;
      return copy;
    });
    set({ sequence: normalized });
    persistProject(get());
  },

  setClipTrim: (clipId, patch) => {
    const sequence = get().sequence.map((clip) => {
      if (clip.id !== clipId) return clip;
      const next = { ...clip, ...patch };
      next.trimStart = Math.max(0, next.trimStart);
      if (!(next.trimEnd > next.trimStart + 0.05)) {
        // Keep a minimum span, honouring whichever edge was just moved.
        if (patch.trimEnd !== undefined) next.trimEnd = next.trimStart + 0.1;
        else next.trimStart = Math.max(0, next.trimEnd - 0.1);
      }
      return next;
    });
    set({ sequence });
    persistProject(get());
  },

  setClipTransition: (clipId, type, duration) => {
    set({
      sequence: get().sequence.map((clip) => {
        if (clip.id !== clipId) return clip;
        if (!type) {
          const rest = { ...clip };
          delete rest.transitionIn;
          return rest;
        }
        const preset = TRANSITION_PRESETS.find((item) => item.id === type);
        return {
          ...clip,
          transitionIn: {
            type,
            duration: Math.max(0.1, duration ?? preset?.duration ?? 0.5),
          },
        };
      }),
    });
    persistProject(get());
  },

  restoreEdit: (snapshot) =>
    set({
      sequence: snapshot.sequence,
      overlays: snapshot.overlays,
      trimStart: snapshot.trimStart,
      trimEnd: snapshot.trimEnd,
      colorAdjustments: snapshot.colorAdjustments,
      activeEffects: snapshot.activeEffects,
      aspect: snapshot.aspect,
      speedPoints: snapshot.speedPoints,
      speedPreset: snapshot.speedPreset,
      captionStyle: snapshot.captionStyle,
      fit: snapshot.fit,
      offsetX: snapshot.offsetX,
      offsetY: snapshot.offsetY,
      canvasFill: snapshot.canvasFill,
      chromaKey: snapshot.chromaKey,
    }),

  undo: () => {
    const { history, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current = snapshotOf(get());
    historyPaused = true;
    set({ history: history.slice(0, -1), future: [...future, current] });
    get().restoreEdit(previous);
    historyPaused = false;
  },

  redo: () => {
    const { history, future } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = snapshotOf(get());
    historyPaused = true;
    set({ future: future.slice(0, -1), history: [...history, current] });
    get().restoreEdit(next);
    historyPaused = false;
  },

  splitActiveClip: () => {
    const { activeClipId, sequence, currentTime } = get();
    if (!activeClipId || sequence.length === 0) return;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    if (index < 0) return;
    const clip = sequence[index];
    const at = Math.min(
      Math.max(currentTime, clip.trimStart + 0.05),
      clip.trimEnd - 0.05
    );
    if (at <= clip.trimStart + 0.01 || at >= clip.trimEnd - 0.01) return;
    const first: TimelineClip = { ...clip, trimEnd: at };
    const second: TimelineClip = {
      id: createId("clip"),
      assetId: clip.assetId,
      trimStart: at,
      trimEnd: clip.trimEnd,
    };
    const next = [
      ...sequence.slice(0, index),
      first,
      second,
      ...sequence.slice(index + 1),
    ];
    set({
      sequence: next,
      activeClipId: second.id,
      trimStart: second.trimStart,
      trimEnd: second.trimEnd,
    });
    persistProject(get());
  },

  duplicateActiveClip: () => {
    const { activeClipId, sequence } = get();
    if (!activeClipId) return;
    const index = sequence.findIndex((clip) => clip.id === activeClipId);
    if (index < 0) return;
    const clip = sequence[index];
    const copy: TimelineClip = {
      id: createId("clip"),
      assetId: clip.assetId,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    };
    const next = [
      ...sequence.slice(0, index + 1),
      copy,
      ...sequence.slice(index + 1),
    ];
    set({ sequence: next, activeClipId: copy.id });
    persistProject(get());
  },

  resetEditor: () => {
    const { videoEl, videoUrl, audioTracks } = get();
    releaseVideo(videoEl, videoUrl);
    for (const track of audioTracks) URL.revokeObjectURL(track.url);
    audioPreview.stop();

    set({
      videoEl: null,
      videoUrl: null,
      videoFile: null,
      videoName: null,
      videoError: null,
      projectId: null,
      videoMissing: false,
      videoRestoring: false,
      assets: [],
      sequence: [],
      activeClipId: null,
      assetsLoading: false,
      pendingTrim: null,
      pendingSeek: null,
      captionLanguage: "auto",
      duration: 0,
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      playing: false,
      aspect: "16:9",
      fit: "contain",
      offsetX: 0,
      offsetY: 0,
      canvasFill: "black",
      overlays: [],
      selectedId: null,
      captionStyle: DEFAULT_CAPTION_STYLE,
      transcribing: false,
      transcribingProgress: 0,
      transcribingStatus: "",
      transcriptionError: null,
      fps: DEFAULT_FPS,
      hdRendering: true,
      history: [],
      future: [],
      colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
      audioTracks: [],
      audioTrackError: null,
      speedPreset: "none",
      speedPoints: [{ time: 0, speed: 1 }],
      activeEffects: [],
      chromaKey: DEFAULT_CHROMA_KEY,
      eyedropper: false,
    });
  },

  seek: (time) => {
    const { videoEl, duration } = get();
    const clamped = Math.min(Math.max(time, 0), duration || Number.MAX_SAFE_INTEGER);
    if (videoEl) videoEl.currentTime = clamped;
    set({ currentTime: clamped });
  },

  stepFrame: (delta) => {
    const { currentTime, duration, fps } = get();
    const safeFps = fps > 0 ? fps : DEFAULT_FPS;
    const lastFrame = duration > 0 ? Math.round(duration * safeFps) : Number.MAX_SAFE_INTEGER;
    // Snap to the frame grid so repeated steps never drift.
    const frame = Math.min(Math.max(Math.round(currentTime * safeFps) + delta, 0), lastFrame);
    get().seek(frame / safeFps);
  },

  setPlaying: (playing) => {
    const { videoEl } = get();
    if (!videoEl) return;

    if (playing) {
      set({ playing: true });
      videoEl.play().catch(() => {
        if (get().videoEl === videoEl) set({ playing: false });
      });
    } else {
      videoEl.pause();
      set({ playing: false, currentTime: videoEl.currentTime });
    }
  },

  setVolume: (volume) => {
    const clamped = Math.min(Math.max(volume, 0), 1);
    const { videoEl } = get();
    if (videoEl) videoEl.volume = clamped;
    set({ volume: clamped });
  },

  setTrimStart: (time) => {
    const { trimEnd, duration, videoEl } = get();
    const max = Math.max(0, Math.min(trimEnd - 0.1, duration || trimEnd));
    const next = Math.min(Math.max(time, 0), max);
    set({ trimStart: next });
    // Bring the playhead up to the new in-point so the trimmed head is visible.
    if (videoEl && videoEl.currentTime < next) {
      videoEl.currentTime = next;
      set({ currentTime: next });
    }
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimStart: next });
  },

  setTrimEnd: (time) => {
    const { trimStart, duration, videoEl } = get();
    if (duration <= 0) return;
    const min = Math.min(Math.max(trimStart + 0.1, 0), duration);
    const next = Math.max(Math.min(time, duration), min);
    set({ trimEnd: next });
    // If the out-point was pulled before the playhead, snap it back so the
    // preview never renders past the trimmed endpoint.
    if (videoEl && videoEl.currentTime > next) {
      videoEl.currentTime = next;
      set({ currentTime: next });
    }
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimEnd: next });
  },

  resetTrim: () => {
    const { duration } = get();
    set({ trimStart: 0, trimEnd: duration });
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimStart: 0, trimEnd: duration });
  },

  setAspect: (aspect) => set({ aspect }),

  setHdRendering: (enabled) => set({ hdRendering: enabled }),

  setFit: (fit) => set({ fit, offsetX: fit === "contain" ? 0 : get().offsetX, offsetY: fit === "contain" ? 0 : get().offsetY }),

  setOffset: (x, y) =>
    set({
      offsetX: Math.min(Math.max(x, -100), 100),
      offsetY: Math.min(Math.max(y, -100), 100),
    }),

  setCanvasFill: (fill) => set({ canvasFill: fill }),

  addOverlay: () => {
    const overlay = createOverlay(get().duration);
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addTextSticker: (text, fontSize = 120) => {
    const overlay: TextOverlay = {
      ...createOverlay(get().duration),
      text,
      fontSize,
      x: 50,
      y: 50,
      padding: 0,
      bgColor: "",
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addStickerImage: (src) => {
    const overlay: TextOverlay = {
      ...createOverlay(get().duration),
      text: "",
      imageSrc: src,
      x: 50,
      y: 50,
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  addImageOverlay: (src, duration = 0) => {
    const overlay: TextOverlay = {
      ...createOverlay(duration),
      text: "",
      imageSrc: src,
    };
    set({ overlays: [...get().overlays, overlay], selectedId: overlay.id });
  },

  updateOverlay: (id, patch) =>
    set({
      overlays: get().overlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...patch } : overlay
      ),
    }),

  setOverlayStartTime: (id, time) => {
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    // The start can never pass the end (or the video's duration).
    const upper = duration > 0 ? Math.min(duration, overlay.endTime) : overlay.endTime;
    const startTime = snapTime(time, 0, upper);
    if (startTime === overlay.startTime) return;
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, startTime } : item
      ),
    });
  },

  setOverlayEndTime: (id, time) => {
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    const upper = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const endTime = snapTime(time, overlay.startTime, upper);
    if (endTime === overlay.endTime) return;
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, endTime } : item
      ),
    });
  },

  moveOverlayTo: (id, startTime) => {
    const { overlays, duration } = get();
    const overlay = overlays.find((item) => item.id === id);
    if (!overlay) return;
    const span = Math.max(0.1, overlay.endTime - overlay.startTime);
    const upper = duration > 0 ? Math.max(0, duration - span) : Number.MAX_SAFE_INTEGER;
    const start = Math.min(Math.max(startTime, 0), upper);
    set({
      overlays: overlays.map((item) =>
        item.id === id ? { ...item, startTime: start, endTime: start + span } : item
      ),
    });
  },

  removeOverlay: (id) =>
    set({
      overlays: get().overlays.filter((overlay) => overlay.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  selectOverlay: (id) => set({ selectedId: id }),

  setCaptionStyle: (patch) =>
    set({ captionStyle: { ...get().captionStyle, ...patch } }),

  generateAutoCaptions: async () => {
    const { videoFile, transcribing } = get();
    if (!videoFile) {
      set({ transcriptionError: "Import a video before generating captions." });
      return;
    }
    if (transcribing) return;

    set({
      transcribing: true,
      transcribingProgress: 0,
      transcribingStatus: "Preparing audio…",
      transcriptionError: null,
    });

    try {
      // Loaded on demand so the large WASM runtime never ships in the
      // initial editor bundle, and never touches the server.
      const { transcribeVideoFile } = await import("@/lib/transcribe");
      const { buildAutoCaptions } = await import("@/lib/captions");

      const words = await transcribeVideoFile(videoFile, {
        language: get().captionLanguage,
        onProgress: (status, progress) =>
          set({
            transcribingStatus: status,
            transcribingProgress: Math.round(progress),
          }),
      });

      if (words.length === 0) {
        set({
          transcribing: false,
          transcribingProgress: 0,
          transcribingStatus: "",
          transcriptionError: "No speech was detected in this video.",
        });
        return;
      }

      const captions = buildAutoCaptions(words, {
        duration: get().duration,
        aspect: get().aspect,
      });

      set({
        overlays: [...get().overlays.filter((overlay) => !overlay.auto), ...captions],
        selectedId: captions[0]?.id ?? get().selectedId,
        transcribing: false,
        transcribingProgress: 100,
        transcribingStatus: "",
        transcriptionError: null,
      });
    } catch (error) {
      set({
        transcribing: false,
        transcribingProgress: 0,
        transcribingStatus: "",
        transcriptionError:
          error instanceof Error
            ? error.message
            : "Transcription failed in this browser.",
      });
    }
  },

  clearAutoCaptions: () => {
    const { overlays, selectedId } = get();
    const selected = overlays.find((overlay) => overlay.id === selectedId);
    set({
      overlays: overlays.filter((overlay) => !overlay.auto),
      selectedId: selected?.auto ? null : selectedId,
    });
  },

  setColorAdjustment: (patch) =>
    set({ colorAdjustments: { ...get().colorAdjustments, ...patch } }),

  resetColorAdjustments: () =>
    set({ colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS }),

  addAudioFiles: async (files) => {
    const list = Array.from(files).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i.test(file.name)
    );
    if (list.length === 0) {
      set({ audioTrackError: "Please choose an MP3 or WAV audio file." });
      return;
    }

    try {
      const { decodeAudioFile } = await import("@/lib/audio");
      for (const file of list) {
        const mediaId = newMediaId();
        try {
          await saveMediaFile(mediaId, file);
        } catch {
          // ignore
        }
        const url = URL.createObjectURL(file);
        const decoded = await decodeAudioFile(file);
        const track: AudioTrack = {
          id: createId("audio"),
          mediaId,
          name: file.name,
          url,
          file,
          buffer: decoded?.buffer ?? null,
          startTime: 0,
          volume: 1,
          trimStart: 0,
          duration: decoded?.duration ?? 0,
          muted: false,
          solo: false,
          fadeIn: 0,
          fadeOut: 0,
        };
        set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
      }
    } catch (error) {
      set({
        audioTrackError:
          error instanceof Error
            ? error.message
            : "That audio file could not be decoded.",
      });
    }
  },

  addAudioTrackFromBlob: async (blob, name) => {
    try {
      const { decodeAudioFile } = await import("@/lib/audio");
      const mediaId = newMediaId();
      try {
        await saveMediaFile(mediaId, blob);
      } catch {
        // Storage can fail; playback still works this session.
      }
      const url = URL.createObjectURL(blob);
      const file =
        blob instanceof File
          ? blob
          : new File([blob], name, { type: blob.type || "audio/webm" });
      const decoded = await decodeAudioFile(file);
      const track: AudioTrack = {
        id: createId("audio"),
        mediaId,
        name,
        url,
        file,
        buffer: decoded?.buffer ?? null,
        startTime: get().currentTime,
        volume: 1,
        trimStart: 0,
        duration: decoded?.duration ?? 0,
        muted: false,
        solo: false,
        fadeIn: 0,
        fadeOut: 0,
      };
      set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
    } catch (error) {
      set({
        audioTrackError:
          error instanceof Error
            ? error.message
            : "That recording could not be decoded.",
      });
    }
  },

  updateAudioTrack: (id, patch) =>
    set({
      audioTracks: get().audioTracks.map((track) => {
        if (track.id !== id) return track;
        const next = { ...track, ...patch };
        const maxDuration = track.buffer ? track.buffer.duration : track.duration;
        next.trimStart = Math.min(Math.max(next.trimStart, 0), Math.max(0, maxDuration - 0.05));
        next.volume = Math.min(Math.max(next.volume, 0), 1);
        next.startTime = Math.max(0, next.startTime);
        next.duration = Math.min(Math.max(next.duration, 0), Math.max(0, maxDuration - next.trimStart));
        next.fadeIn = Math.max(0, Math.min(next.fadeIn ?? 0, next.duration));
        next.fadeOut = Math.max(0, Math.min(next.fadeOut ?? 0, next.duration));
        return next;
      }),
    }),

  moveAudioTrackTo: (id, startTime) =>
    set({
      audioTracks: get().audioTracks.map((track) =>
        track.id === id ? { ...track, startTime: Math.max(0, startTime) } : track
      ),
    }),

  removeAudioTrack: (id) => {
    const track = get().audioTracks.find((item) => item.id === id);
    if (track) {
      URL.revokeObjectURL(track.url);
      void deleteMediaFile(track.mediaId);
    }
    set({ audioTracks: get().audioTracks.filter((item) => item.id !== id) });
  },

  setSpeedPreset: (preset) => {
    if (preset === "custom") {
      set({ speedPreset: preset });
      return;
    }
    set({
      speedPreset: preset,
      speedPoints: buildSpeedPreset(preset, get().duration),
    });
  },

  setSpeedPoints: (points) =>
    set({ speedPoints: normalizeSpeedPoints(points), speedPreset: "custom" }),

  addSpeedPoint: (point) => {
    const points = [...get().speedPoints, point].sort((a, b) => a.time - b.time);
    set({ speedPoints: normalizeSpeedPoints(points), speedPreset: "custom" });
  },

  updateSpeedPoint: (index, patch) => {
    const points = get().speedPoints.slice();
    const current = points[index];
    if (!current) return;
    const next = {
      time: current.time,
      speed: clampSpeed(current.speed),
      ...patch,
    };
    next.speed = clampSpeed(next.speed);
    // Keep points ordered: a keyframe may not cross its neighbours.
    const lower = index > 0 ? points[index - 1].time + 0.001 : 0;
    const upper =
      index < points.length - 1
        ? points[index + 1].time - 0.001
        : Number.MAX_SAFE_INTEGER;
    next.time = Math.min(Math.max(next.time, lower), Math.max(lower, upper));
    points[index] = next;
    set({ speedPoints: points, speedPreset: "custom" });
  },

  removeSpeedPoint: (index) => {
    const points = get().speedPoints.filter((_, i) => i !== index);
    set({
      speedPoints: points.length > 0 ? points : [{ time: 0, speed: 1 }],
      speedPreset: "custom",
    });
  },

  addEffect: (type, atTime) => {
    const preset = EFFECT_DEFAULTS[type];
    const duration = get().duration;
    const startTime =
      duration > 0 ? Math.min(Math.max(0, atTime), Math.max(0, duration - 0.05)) : Math.max(0, atTime);
    const effect: VideoEffect = {
      id: createId("fx"),
      type,
      startTime,
      duration: preset.duration,
      intensity: preset.intensity,
    };
    set({ activeEffects: [...get().activeEffects, effect] });
  },

  updateEffect: (id, patch) =>
    set({
      activeEffects: get().activeEffects.map((effect) =>
        effect.id === id ? { ...effect, ...patch } : effect
      ),
    }),

  moveEffectTo: (id, startTime) => {
    const { activeEffects, duration } = get();
    set({
      activeEffects: activeEffects.map((effect) => {
        if (effect.id !== id) return effect;
        const upper =
          duration > 0
            ? Math.max(0, duration - effect.duration)
            : Number.MAX_SAFE_INTEGER;
        return { ...effect, startTime: Math.min(Math.max(startTime, 0), upper) };
      }),
    });
  },

  removeEffect: (id) =>
    set({
      activeEffects: get().activeEffects.filter((effect) => effect.id !== id),
    }),

  clearEffects: () => set({ activeEffects: [] }),

  setChromaKey: (patch) => {
    const next = { ...get().chromaKey, ...patch };
    set({ chromaKey: next });
    const id = get().activeClipId;
    if (id) {
      set({
        sequence: get().sequence.map((clip) =>
          clip.id === id ? { ...clip, chromaKey: next } : clip
        ),
      });
      persistProject(get());
    }
  },

  resetChromaKey: () => get().setChromaKey({ ...DEFAULT_CHROMA_KEY }),

  setEyedropper: (active) => set({ eyedropper: active }),

  addOverlayKeyframe: (overlayId) => {
    const id = overlayId ?? get().selectedId;
    if (!id) return;
    const overlay = get().overlays.find((item) => item.id === id);
    if (!overlay) return;
    const time = get().currentTime;
    const keyframe: OverlayKeyframe = {
      id: createId("kf"),
      time,
      scale: 1,
      x: overlay.x,
      y: overlay.y,
      opacity: overlay.opacity,
      rotation: overlay.rotation,
    };
    // Replace any existing keyframe at (nearly) the same time.
    const existing = (overlay.keyframes ?? []).filter(
      (frame) => Math.abs(frame.time - time) > 0.05
    );
    const keyframes = [...existing, keyframe].sort((a, b) => a.time - b.time);
    set({
      overlays: get().overlays.map((item) =>
        item.id === id ? { ...item, keyframes } : item
      ),
      selectedId: id,
    });
  },

  removeOverlayKeyframe: (overlayId, keyframeId) =>
    set({
      overlays: get().overlays.map((item) =>
        item.id === overlayId
          ? {
              ...item,
              keyframes: (item.keyframes ?? []).filter(
                (frame) => frame.id !== keyframeId
              ),
            }
          : item
      ),
    }),

  clearOverlayKeyframes: (overlayId) =>
    set({
      overlays: get().overlays.map((item) =>
        item.id === overlayId ? { ...item, keyframes: [] } : item
      ),
    }),

  applyCaptionPreset: (preset) => {
    const patches: Record<CaptionPreset, Partial<CaptionStyle>> = {
      classic: {
        preset: "classic",
        animation: "pop",
        activeWordHighlight: true,
        textStroke: true,
      },
      karaoke: {
        preset: "karaoke",
        animation: "karaoke",
        activeWordHighlight: true,
        textStroke: true,
        highlightColor: "#facc15",
      },
      bounce: {
        preset: "bounce",
        animation: "bounce",
        activeWordHighlight: true,
        textStroke: true,
      },
      neonBox: {
        preset: "neonBox",
        animation: "neon",
        activeWordHighlight: false,
        textStroke: false,
        highlightColor: "#22d3ee",
      },
    };
    set({ captionStyle: { ...get().captionStyle, ...patches[preset] } });
    // Give existing auto captions a matching box look.
    set({
      overlays: get().overlays.map((overlay) => {
        if (!overlay.auto) return overlay;
        if (preset === "neonBox") {
          return { ...overlay, bgColor: "#09090b", padding: 30, radius: 18 };
        }
        return { ...overlay, bgColor: "", padding: 0, radius: 0 };
      }),
    });
  },

  generateCaptionsFromScript: async (script) => {
    const trimmed = script.trim();
    if (!trimmed) {
      set({ transcriptionError: "Type or dictate a script first." });
      return;
    }
    const { buildScriptCaptions } = await import("@/lib/captions");
    const captions = buildScriptCaptions(trimmed, {
      duration: get().duration,
      aspect: get().aspect,
    });
    if (captions.length === 0) return;
    set({
      overlays: [...get().overlays.filter((overlay) => !overlay.auto), ...captions],
      selectedId: captions[0]?.id ?? get().selectedId,
      transcriptionError: null,
    });
  },

  addSoundEffect: async (id) => {
    const spec = SOUND_EFFECTS.find((effect) => effect.id === id);
    const rendered = await renderSoundEffect(id);
    if (!rendered) {
      set({ audioTrackError: "Sound effects are not supported in this browser." });
      return;
    }
    const mediaId = newMediaId();
    try {
      await saveMediaFile(mediaId, rendered.blob);
    } catch {
      // Storage can fail (quota / private mode); playback still works now.
    }
    const url = URL.createObjectURL(rendered.blob);
    const file = new File([rendered.blob], `${id}.wav`, { type: "audio/wav" });
    const track: AudioTrack = {
      id: createId("sfx"),
      mediaId,
      name: spec?.label ?? id,
      url,
      file,
      buffer: rendered.buffer,
      startTime: get().currentTime,
      volume: 1,
      trimStart: 0,
      duration: rendered.buffer.duration,
      muted: false,
      solo: false,
      fadeIn: 0.01,
      fadeOut: 0.12,
      synth: true,
    };
    set({ audioTracks: [...get().audioTracks, track], audioTrackError: null });
  },
  })),
);

/**
 * Auto-capture an undo snapshot whenever any editable field changes. The
 * selector shape mirrors {@link EditSnapshot}, so `previous` is exactly the
 * state to restore on undo.
 */
useEditorStore.subscribe(
  (state) => ({
    sequence: state.sequence,
    overlays: state.overlays,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    colorAdjustments: state.colorAdjustments,
    activeEffects: state.activeEffects,
    aspect: state.aspect,
    speedPoints: state.speedPoints,
    speedPreset: state.speedPreset,
    captionStyle: state.captionStyle,
    fit: state.fit,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    canvasFill: state.canvasFill,
    chromaKey: state.chromaKey,
  }),
  (_current, previous) => {
    if (historyPaused) return;
    useEditorStore.setState((state) => {
      const history = [...state.history, previous as EditSnapshot];
      if (history.length > 500) history.shift();
      return { history, future: [] };
    });
  },
  { equalityFn: shallow }
);

/**
 * Persist the project's media metadata whenever assets / sequence / overlays /
 * audio change. `projectId` is intentionally excluded so loading a project
 * (which sets `projectId` before the data arrives) can never wipe storage.
 */
useEditorStore.subscribe(
  (state) => ({
    assets: state.assets,
    sequence: state.sequence,
    overlays: state.overlays,
    audioTracks: state.audioTracks,
  }),
  () => {
    persistProject(useEditorStore.getState());
  },
  { equalityFn: shallow }
);
