import { clamp, smooth } from "./sceneTimeline";
/** Three chapter punctuation marks. Every intermediate stage is scroll-reversible. */
export const majorTransitions = [
  {
    id: "cosmos-disco",
    start: 0.158,
    climax: 0.18,
    end: 0.201,
    kind: "warp",
    color: "#cfa8ff",
  },
  {
    id: "memories-details",
    start: 0.649,
    climax: 0.67,
    end: 0.69,
    kind: "collapse",
    color: "#f4cf9d",
  },
  {
    id: "page-dawn",
    start: 0.829,
    climax: 0.855,
    end: 0.876,
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
  title: { start: 0.065, end: 0.173 },
  beneath: { start: 0.354, end: 0.402 },
  farewell: { start: 0.418, end: 0.533 },
  promises: [
    { start: 0.545, end: 0.58 },
    { start: 0.582, end: 0.617 },
    { start: 0.619, end: 0.654 },
  ],
  details: { start: 0.683, end: 0.762 },
  quote: { start: 0.782, end: 0.837 },
  dawn: { start: 0.873, end: 0.92 },
  love: { start: 0.922, end: 0.956 },
  goodbye: { start: 0.96, end: 0.99 },
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
