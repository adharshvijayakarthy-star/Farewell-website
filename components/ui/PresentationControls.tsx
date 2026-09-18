import { useEffect, useRef, useState } from "react";
import { scenes } from "@/lib/scene/sceneConfig";
import { progressToScroll, sceneAt } from "@/lib/scene/sceneTimeline";
import { useAudio } from "../audio/AudioManagerProvider";
export default function PresentationControls({
  progress,
  paused,
  reduced,
  onRestart,
  onEnter,
  onPause,
  onReduced,
  onFallback,
}: {
  progress: number;
  paused: boolean;
  reduced: boolean;
  onRestart: () => void;
  onEnter: () => void;
  onPause: () => void;
  onReduced: () => void;
  onFallback: () => void;
}) {
  const audio = useAudio();
  const [stats, setStats] = useState(false);
  const output = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (output.current) {
        const id = sceneAt(Math.max(progress, scenes[1].startProgress)).audioId;
        output.current.textContent = `${id} · ${audio.getScenePosition(id).toFixed(2)}s · ${audio.playing ? "playing" : "paused"}`;
      }
    }, 150);
    return () => clearInterval(timer);
  }, [audio, progress]);
  return (
    <aside className="dev-controls">
      <button onClick={onRestart}>Restart</button>
      <select
        aria-label="Jump to scene"
        value={sceneAt(progress).id}
        onChange={(e) => {
          const scene = scenes.find((s) => s.id === e.target.value)!;
          if (scene.id === "scene00") {
            onRestart();
            return;
          }
          onEnter();
          requestAnimationFrame(() =>
            window.scrollTo(
              0,
              progressToScroll(
                scene.startProgress +
                  (scene.endProgress - scene.startProgress) * 0.35,
              ) *
                (document.documentElement.scrollHeight - innerHeight),
            ),
          );
        }}
      >
        {scenes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button onClick={onPause}>{paused ? "Resume" : "Pause"}</button>
      <button onClick={() => setStats(!stats)}>Stats</button>
      <button aria-pressed={reduced} onClick={onReduced}>
        Reduce motion
      </button>
      <button onClick={onFallback}>Static fallback</button>
      {stats && (
        <output>
          {Math.round(progress * 100)}%<br />
          <span id="render-stats" />
          <br />
          <span ref={output} />
        </output>
      )}
    </aside>
  );
}
