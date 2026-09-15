import type { SceneId } from "../scene/sceneConfig";
export interface SceneAudioConfig {
  sceneId: SceneId;
  /** False disables all fetching and playback for this scene. */
  enabled: boolean;
  /** Use the whole decoded file, overriding excerpt and loop boundaries. */
  fullClip?: boolean;
  /** Public URL, normally /audio/name.webm. Only this config names tracks. */
  file: string;
  /** Optional alternative when the browser cannot play the primary format. */
  fallbackFile?: string;
  /** Absolute seconds in the source file; entry/exit limits of the selected excerpt. */
  segmentStart: number;
  segmentEnd: number;
  /** Absolute seconds within the segment. Entry plays to segmentEnd once, then loops this body. */
  loopStart: number;
  loopEnd: number;
  /** Linear gain 0–1, multiplied by master volume. */
  volume: number;
  /** Seconds; transitionDuration caps the fade lengths at scene boundaries. */
  fadeIn: number;
  fadeOut: number;
  transitionDuration: number;
  /** Seconds added to segmentStart on the first visit only. */
  startOffset?: number;
  /** Optional metadata; visual timing never depends on music. */
  bpm?: number;
  beatOffset?: number;
  /** Multiplicative mobile gain and optional mobile source URL. */
  mobileVolumeAdjustment?: number;
  mobileFile?: string;
  preloadPriority: "none" | "metadata" | "auto";
  resumeMode: "remember" | "restart";
  transitionStyle: "crossfade" | "fade-through" | "hard-cut" | "short";
}
export type AudioConfig = Record<SceneId, SceneAudioConfig>;
