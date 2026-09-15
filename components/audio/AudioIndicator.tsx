"use client";
import { useSyncExternalStore } from "react";
import { useAudio } from "./AudioManagerProvider";
export function AudioIndicator() {
  const audio = useAudio();
  const playing = useSyncExternalStore(
    audio.subscribe,
    () => audio.playing,
    () => false,
  );
  const available = useSyncExternalStore(
    audio.subscribe,
    () => audio.available && audio.ready,
    () => false,
  );
  if (!available) return null;
  return (
    <button
      className="audio-indicator"
      aria-label={playing ? "Pause music" : "Resume music"}
      aria-pressed={playing}
      onClick={() => (playing ? audio.pause() : audio.resume())}
    >
      {playing ? "Ⅱ" : "♪"}
    </button>
  );
}
