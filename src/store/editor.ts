import { create } from "zustand";
import {
  loadProjectMedia,
  loadVideoSource,
  saveProjectMedia,
  saveVideoSource,
  type TimelineClip,
  type VideoAsset,
} from "@/lib/video-storage";
import type { CaptionLanguageId } from "@/lib/transcribe";

export type AspectRatio = "9:16" | "16:9" | "1:1";
export type VideoFit = "contain" | "cover";
export type OverlayAlign = "left" | "center" | "right";

/** A single spoken word with its timing (seconds from the start of the video). */
export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

/** How AI-generated words animate as they are spoken. */
export type CaptionAnimation = "none" | "pop" | "bounce" | "karaoke";

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
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  activeWordHighlight: true,
  textStroke: true,
  animation: "pop",
  highlightColor: "#facc15",
};

/** Default frame rate used for frame-stepping and export. */
export const DEFAULT_FPS = 30;

/** Colour-grading controls applied to the video frame before overlays. */
export type ColorAdjustments = {
  /** -100..100 (%) */
  brightness: number;
  /** -100..100 (%) */
  contrast: number;
  /** -100..100 (%) */
  saturation: number;
  /** -180..180 (degrees) — a.k.a. temperature tilt. */
  hue: number;
  /** 0..20 (px) */
  blur: number;
};

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
};

/**
 * An external audio track / sound effect layered on top of the video.
 * Times are in seconds on the master timeline.
 */
export type AudioTrack = {
  id: string;
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
};

/** A keyframe on the speed (velocity) curve. `time` is in source-video seconds. */
export type SpeedPoint = {
  time: number;
  speed: number;
};

export const MIN_SPEED = 0.2;
export const MAX_SPEED = 5;

/** Named velocity presets, plus `custom` once the user edits the curve. */
export type SpeedPreset = "none" | "montage" | "hero" | "bullet" | "custom";

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
const PRESET_SHAPES: Record<"montage" | "hero" | "bullet", SpeedPoint[]> = {
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
    startTime: 0,
    // Default to the first five seconds, or the whole clip when shorter.
    endTime: duration > 0 ? Math.min(5, duration) : 5,
  };
}

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

  loadVideo: (file: File) => void;
  /** Applies raw video bytes (e.g. restored from IndexedDB) to the editor. */
  loadVideoBlob: (blob: Blob, name: string) => void;
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
  /** Removes a clip from the sequence. */
  removeClip: (clipId: string) => void;
  /** Reorders a clip up (-1) or down (+1). */
  moveClip: (clipId: string, direction: -1 | 1) => void;
  /** Updates a clip's trim range. */
  setClipTrim: (
    clipId: string,
    patch: { trimStart?: number; trimEnd?: number }
  ) => void;
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
  setFit: (fit: VideoFit) => void;
  setOffset: (x: number, y: number) => void;
  addOverlay: () => void;
  updateOverlay: (id: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  setOverlayStartTime: (id: string, time: number) => void;
  setOverlayEndTime: (id: string, time: number) => void;
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
  updateAudioTrack: (id: string, patch: Partial<Omit<AudioTrack, "id">>) => void;
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
  removeEffect: (id: string) => void;
  clearEffects: () => void;
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

/** Persists a project's media library + sequence (best-effort). */
function persistProjectMedia(
  projectId: string | null,
  assets: VideoAsset[],
  sequence: TimelineClip[]
): void {
  if (!projectId) return;
  void saveProjectMedia(projectId, { assets, sequence }).catch(() => {
    // IndexedDB can fail (quota / private mode); the session still works.
  });
}

export const useEditorStore = create<EditorState>((set, get) => ({
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

  overlays: [],
  selectedId: null,

  captionStyle: DEFAULT_CAPTION_STYLE,
  transcribing: false,
  transcribingProgress: 0,
  transcribingStatus: "",
  transcriptionError: null,

  fps: DEFAULT_FPS,
  colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
  audioTracks: [],
  audioTrackError: null,

  speedPreset: "none",
  speedPoints: [{ time: 0, speed: 1 }],
  activeEffects: [],

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

  loadVideoBlob: (blob, name) => {
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
      set({
        duration: value,
        trimStart,
        trimEnd,
        currentTime: 0,
        pendingTrim: null,
        overlays: clampOverlaysToDuration(get().overlays, value),
        speedPoints,
      });
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
      set({ playing: false, currentTime: el.currentTime });
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
      set({
        assets: media.assets,
        sequence: media.sequence,
        assetsLoading: false,
      });

      const firstClip = media.sequence[0];
      const asset = firstClip
        ? media.assets.find((item) => item.id === firstClip.assetId)
        : undefined;
      if (firstClip && asset) {
        set({
          activeClipId: firstClip.id,
          pendingTrim: {
            trimStart: firstClip.trimStart,
            trimEnd: firstClip.trimEnd,
          },
        });
        get().loadVideoBlob(asset.blob, asset.name);
        return;
      }
      if (media.assets.length === 0) set({ videoMissing: true });
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
      const asset: VideoAsset = {
        id: createId("asset"),
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
    persistProjectMedia(get().projectId, assets, sequence);

    const firstClip = newClips[0];
    const firstAsset = assets.find((asset) => asset.id === firstClip.assetId);
    if (firstAsset) {
      set({ activeClipId: firstClip.id, pendingTrim: null });
      get().loadVideoBlob(firstAsset.blob, firstAsset.name);
    }
  },

  removeAsset: (assetId) => {
    const assets = get().assets.filter((asset) => asset.id !== assetId);
    const sequence = get().sequence.filter((clip) => clip.assetId !== assetId);
    set({ assets, sequence });
    persistProjectMedia(get().projectId, assets, sequence);

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
    });
    get().loadVideoBlob(asset.blob, asset.name);
  },

  removeClip: (clipId) => {
    const sequence = get().sequence.filter((clip) => clip.id !== clipId);
    set({ sequence });
    persistProjectMedia(get().projectId, get().assets, sequence);

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
    persistProjectMedia(get().projectId, get().assets, sequence);
  },

  setClipTrim: (clipId, patch) => {
    const sequence = get().sequence.map((clip) =>
      clip.id === clipId ? { ...clip, ...patch } : clip
    );
    set({ sequence });
    persistProjectMedia(get().projectId, get().assets, sequence);
  },

  resetEditor: () => {
    const { videoEl, videoUrl, audioTracks } = get();
    releaseVideo(videoEl, videoUrl);
    for (const track of audioTracks) URL.revokeObjectURL(track.url);

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
      overlays: [],
      selectedId: null,
      captionStyle: DEFAULT_CAPTION_STYLE,
      transcribing: false,
      transcribingProgress: 0,
      transcribingStatus: "",
      transcriptionError: null,
      fps: DEFAULT_FPS,
      colorAdjustments: DEFAULT_COLOR_ADJUSTMENTS,
      audioTracks: [],
      audioTrackError: null,
      speedPreset: "none",
      speedPoints: [{ time: 0, speed: 1 }],
      activeEffects: [],
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
    const { trimEnd, duration } = get();
    const max = Math.max(0, Math.min(trimEnd - 0.1, duration || trimEnd));
    set({ trimStart: Math.min(Math.max(time, 0), max) });
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimStart: get().trimStart });
  },

  setTrimEnd: (time) => {
    const { trimStart, duration } = get();
    if (duration <= 0) return;
    const min = Math.min(Math.max(trimStart + 0.1, 0), duration);
    set({ trimEnd: Math.max(Math.min(time, duration), min) });
    const id = get().activeClipId;
    if (id) get().setClipTrim(id, { trimEnd: get().trimEnd });
  },

  resetTrim: () => {
    const { duration } = get();
    set({ trimStart: 0, trimEnd: duration });
  },

  setAspect: (aspect) => set({ aspect }),

  setFit: (fit) => set({ fit, offsetX: fit === "contain" ? 0 : get().offsetX, offsetY: fit === "contain" ? 0 : get().offsetY }),

  setOffset: (x, y) =>
    set({
      offsetX: Math.min(Math.max(x, -100), 100),
      offsetY: Math.min(Math.max(y, -100), 100),
    }),

  addOverlay: () => {
    const overlay = createOverlay(get().duration);
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
        const url = URL.createObjectURL(file);
        const decoded = await decodeAudioFile(file);
        const track: AudioTrack = {
          id: createId("audio"),
          name: file.name,
          url,
          file,
          buffer: decoded?.buffer ?? null,
          startTime: 0,
          volume: 1,
          trimStart: 0,
          duration: decoded?.duration ?? 0,
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
        return next;
      }),
    }),

  removeAudioTrack: (id) => {
    const track = get().audioTracks.find((item) => item.id === id);
    if (track) URL.revokeObjectURL(track.url);
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

  removeEffect: (id) =>
    set({
      activeEffects: get().activeEffects.filter((effect) => effect.id !== id),
    }),

  clearEffects: () => set({ activeEffects: [] }),
}));
