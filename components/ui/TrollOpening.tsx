"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type Stage =
  | "date"
  | "time"
  | "venue"
  | "title"
  | "class"
  | "see-you"
  | "pause"
  | "thats-it"
  | "troll"
  | "dissolve"
  | "morph";

const TIMING: Record<Stage, number> = {
  date: 0,
  time: 1_400,
  venue: 2_900,
  title: 4_600,
  class: 6_300,
  "see-you": 8_100,
  pause: 9_100,
  "thats-it": 9_850,
  troll: 10_900,
  dissolve: Number.POSITIVE_INFINITY,
  morph: Number.POSITIVE_INFINITY,
};

function fontSizeFor(text: string) {
  const length = text.length;
  if (length <= 15) return "clamp(2.6rem, 7.5vw, 6.5rem)";
  if (length <= 22) return "clamp(2.2rem, 6vw, 5rem)";
  if (length <= 30) return "clamp(1.75rem, 4.8vw, 3.8rem)";
  if (length <= 38) return "clamp(1.4rem, 3.8vw, 3rem)";
  return "clamp(1.05rem, 3vw, 2.35rem)";
}

function InvitationLine({
  text,
  speed = 55,
  dissolving = false,
  className = "",
  fontSize,
}: {
  text: string;
  speed?: number;
  dissolving?: boolean;
  className?: string;
  fontSize?: string;
}) {
  const [displayed, setDisplayed] = useState("");
  const index = useRef(0);

  useEffect(() => {
    setDisplayed("");
    index.current = 0;
    const timer = setInterval(() => {
      index.current += 1;
      setDisplayed(text.slice(0, index.current));
      if (index.current >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [speed, text]);

  const style: CSSProperties = {
    fontSize: fontSize ?? fontSizeFor(text),
    fontFamily: "var(--troll-serif)",
    fontWeight: 600,
    letterSpacing: "0.12em",
  };

  return (
    <div className={`troll-line-wrap ${className}`}>
      <div className="troll-fog troll-fog-left" aria-hidden="true" />
      <div className="troll-fog troll-fog-right" aria-hidden="true" />
      <div className="troll-fog troll-fog-floor" aria-hidden="true" />
      <div className={`troll-line ${dissolving ? "troll-dissolve" : ""}`} style={style}>
        {displayed}
      </div>
      <div className="troll-reflection" aria-hidden="true" style={{ ...style, marginTop: 3 }}>
        {displayed}
      </div>
    </div>
  );
}

type Particle = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  alpha: number;
};

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function drawTicketPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function MorphCanvas({
  active,
  onMusicHandoff,
  onComplete,
}: {
  active: boolean;
  onMusicHandoff: () => void;
  onComplete: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<number>(0);
  const handedOff = useRef(false);
  const completed = useRef(false);
  const duration = 3_200;

  useEffect(() => {
    if (!active || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext("2d");
    if (!context) return;

    const width = (element.width = window.innerWidth);
    const height = (element.height = window.innerHeight);
    const ticketWidth = Math.min(width * 0.72, 720);
    const ticketHeight = ticketWidth * 0.38;
    const ticketX = (width - ticketWidth) / 2;
    const ticketY = (height - ticketHeight) / 2 - 20;
    const particleCount = Math.min(700, Math.max(260, Math.floor((width * height) / 2_400)));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i += 1) {
      const perimeter = 2 * (ticketWidth + ticketHeight);
      const perimeterPosition = Math.random() * perimeter;
      let targetX = ticketX + Math.random() * ticketWidth;
      let targetY = ticketY + Math.random() * ticketHeight;
      if (i < particleCount * 0.45) {
        if (perimeterPosition < ticketWidth) {
          targetX = ticketX + perimeterPosition;
          targetY = ticketY;
        } else if (perimeterPosition < ticketWidth + ticketHeight) {
          targetX = ticketX + ticketWidth;
          targetY = ticketY + perimeterPosition - ticketWidth;
        } else if (perimeterPosition < 2 * ticketWidth + ticketHeight) {
          targetX = ticketX + ticketWidth - (perimeterPosition - ticketWidth - ticketHeight);
          targetY = ticketY + ticketHeight;
        } else {
          targetX = ticketX;
          targetY = ticketY + ticketHeight - (perimeterPosition - 2 * ticketWidth - ticketHeight);
        }
      }
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * Math.min(width, height) * 0.55;
      particles.push({
        x: width / 2 + Math.cos(angle) * distance,
        y: height / 2 + Math.sin(angle) * distance,
        targetX,
        targetY,
        velocityX: 0,
        velocityY: 0,
        size: 1 + Math.random() * 1.8,
        alpha: 0,
      });
    }

    const started = performance.now();
    handedOff.current = false;
    completed.current = false;

    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgba(0, 0, 0, ${Math.max(0.035, 1 - progress * 0.97)})`;
      context.fillRect(0, 0, width, height);

      const gather = ease(progress / 0.52);
      const reveal = ease((progress - 0.32) / 0.68);
      const centerX = ticketX + ticketWidth / 2;
      const centerY = ticketY + ticketHeight / 2;

      if (progress > 0.25) {
        const glow = ease((progress - 0.25) / 0.35) * 0.32;
        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          ticketWidth * 0.7,
        );
        gradient.addColorStop(0, `rgba(225, 205, 255, ${glow})`);
        gradient.addColorStop(0.48, `rgba(190, 160, 230, ${glow * 0.32})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      if (progress > 0.43) {
        const interior = ease((progress - 0.43) / 0.57);
        const ticketGradient = context.createLinearGradient(ticketX, ticketY, ticketX + ticketWidth, ticketY + ticketHeight);
        ticketGradient.addColorStop(0, `rgba(240, 227, 204, ${interior * 0.82})`);
        ticketGradient.addColorStop(0.28, `rgba(188, 180, 224, ${interior * 0.82})`);
        ticketGradient.addColorStop(0.55, `rgba(247, 211, 220, ${interior * 0.82})`);
        ticketGradient.addColorStop(0.78, `rgba(176, 226, 224, ${interior * 0.82})`);
        ticketGradient.addColorStop(1, `rgba(218, 198, 160, ${interior * 0.88})`);
        drawTicketPath(context, ticketX, ticketY, ticketWidth, ticketHeight, 9);
        context.fillStyle = ticketGradient;
        context.fill();
      }

      if (progress > 0.34) {
        const outline = ease((progress - 0.34) / 0.23);
        drawTicketPath(context, ticketX, ticketY, ticketWidth, ticketHeight, 9);
        context.strokeStyle = `rgba(255, 255, 255, ${outline * 0.88})`;
        context.lineWidth = 1.5;
        context.stroke();
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(ticketX + ticketWidth * 0.795, ticketY);
        context.lineTo(ticketX + ticketWidth * 0.795, ticketY + ticketHeight);
        context.strokeStyle = `rgba(200, 180, 255, ${outline * 0.48})`;
        context.stroke();
        context.setLineDash([]);
      }

      const color =
        progress < 0.2
          ? "255,255,255"
          : progress < 0.42
            ? "239,233,250"
            : progress < 0.62
              ? "208,185,232"
              : progress < 0.8
                ? "231,180,212"
                : progress < 0.93
                  ? "180,230,225"
                  : "216,195,157";
      for (const particle of particles) {
        particle.velocityX = particle.velocityX * 0.85 + (particle.targetX - particle.x) * (0.055 + gather * 0.085);
        particle.velocityY = particle.velocityY * 0.85 + (particle.targetY - particle.y) * (0.055 + gather * 0.085);
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.alpha = Math.min(1, particle.alpha + 0.045);
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (1 + reveal * 0.4), 0, Math.PI * 2);
        context.fillStyle = `rgba(${color}, ${particle.alpha * (0.58 + reveal * 0.42)})`;
        context.fill();
      }

      if (progress > 0.5 && progress < 0.9) {
        const sweep = (progress - 0.5) / 0.4;
        context.save();
        drawTicketPath(context, ticketX + 10, ticketY + 10, ticketWidth - 20, ticketHeight - 20, 5);
        context.clip();
        const light = context.createLinearGradient(
          ticketX + ticketWidth * (sweep - 0.18),
          ticketY,
          ticketX + ticketWidth * (sweep + 0.18),
          ticketY + ticketHeight,
        );
        light.addColorStop(0, "rgba(255,255,255,0)");
        light.addColorStop(0.5, `rgba(255,255,255,${0.15 * reveal})`);
        light.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = light;
        context.fillRect(ticketX, ticketY, ticketWidth, ticketHeight);
        context.restore();
      }

      if (progress >= 0.48 && !handedOff.current) {
        handedOff.current = true;
        onMusicHandoff();
      }
      if (progress >= 1) {
        if (!completed.current) {
          completed.current = true;
          onComplete();
        }
        return;
      }
      frame.current = requestAnimationFrame(draw);
    };

    frame.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame.current);
      context.clearRect(0, 0, width, height);
    };
  }, [active, onComplete, onMusicHandoff]);

  return <canvas ref={canvas} className="troll-morph-canvas" aria-hidden="true" />;
}

function PostMorphStars({ visible }: { visible: boolean }) {
  const stars = useRef(
    Array.from({ length: 42 }, (_, index) => {
      const wave = (value: number) =>
        (Math.sin(index * value + value * 11.7) + 1) / 2;
      return {
        left: wave(1.73) * 100,
        top: wave(2.41) * 100,
        size: wave(3.19) > 0.82 ? 2 : 1,
        duration: 2 + wave(4.07) * 4,
        delay: wave(5.23) * 4,
      };
    }),
  );
  return (
    <div className={`troll-stars ${visible ? "is-visible" : ""}`} aria-hidden="true">
      {stars.current.map((star, index) => (
        <span
          key={index}
          className="troll-star"
          style={
            {
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              "--star-duration": `${star.duration}s`,
              "--star-delay": `${star.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function TrollOpening({
  onMusicHandoff,
  onComplete,
}: {
  onMusicHandoff: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>("date");
  const [dissolving, setDissolving] = useState(false);
  const [showTrollLine, setShowTrollLine] = useState(false);
  const [showTrollAnswer, setShowTrollAnswer] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [starsVisible, setStarsVisible] = useState(false);
  const [morphActive, setMorphActive] = useState(false);
  const start = useRef(performance.now());
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = performance.now() - start.current;
      setStage((current) => {
        if (elapsed >= TIMING.troll && (current === "thats-it" || current === "pause")) return "troll";
        if (elapsed >= TIMING["thats-it"] && current === "pause") return "thats-it";
        if (elapsed >= TIMING.pause && current === "see-you") return "pause";
        if (elapsed >= TIMING["see-you"] && current === "class") return "see-you";
        if (elapsed >= TIMING.class && current === "title") return "class";
        if (elapsed >= TIMING.title && current === "venue") return "title";
        if (elapsed >= TIMING.venue && current === "time") return "venue";
        if (elapsed >= TIMING.time && current === "date") return "time";
        return current;
      });
    }, 40);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage !== "troll") return;
    const first = setTimeout(() => setShowTrollLine(true), 60);
    const answer = setTimeout(() => setShowTrollAnswer(true), 1_350);
    const scroll = setTimeout(() => setShowScroll(true), 2_600);
    return () => {
      clearTimeout(first);
      clearTimeout(answer);
      clearTimeout(scroll);
    };
  }, [stage]);

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    [],
  );

  function activateConstellation() {
    if (stage !== "troll" || !showScroll || dissolving) return;
    setDissolving(true);
    setStage("dissolve");
    transitionTimer.current = setTimeout(() => {
      setStarsVisible(true);
      setMorphActive(true);
      setStage("morph");
    }, 850);
  }

  const invitation = {
    date: { text: "14 NOVEMBER 2026", speed: 48 },
    time: { text: "4:00 PM onwards", speed: 46 },
    venue: { text: "TIPS MAIN — SEMINAR HALL", speed: 38 },
    title: { text: "CELESTIAL ELEGANCE", speed: 34 },
    class: { text: "A FAREWELL FOR THE CLASS OF 2026.", speed: 30 },
    "see-you": { text: "SEE YOU THERE.", speed: 48 },
    "thats-it": { text: "...THAT'S IT.", speed: 55 },
  } as const;
  const current = invitation[stage as keyof typeof invitation];
  const isInvitation = [
    "date",
    "time",
    "venue",
    "title",
    "class",
    "see-you",
    "pause",
    "thats-it",
  ].includes(stage);

  return (
    <div className="troll-opening">
      <PostMorphStars visible={starsVisible} />
      {isInvitation && (
        <div className="troll-phase" key={stage}>
          {current ? (
            stage === "title" ? (
              <div className="troll-title-stack">
                <InvitationLine text={current.text} speed={current.speed} />
                <InvitationLine
                  text="DISCO TILL DAWN"
                  speed={current.speed}
                  fontSize="clamp(1.15rem, 3vw, 2.5rem)"
                />
              </div>
            ) : (
              <InvitationLine text={current.text} speed={current.speed} />
            )
          ) : null}
        </div>
      )}
      {(stage === "troll" || stage === "dissolve") && (
        <div className="troll-phase troll-reveal" aria-live="polite">
          {showTrollLine && (
            <div className={dissolving ? "troll-dissolve" : ""}>
              <InvitationLine text="YOU ACTUALLY THOUGHT THAT WAS IT?" speed={27} />
            </div>
          )}
          {showTrollAnswer && (
            <div className={dissolving ? "troll-dissolve" : "troll-fade-up"}>
              <InvitationLine text="WAIT UNTIL YOU SEE WHAT'S BEHIND THIS." speed={24} />
            </div>
          )}
          {showScroll && (
            <div className={dissolving ? "troll-dissolve" : "troll-fade-up"}>
              <button
                type="button"
                className="troll-constellation"
                onClick={activateConstellation}
                aria-label="Tap the constellation to reveal the ticket"
                disabled={dissolving}
              >
                <svg
                  className="troll-constellation-glyph"
                  viewBox="0 0 120 74"
                  aria-hidden="true"
                >
                  <path d="M18 52 47 21l28 18 27-24" />
                  <path d="M18 52 75 39" />
                  {["18,52", "47,21", "75,39", "102,15"].map((point) => {
                    const [cx, cy] = point.split(",");
                    return <circle key={point} cx={cx} cy={cy} r="3.2" />;
                  })}
                </svg>
                <span className="troll-scroll-prompt">TAP THE CONSTELLATION</span>
              </button>
            </div>
          )}
        </div>
      )}
      <MorphCanvas
        active={morphActive && stage === "morph"}
        onMusicHandoff={onMusicHandoff}
        onComplete={onComplete}
      />
    </div>
  );
}
