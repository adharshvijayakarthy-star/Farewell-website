import { transitionState } from "@/lib/scene/sceneTransitions";
export default function ChapterTransition({
  progress,
  reduced,
}: {
  progress: number;
  reduced: boolean;
}) {
  const state = transitionState(progress);
  if (!state) return null;
  const { cue, intensity, before, phase } = state;
  return (
    <div
      className={`chapter-transition transition-${cue.kind} ${reduced ? "gentle" : ""}`}
      aria-hidden="true"
      style={
        {
          "--intensity": intensity,
          "--phase": phase,
          "--tint": cue.color,
          "--direction": before ? 1 : -1,
        } as React.CSSProperties
      }
    >
      {cue.kind === "page" ? (
        <div
          className="luminous-page"
          style={{
            transform: `translateX(${before ? 110 - phase * 110 : -phase * 115}%) rotateY(${before ? -phase * 8 : -phase * 30}deg)`,
          }}
        />
      ) : (
        <>
          <div
            className="warp-lines"
            style={{
              transform: `scale(${before ? 1 - intensity * 0.85 : 0.15 + (1 - intensity) * 3}) rotate(${intensity * 8}deg)`,
            }}
          />
          <div
            className="chapter-flash"
            style={{
              opacity: Math.pow(intensity, 10) * (reduced ? 0.16 : 0.7),
            }}
          />
          <div
            className="chapter-iris"
            style={{
              transform: `scale(${before ? 2.5 * (1 - intensity) + 0.03 : 0.03 + (1 - intensity) * 4})`,
              opacity: intensity * 0.8,
            }}
          />
        </>
      )}
    </div>
  );
}
