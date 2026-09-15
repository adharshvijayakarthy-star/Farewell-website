import type { SceneAudioConfig } from "./audioTypes";
export const gain = (v: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
export function validateAudioConfig(c: SceneAudioConfig): string | null {
  if (!c.enabled) return null;
  if (!c.file.trim()) return "Enabled scene has no file";
  if (
    ![
      c.segmentStart,
      c.segmentEnd,
      c.loopStart,
      c.loopEnd,
      c.volume,
      c.fadeIn,
      c.fadeOut,
      c.transitionDuration,
      c.startOffset ?? 0,
      c.mobileVolumeAdjustment ?? 1,
      c.bpm ?? 1,
      c.beatOffset ?? 0,
    ].every(Number.isFinite)
  )
    return "All timings and gains must be finite";
  if (c.segmentStart < 0 || c.segmentStart >= c.segmentEnd)
    return "Invalid segment";
  if (
    c.loopStart < c.segmentStart ||
    c.loopEnd > c.segmentEnd ||
    c.loopStart >= c.loopEnd
  )
    return "Loop must be inside segment";
  if (
    c.volume < 0 ||
    c.volume > 1 ||
    c.fadeIn < 0 ||
    c.fadeOut < 0 ||
    c.transitionDuration < 0 ||
    (c.startOffset ?? 0) < 0 ||
    (c.startOffset ?? 0) >= c.segmentEnd - c.segmentStart ||
    (c.mobileVolumeAdjustment ?? 1) < 0
  )
    return "Invalid volume, offset or fade";
  return null;
}
export function calculateLoopPosition(
  time: number,
  c: SceneAudioConfig,
  looped = false,
) {
  const end = looped ? c.loopEnd : c.segmentEnd;
  return time >= end
    ? c.loopStart + ((time - end) % (c.loopEnd - c.loopStart))
    : Math.max(c.segmentStart, time);
}
export function getSceneStartPosition(c: SceneAudioConfig, saved?: number) {
  return c.resumeMode === "remember" && saved !== undefined
    ? Math.max(c.segmentStart, Math.min(c.segmentEnd - 0.001, saved))
    : c.segmentStart + (c.startOffset ?? 0);
}
