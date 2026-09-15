import { scenes } from "./sceneConfig";
export const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));
export const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
export function sceneAt(progress: number) {
  return scenes.find((s) => progress < s.endProgress) ?? scenes[9];
}
export function localProgress(progress: number, index: number) {
  const s = scenes[index];
  return clamp(
    (progress - s.startProgress) / (s.endProgress - s.startProgress),
  );
}
export function presence(
  progress: number,
  start: number,
  end: number,
  fade = 0.018,
) {
  return (
    smooth((progress - start) / fade) *
    (1 - smooth((progress - end + fade) / fade))
  );
}
/** Native scroll is the timeline: one reversible normalized value, no queued scene events. */
export const SCROLL_SCREENS = 25;
const journey = scenes.slice(1);
const totalWeight = journey.reduce((sum, s) => sum + s.explorationSeconds, 0);
/** Re-weights native scroll without changing the existing art direction or scene coordinates. */
export function scrollToProgress(fraction: number) {
  let weight = clamp(fraction) * totalWeight;
  for (const s of journey) {
    if (weight <= s.explorationSeconds)
      return (
        s.startProgress +
        ((s.endProgress - s.startProgress) * weight) / s.explorationSeconds
      );
    weight -= s.explorationSeconds;
  }
  return 1;
}
export function progressToScroll(progress: number) {
  let before = 0;
  for (const s of journey) {
    if (progress <= s.endProgress)
      return clamp(
        (before +
          s.explorationSeconds *
            clamp(
              (progress - s.startProgress) / (s.endProgress - s.startProgress),
            )) /
          totalWeight,
      );
    before += s.explorationSeconds;
  }
  return 1;
}
