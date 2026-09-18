import type { AudioConfig, SceneAudioConfig } from "./audioTypes";
import type { SceneId } from "../scene/sceneConfig";
/** SINGLE SOURCE OF TRUTH FOR MUSIC.
 * User-prepared clips copied byte-for-byte from All Songs. No cuts or edits.
 * fullClip uses the decoded duration; measured durations below aid planning.
 * File replacement only requires this configuration, never visual components.
 */
const clip = (
  sceneId: SceneId,
  file: string,
  duration: number,
  transitionStyle: SceneAudioConfig["transitionStyle"] = "fade-through",
): SceneAudioConfig => ({
  sceneId,
  file,
  enabled: true,
  fullClip: true,
  segmentStart: 0,
  segmentEnd: duration,
  loopStart: 0,
  loopEnd: duration,
  volume: 0.72,
  mobileVolumeAdjustment: 0.9,
  fadeIn: 0.3,
  fadeOut: 0.2,
  transitionDuration: 0.4,
  transitionStyle,
  resumeMode: "remember",
  preloadPriority: "metadata",
});

const intentionallyUnused = (sceneId: SceneId): SceneAudioConfig => ({
  sceneId,
  enabled: false,
  fullClip: true,
  file: "",
  segmentStart: 0,
  segmentEnd: 0,
  loopStart: 0,
  loopEnd: 0,
  volume: 0,
  fadeIn: 0,
  fadeOut: 0,
  transitionDuration: 0,
  mobileVolumeAdjustment: 1,
  preloadPriority: "none",
  resumeMode: "remember",
  transitionStyle: "hard-cut",
});

export const audioConfig: AudioConfig = {
  scene00: {
    ...clip("scene00", "/audio/song0.mp3", 16.056, "short"),
    preloadPriority: "auto",
  },
  scene01: clip("scene01", "/audio/song1.mp3", 16.056),
  scene02: clip("scene02", "/audio/song2.mp3", 27.048, "hard-cut"),
  // Song3 is intentionally unused; scene03 inherits scene02's Song2 chapter.
  scene03: intentionallyUnused("scene03"),
  // Song4 is intentionally unused; scene04 inherits scene05's Song5 chapter.
  scene04: intentionallyUnused("scene04"),
  scene05: clip("scene05", "/audio/song5.mp3", 16.056, "short"),
  scene06: clip("scene06", "/audio/song6.mp3", 18.048, "hard-cut"),
  // Song7 is intentionally unused; scene07 remains inside Song6.
  scene07: intentionallyUnused("scene07"),
  // Song8 is never played. Its old scene endpoint is the end of scene08.
  scene08: intentionallyUnused("scene08"),
  scene09: clip("scene09", "/audio/song9.mp3", 23.04),
};
export const playableAudioIds: SceneId[] = [
  "scene00",
  "scene01",
  "scene02",
  "scene05",
  "scene06",
  "scene09",
];
export const playableSongOrder = ["Song0", "Song1", "Song2", "Song5", "Song6", "Song9"] as const;
/** A short settle avoids auditioning intermediate clips during fast scrolling. */
export const AUDIO_SETTLE_MS = 110;
// The manager applies centralized crossfades at active soundtrack boundaries.
// These values continue to describe the prepared clips' entry, exit, and resume behavior.
