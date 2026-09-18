import { clamp, smooth } from "./sceneTimeline";
/** Three chapter punctuation marks. Every intermediate stage is scroll-reversible. */
export const majorTransitions = [
  {
    id: "awakening-disco",
    start: 0.156,
    climax: 0.18,
    end: 0.208,
    kind: "warp",
    color: "#cfa8ff",
  },
  {
    id: "disco-farewell",
    start: 0.386,
    climax: 0.41,
    end: 0.438,
    kind: "collapse",
    color: "#f4cf9d",
  },
  {
    id: "last-light-dawn",
    start: 0.934,
    climax: 0.955,
    end: 0.982,
    kind: "page",
    color: "#f8dec1",
  },
] as const;
export function transitionState(progress: number) {
  const cue = majorTransitions.find(
    (t) => progress >= t.start && progress <= t.end,
  );
  if (!cue) return null;
  const before = progress < cue.climax;
  const phase = before
    ? clamp((progress - cue.start) / (cue.climax - cue.start))
    : clamp((progress - cue.climax) / (cue.end - cue.climax));
  return {
    cue,
    before,
    phase,
    intensity: before ? smooth(phase) : 1 - smooth(phase),
  };
}
/** Typed text cues: small entrance, long settlement/reading hold, prepared exit. */
export const textCues = {
  // Begin just before the first post-ticket scroll position so the hero has
  // settled in when the user enters the experience.
  title: { start: 0.05, end: 0.174 },
  beneath: { start: 0.248, end: 0.397 },
  farewell: { start: 0.421, end: 0.526 },
  promises: [
    { start: 0.535, end: 0.577 },
    { start: 0.584, end: 0.626 },
    { start: 0.633, end: 0.668 },
  ],
  details: { start: 0.685, end: 0.758 },
  quote: { start: 0.775, end: 0.828 },
  love: { start: 0.842, end: 0.927 },
  dawn: { start: 0.949, end: 0.978 },
  goodbye: { start: 0.974, end: 0.999 },
};
export function textPhase(
  progress: number,
  cue: { start: number; end: number },
) {
  const t = clamp((progress - cue.start) / (cue.end - cue.start));
  const entrance = smooth(t / 0.18),
    exit = smooth((t - 0.88) / 0.12);
  return {
    t,
    entrance,
    exit,
    visible: progress >= cue.start && progress <= cue.end,
    opacity: entrance * (1 - exit),
  };
}
