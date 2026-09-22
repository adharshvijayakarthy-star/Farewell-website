"use client";

import { useEffect, useRef, useState } from "react";

const INACTIVITY_DELAY_MS = 1_250;
const MEANINGFUL_SCROLL_DELTA = 3;
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

export default function ScrollInactivityOverlay({
  active,
}: {
  active: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!active) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setVisible(false);
      return;
    }

    lastScrollY.current = window.scrollY;

    const scheduleReminder = () => {
      if (timer.current) clearTimeout(timer.current);
      setVisible(false);
      timer.current = setTimeout(() => setVisible(true), INACTIVITY_DELAY_MS);
    };

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const delta = Math.abs(nextScrollY - lastScrollY.current);
      lastScrollY.current = nextScrollY;
      if (delta >= MEANINGFUL_SCROLL_DELTA) scheduleReminder();
    };

    const onWheel = (event: WheelEvent) => {
      if (
        Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) >=
        MEANINGFUL_SCROLL_DELTA
      )
        scheduleReminder();
    };

    const onPointerDown = () => scheduleReminder();
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) scheduleReminder();
    };

    scheduleReminder();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return (
    <div
      className={`scroll-reminder${visible ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      <div className="scroll-reminder__content">
        <span>KEEP SCROLLING</span>
      </div>
    </div>
  );
}
