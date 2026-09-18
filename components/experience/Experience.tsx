"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Ticket from "./Ticket";
import { AudioManagerProvider, useAudio } from "../audio/AudioManagerProvider";
import { AudioIndicator } from "../audio/AudioIndicator";
import { SCROLL_SCREENS, progressToScroll } from "@/lib/scene/sceneTimeline";
import { useExperienceProgress } from "@/hooks/useExperienceProgress";
import SceneCopy from "../ui/SceneCopy";
import ChapterTransition from "../ui/ChapterTransition";
import PresentationControls from "../ui/PresentationControls";
import StaticInvitation from "../ui/StaticInvitation";
import TrollOpening from "../ui/TrollOpening";
const Canvas = dynamic(() => import("./ExperienceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="celestial-loading">✦ CELESTIAL ELEGANCE ✦</div>
  ),
});
function Journey() {
  const audio = useAudio();
  const [entered, setEntered] = useState(false),
    [trollComplete, setTrollComplete] = useState(false),
    [entering, setEntering] = useState(false),
    [fallback, setFallback] = useState(false),
    [reduced, setReduced] = useState(false),
    [paused, setPaused] = useState(false),
    [debug, setDebug] = useState(false);
  const finished = useRef(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { current, progress, activeScene } = useExperienceProgress(
    entered,
    paused,
    reduced,
  );
  const fail = useCallback(() => setFallback(true), []);
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    setDebug(
      process.env.NODE_ENV === "development" &&
        new URLSearchParams(location.search).has("present"),
    );
    return () => {
      media.removeEventListener("change", change);
      if (enterTimer.current) clearTimeout(enterTimer.current);
    };
  }, []);
  useEffect(() => {
    audio.enterScene("scene00");
    void audio.unlock();
  }, [audio]);
  useEffect(() => {
    document.body.style.overflow =
      (entered || fallback) && !paused ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [entered, fallback, paused]);
  useEffect(() => {
    if (entered) audio.enterScene(activeScene);
  }, [audio, activeScene, entered]);
  useEffect(() => {
    if (progress >= 0.9995 && !finished.current) {
      finished.current = true;
      audio.pause();
    } else if (progress < 0.998 && finished.current) {
      finished.current = false;
      audio.resume();
    }
  }, [audio, progress]);
  function enter() {
    if (entering || entered) return;
    setEntering(true);
    audio.enterScene("scene01");
    void audio.unlock();
    enterTimer.current = setTimeout(
      () => {
        setEntered(true);
        setEntering(false);
        document.getElementById("journey")?.focus();
      },
      reduced ? 100 : 2400,
    );
  }
  function restart() {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    audio.pause();
    setPaused(false);
    setEntering(false);
    setEntered(false);
    window.scrollTo(0, 0);
  }
  if (fallback) return <StaticInvitation />;
  if (!trollComplete)
    return (
      <TrollOpening
        onMusicHandoff={() => audio.enterScene("scene01")}
        onComplete={() => setTrollComplete(true)}
      />
    );
  return (
    <main
      id="journey"
      tabIndex={-1}
      className={`${entered ? "is-entered" : ""} ${reduced ? "reduced-motion" : ""}`}
      style={{ height: entered ? `${SCROLL_SCREENS * 100}svh` : "100svh" }}
    >
      <div className="experience-fixed">
        <Canvas
          progress={current}
          reduced={reduced}
          paused={paused}
          onError={fail}
        />
        <div className="film-grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        {!entered && <Ticket entering={entering} onEnter={enter} />}
        <SceneCopy progress={progress} entered={entered} />
        <ChapterTransition progress={progress} reduced={reduced} />
        {entered && progress < 0.115 && (
          <span className="scroll-hint">Scroll to explore</span>
        )}
        {progress < 0.99 && (
          <div className="edge-mark" aria-hidden="true">
            ✦
          </div>
        )}
        {entered && progress < 0.998 && (
          <div className="journey-progress" aria-hidden="true">
            <i style={{ transform: `scaleX(${progressToScroll(progress)})` }} />
          </div>
        )}
        {progress < 0.998 && <AudioIndicator />}
        {debug && (
          <PresentationControls
            progress={progress}
            paused={paused}
            reduced={reduced}
            onRestart={restart}
            onEnter={() => setEntered(true)}
            onPause={() => {
              setPaused(!paused);
              if (!paused) audio.pause();
              else audio.resume();
            }}
            onReduced={() => setReduced(!reduced)}
            onFallback={fail}
          />
        )}
      </div>
    </main>
  );
}
export default function Experience() {
  return (
    <AudioManagerProvider>
      <Journey />
    </AudioManagerProvider>
  );
}
