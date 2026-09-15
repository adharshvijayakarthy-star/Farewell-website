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
export const audioConfig: AudioConfig = {
  scene00: clip("scene00", "/audio/Song0.Mp3", 16.056, "short"),
  scene01: clip("scene01", "/audio/Song1.Mp3", 16.056),
  scene02: clip("scene02", "/audio/Song2.Mp3", 27.048, "hard-cut"),
  scene03: clip("scene03", "/audio/Song3.Mp3", 15.048),
  scene04: clip("scene04", "/audio/Song4.Mp3", 31.056),
  scene05: clip("scene05", "/audio/Song5.Mp3", 16.056, "short"),
  scene06: clip("scene06", "/audio/Song6.Mp3", 18.048, "hard-cut"),
  scene07: clip("scene07", "/audio/Song7.Mp3", 31.056),
  scene08: clip("scene08", "/audio/Song8.Mp3", 25.056, "hard-cut"),
  scene09: clip("scene09", "/audio/Song9.Mp3", 23.04),
};
/** A short settle avoids auditioning intermediate clips during fast scrolling. */
export const AUDIO_SETTLE_MS = 110;
// Production uses sequential fades or cuts: only one clip plays at a time.
// Crossfade is supported for future use but deliberately not selected here.
