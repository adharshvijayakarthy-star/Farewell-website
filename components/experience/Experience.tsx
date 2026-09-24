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
import ScrollInactivityOverlay from "../ui/ScrollInactivityOverlay";
import { textCues } from "@/lib/scene/sceneTransitions";
const Canvas = dynamic(() => import("./ExperienceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="celestial-loading">✦ CELESTIAL ELEGANCE ✦</div>
  ),
});
const TERMINAL_SETTLE_MS = 1_600;

function Journey({ onRestart }: { onRestart: () => void }) {
  const audio = useAudio();
  const [entered, setEntered] = useState(false),
    [trollComplete, setTrollComplete] = useState(false),
    [entering, setEntering] = useState(false),
    [fallback, setFallback] = useState(false),
    [reduced, setReduced] = useState(false),
    [paused, setPaused] = useState(false),
    [debug, setDebug] = useState(false),
    [terminalSettled, setTerminalSettled] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { current, progress, activeScene } = useExperienceProgress(
    entered,
    paused,
    reduced,
  );
  const isFinale = entered && progress >= textCues.goodbye.start;
  const isTerminalStarfield = entered && progress >= 0.999;
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
    // Troll is the first application state. The first real gesture unlocks
    // the pending Song0 channel without leaving an autoplay resume pending.
    audio.enterScene("scene00");
  }, [audio]);
  useEffect(() => {
    document.body.style.overflow =
      (entered || fallback) && !paused ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [entered, fallback, paused]);
  useEffect(() => {
    // Scroll-driven chapters only after the visitor enters the journey.
    if (!entered) return;
    if (isTerminalStarfield) audio.beginFinale();
    else audio.exitFinale();
    audio.enterScene(activeScene);
  }, [audio, activeScene, entered, isTerminalStarfield]);
  useEffect(() => {
    if (!isTerminalStarfield) {
      setTerminalSettled(false);
      return;
    }
    // Song9 holds for one second, then fades over 2.5 seconds. Let the
    // terminal image settle briefly before revealing the restart control.
    const timer = setTimeout(() => setTerminalSettled(true), TERMINAL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isTerminalStarfield]);
  // Scene-state music handoff: Troll morph → real ticket / Scene 01 → Song1.
  // Must NOT be tied to the main ticket click.
  const handoffToScene01 = useCallback(() => {
    audio.enterScene("scene01");
  }, [audio]);
  const completeTroll = useCallback(() => {
    audio.enterScene("scene01");
    setTrollComplete(true);
  }, [audio]);
  function enter() {
    if (entering || entered) return;
    setEntering(true);
    // Visual/scroll entry only. Song1 is already active from the Troll handoff.
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
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    audio.restartFromOpening();
    window.scrollTo(0, 0);
    onRestart();
  }
  if (fallback) return <StaticInvitation />;
  if (!trollComplete)
    return (
      <TrollOpening
        onMusicHandoff={handoffToScene01}
        onComplete={completeTroll}
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
        <ScrollInactivityOverlay active={entered && !isFinale} />
        {!entered && <Ticket entering={entering} onEnter={enter} fromMorph />}
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
        {terminalSettled && (
          <button
            type="button"
            className="start-over-button"
            onClick={restart}
            aria-label="Start the experience over from the beginning"
          >
            START OVER
          </button>
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
  const [session, setSession] = useState(0);
  const restartSession = useCallback(() => setSession((current) => current + 1), []);

  return (
    <AudioManagerProvider>
      <Journey key={session} onRestart={restartSession} />
    </AudioManagerProvider>
  );
}
