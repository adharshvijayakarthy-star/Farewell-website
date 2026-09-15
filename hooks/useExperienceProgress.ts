import { useEffect, useRef, useState } from "react";
import { scrollToProgress, sceneAt } from "@/lib/scene/sceneTimeline";
import type { SceneId } from "@/lib/scene/sceneConfig";
/** Native scroll controls a single smoothed, reversible timeline. Audio gets the destination ID. */
export function useExperienceProgress(
  entered: boolean,
  paused: boolean,
  reduced: boolean,
) {
  const current = useRef(0),
    destination = useRef(0);
  const [progress, setProgress] = useState(0);
  const [activeScene, setActiveScene] = useState<SceneId>("scene00");
  useEffect(() => {
    if (!entered) {
      current.current = destination.current = 0;
      setProgress(0);
      setActiveScene("scene00");
      return;
    }
    let frame = 0;
    let previous = performance.now();
    const read = () => {
      destination.current = scrollToProgress(
        window.scrollY /
          Math.max(1, document.documentElement.scrollHeight - innerHeight),
      );
      setActiveScene(sceneAt(destination.current).audioId);
    };
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (!paused) {
        const difference = destination.current - current.current;
        current.current =
          Math.abs(difference) < 0.00002
            ? destination.current
            : current.current +
              difference * (1 - Math.exp(-dt * (reduced ? 16 : 11)));
        setProgress(current.current);
      }
      frame = requestAnimationFrame(tick);
    };
    read();
    if (current.current === 0) current.current = 0.065;
    frame = requestAnimationFrame(tick);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [entered, paused, reduced]);
  return { current, progress, activeScene };
}
