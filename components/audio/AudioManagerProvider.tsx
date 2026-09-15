"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { AudioManager } from "@/lib/audio/audioManager";
const Context = createContext<AudioManager | null>(null);
export function AudioManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [manager] = useState(() => new AudioManager());
  useEffect(() => {
    manager.init();
    const onVisibility = () => {
      if (document.hidden) manager.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      manager.destroy();
    };
  }, [manager]);
  return <Context.Provider value={manager}>{children}</Context.Provider>;
}
export function useAudio() {
  const audio = useContext(Context);
  if (!audio) throw new Error("Audio provider missing");
  return audio;
}
