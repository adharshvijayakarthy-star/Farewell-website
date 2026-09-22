"use client";
import { useRef } from "react";
export default function Ticket({
  onEnter,
  entering,
  fromMorph = false,
}: {
  onEnter: () => void;
  entering: boolean;
  /** Continues the Troll morph — avoids a hard opacity swap into the live ticket. */
  fromMorph?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={`ticket-stage ${entering ? "entering" : ""} ${fromMorph ? "from-morph" : ""}`}
    >
      <div className="ticket-orbit" aria-hidden="true" />
      <button
        ref={ref}
        className="ticket"
        onClick={onEnter}
        aria-label="Enter DISCO TILL DAWN"
        onPointerMove={(e) => {
          if (!ref.current) return;
          const b = ref.current.getBoundingClientRect();
          ref.current.style.setProperty(
            "--rx",
            `${-(e.clientY - b.top - b.height / 2) / 30}deg`,
          );
          ref.current.style.setProperty(
            "--ry",
            `${(e.clientX - b.left - b.width / 2) / 35}deg`,
          );
        }}
        onPointerLeave={() => {
          ref.current?.style.setProperty("--rx", "0deg");
          ref.current?.style.setProperty("--ry", "0deg");
        }}
      >
        <span className="ticket-main">
          <span className="ticket-brand">✦ DISCO TILL DAWN ✦</span>
          <span className="ticket-emblem" aria-hidden="true">
            ✧
          </span>
          <span className="ticket-title">
            CELESTIAL
            <br />
            <em>ELEGANCE</em>
          </span>
          <span className="ticket-bottom">
            <span>14 · 11 · 26</span>
            <span>CLASS OF 2026</span>
          </span>
        </span>
        <span className="ticket-stub" aria-hidden="true">
          <span>✦</span>
          <span className="stub-type">DISCO TILL DAWN</span>
          <span className="barcode" />
          <span>2026</span>
        </span>
      </button>
      <span className="ticket-hint">Tap the ticket to enter</span>
    </div>
  );
}
