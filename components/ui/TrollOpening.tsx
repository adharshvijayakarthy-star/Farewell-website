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
      <div
        className={`troll-reflection ${dissolving ? "troll-dissolve" : ""}`}
        aria-hidden="true"
        style={{ ...style, marginTop: 3 }}
      >
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
  edgeX: number;
  edgeY: number;
  driftX: number;
  driftY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  alpha: number;
  role: "edge" | "interior" | "drift";
  shimmer: number;
};

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  return ease((x - edge0) / (edge1 - edge0));
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
  context.roundRect(x, y, width, height, Math.max(0.01, radius));
}

/** Interpolate between two "r,g,b" color strings. */
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = a.split(",").map(Number);
  const [br, bg, bb] = b.split(",").map(Number);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `${r},${g},${bl}`;
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
  // ~5.6s morph keeps dissolve+morph in the existing 6–8s window while
  // giving the construction stages more intermediate states.
  const duration = 5_600;

  useEffect(() => {
    if (!active || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext("2d");
    if (!context) return;

    const width = (element.width = window.innerWidth);
    const height = (element.height = window.innerHeight);
    const isMobile = width < 700;
    // Final ticket geometry — matches the existing Ticket component.
    const ticketWidth = isMobile ? width * 0.82 : Math.min(650, width * 0.75);
    const ticketHeight = isMobile ? 240 : 322;
    const ticketX = (width - ticketWidth) / 2;
    const ticketY = (height - ticketHeight) / 2;
    const finalRadius = 15;
    const stubWidth = isMobile ? 51 : 102;
    const stubDividerX = ticketX + ticketWidth - stubWidth;
    const finalRotation = isMobile ? -8 : -7;

    const particleCount = Math.min(
      700,
      Math.max(260, Math.floor((width * height) / 2_400)),
    );
    const particles: Particle[] = [];

    const centerX = ticketX + ticketWidth / 2;
    const centerY = ticketY + ticketHeight / 2;

    const perimeterPoint = (t: number) => {
      const perimeter = 2 * (ticketWidth + ticketHeight);
      const p = ((t % 1) + 1) % 1 * perimeter;
      if (p < ticketWidth) return { x: ticketX + p, y: ticketY };
      if (p < ticketWidth + ticketHeight)
        return { x: ticketX + ticketWidth, y: ticketY + p - ticketWidth };
      if (p < 2 * ticketWidth + ticketHeight)
        return {
          x: ticketX + ticketWidth - (p - ticketWidth - ticketHeight),
          y: ticketY + ticketHeight,
        };
      return {
        x: ticketX,
        y: ticketY + ticketHeight - (p - 2 * ticketWidth - ticketHeight),
      };
    };

    for (let i = 0; i < particleCount; i += 1) {
      const perimeterPosition = Math.random();
      const edge = perimeterPoint(perimeterPosition);
      // Soft jitter so the edge doesn't look like a UI stroke.
      const edgeX = edge.x + (Math.random() - 0.5) * 3;
      const edgeY = edge.y + (Math.random() - 0.5) * 3;
      const interiorX = ticketX + Math.random() * ticketWidth;
      const interiorY = ticketY + Math.random() * ticketHeight;

      const isEdge = i < particleCount * 0.48;
      const isDrift = i >= particleCount * 0.78;
      const role: Particle["role"] = isEdge
        ? "edge"
        : isDrift
          ? "drift"
          : "interior";

      const gatherX = isEdge ? edgeX : interiorX;
      const gatherY = isEdge ? edgeY : interiorY;

      const driftAngle = Math.random() * Math.PI * 2;
      const driftDist = 40 + Math.random() * Math.min(width, height) * 0.18;

      if (i < particleCount * 0.25) {
        particles.push({
          x: centerX + (Math.random() - 0.5) * ticketWidth * 0.8,
          y: centerY + 50 + Math.random() * 100,
          targetX: gatherX,
          targetY: gatherY,
          edgeX,
          edgeY,
          driftX: centerX + Math.cos(driftAngle) * (ticketWidth * 0.55 + driftDist),
          driftY: centerY + Math.sin(driftAngle) * (ticketHeight * 0.55 + driftDist),
          velocityX: (Math.random() - 0.5) * 0.5,
          velocityY: -0.8 - Math.random() * 1.2,
          size: 1 + Math.random() * 1.7,
          alpha: 0,
          role,
          shimmer: Math.random() * Math.PI * 2,
        });
      } else {
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * Math.min(width, height) * 0.55;
        particles.push({
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance,
          targetX: gatherX,
          targetY: gatherY,
          edgeX,
          edgeY,
          driftX: centerX + Math.cos(driftAngle) * (ticketWidth * 0.55 + driftDist),
          driftY: centerY + Math.sin(driftAngle) * (ticketHeight * 0.55 + driftDist),
          velocityX: 0,
          velocityY: 0,
          size: 1 + Math.random() * 1.8,
          alpha: 0,
          role,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }

    const started = performance.now();
    handedOff.current = false;
    completed.current = false;

    const colorStops: { at: number; color: string }[] = [
      { at: 0.0, color: "255,255,255" },
      { at: 0.18, color: "241,233,224" },
      { at: 0.35, color: "208,185,232" },
      { at: 0.5, color: "231,180,212" },
      { at: 0.68, color: "180,230,225" },
      { at: 0.85, color: "216,195,157" },
      { at: 1.0, color: "218,200,165" },
    ];

    function getColor(progress: number): string {
      for (let i = 0; i < colorStops.length - 1; i++) {
        if (progress <= colorStops[i + 1].at) {
          const t =
            (progress - colorStops[i].at) /
            (colorStops[i + 1].at - colorStops[i].at);
          return lerpColor(colorStops[i].color, colorStops[i + 1].color, t);
        }
      }
      return colorStops[colorStops.length - 1].color;
    }

    function drawConstructedTicket(
      ctx: CanvasRenderingContext2D,
      progress: number,
      radius: number,
    ) {
      const surface = smoothstep(0.58, 0.76, progress);
      const detail = smoothstep(0.7, 0.9, progress);
      const iridescence = smoothstep(0.62, 0.88, progress);
      const depth = smoothstep(0.8, 0.94, progress);

      // Soft shadow develops with depth — never full strength at once.
      if (depth > 0.01) {
        ctx.save();
        ctx.shadowColor = `rgba(0,0,0,${0.45 * depth})`;
        ctx.shadowBlur = 28 + 40 * depth;
        ctx.shadowOffsetX = 6 * depth;
        ctx.shadowOffsetY = 22 * depth;
        drawTicketPath(ctx, ticketX, ticketY, ticketWidth, ticketHeight, radius);
        ctx.fillStyle = `rgba(8,12,27,${0.35 * depth})`;
        ctx.fill();
        ctx.restore();
      }

      // Surface grows from center via radial expansion (not a full-card fade-in).
      if (surface > 0.001) {
        ctx.save();
        drawTicketPath(ctx, ticketX, ticketY, ticketWidth, ticketHeight, radius);
        ctx.clip();

        const maxR = Math.hypot(ticketWidth, ticketHeight) * 0.72;
        const revealR = Math.max(1, maxR * surface);
        const pearl = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          revealR,
        );
        // Restrained holographic progression: pearl → lavender → pink → cyan → warm pearl
        const a = Math.min(1, surface * 1.05);
        pearl.addColorStop(0, `rgba(245, 238, 230, ${0.92 * a})`);
        pearl.addColorStop(
          0.22,
          `rgba(220, 210, 236, ${0.88 * a * (0.55 + 0.45 * iridescence)})`,
        );
        pearl.addColorStop(
          0.45,
          `rgba(247, 220, 228, ${0.86 * a * (0.4 + 0.6 * iridescence)})`,
        );
        pearl.addColorStop(
          0.68,
          `rgba(200, 228, 226, ${0.84 * a * (0.35 + 0.65 * iridescence)})`,
        );
        pearl.addColorStop(0.88, `rgba(236, 226, 208, ${0.9 * a})`);
        pearl.addColorStop(1, `rgba(236, 226, 208, 0)`);
        ctx.fillStyle = pearl;
        ctx.fillRect(
          centerX - revealR,
          centerY - revealR,
          revealR * 2,
          revealR * 2,
        );

        // Full gradient fills in as the radial reveal completes.
        if (surface > 0.55) {
          const fillIn = ease((surface - 0.55) / 0.45);
          const ticketGradient = ctx.createLinearGradient(
            ticketX,
            ticketY,
            ticketX + ticketWidth,
            ticketY + ticketHeight,
          );
          ticketGradient.addColorStop(0, `rgba(240, 227, 204, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(0.2, `rgba(219, 225, 246, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(0.34, `rgba(188, 180, 224, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(0.49, `rgba(247, 226, 218, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(0.64, `rgba(216, 238, 221, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(0.81, `rgba(197, 201, 238, ${fillIn * 0.95})`);
          ticketGradient.addColorStop(1, `rgba(233, 224, 203, ${fillIn * 0.98})`);
          ctx.globalAlpha = fillIn;
          ctx.fillStyle = ticketGradient;
          ctx.fillRect(ticketX, ticketY, ticketWidth, ticketHeight);
          ctx.globalAlpha = 1;
        }

        // Subtle bevel / edge highlight as depth develops.
        if (depth > 0.05) {
          const bevel = ctx.createLinearGradient(
            ticketX,
            ticketY,
            ticketX,
            ticketY + ticketHeight,
          );
          bevel.addColorStop(0, `rgba(255,255,255,${0.22 * depth})`);
          bevel.addColorStop(0.45, `rgba(255,255,255,0)`);
          bevel.addColorStop(1, `rgba(40,35,70,${0.12 * depth})`);
          ctx.fillStyle = bevel;
          ctx.fillRect(ticketX, ticketY, ticketWidth, ticketHeight);
        }

        ctx.restore();
      }

      // Outer luminous edge — particles appear to lock into the frame.
      const edgeStrength = smoothstep(0.46, 0.7, progress);
      if (edgeStrength > 0.01) {
        drawTicketPath(ctx, ticketX, ticketY, ticketWidth, ticketHeight, radius);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + edgeStrength * 0.55})`;
        ctx.lineWidth = 1.2 + edgeStrength * 0.6;
        ctx.stroke();
        drawTicketPath(ctx, ticketX, ticketY, ticketWidth, ticketHeight, radius);
        ctx.strokeStyle = `rgba(200, 190, 230, ${edgeStrength * 0.35})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }

      // Progressive interior details (layers, not all at once).
      if (detail > 0.01) {
        ctx.save();
        drawTicketPath(ctx, ticketX, ticketY, ticketWidth, ticketHeight, radius);
        ctx.clip();

        const muted = `rgba(39, 37, 57, ${detail * 0.72})`;

        // 1–2. Inner border
        const inner = smoothstep(0.72, 0.82, progress);
        if (inner > 0) {
          drawTicketPath(
            ctx,
            ticketX + 10,
            ticketY + 10,
            ticketWidth - 20,
            ticketHeight - 20,
            Math.max(2, radius - 6),
          );
          ctx.strokeStyle = `rgba(86, 81, 106, ${inner * 0.45})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 3. Stub divider
        const stubLine = smoothstep(0.74, 0.84, progress);
        if (stubLine > 0) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(stubDividerX, ticketY + 12);
          ctx.lineTo(stubDividerX, ticketY + ticketHeight - 12);
          ctx.strokeStyle = `rgba(87, 81, 108, ${stubLine * 0.55})`;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 4. Major title block first
        const titleA = smoothstep(0.76, 0.88, progress);
        if (titleA > 0) {
          ctx.fillStyle = `rgba(39, 37, 57, ${titleA})`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const titleSize = isMobile ? ticketWidth * 0.11 : ticketWidth * 0.103;
          ctx.font = `500 ${titleSize}px "Fraunces Variable", Georgia, serif`;
          ctx.fillText("CELESTIAL", ticketX + (isMobile ? 22 : 38), ticketY + ticketHeight * 0.32);
          ctx.font = `400 ${titleSize * 0.86}px "Fraunces Variable", Georgia, serif`;
          ctx.fillText(
            "ELEGANCE",
            ticketX + (isMobile ? 22 : 38),
            ticketY + ticketHeight * 0.32 + titleSize * 0.92,
          );
        }

        // 5. Celestial branding
        const brandA = smoothstep(0.8, 0.9, progress);
        if (brandA > 0) {
          ctx.fillStyle = `rgba(39, 37, 57, ${brandA * 0.85})`;
          ctx.font = `600 ${isMobile ? 8 : 10}px Manrope, Arial, sans-serif`;
          ctx.letterSpacing = "0.25em";
          ctx.fillText(
            "✦ DISCO TILL DAWN ✦",
            ticketX + (isMobile ? 22 : 38),
            ticketY + (isMobile ? 18 : 28),
          );
          ctx.letterSpacing = "0px";
          ctx.font = `${isMobile ? 26 : 40}px "Fraunces Variable", Georgia, serif`;
          ctx.fillStyle = `rgba(39, 37, 57, ${brandA * 0.55})`;
          ctx.fillText(
            "✧",
            stubDividerX - (isMobile ? 36 : 52),
            ticketY + (isMobile ? 14 : 22),
          );
        }

        // 6–8. Right stub + barcode + date/class
        const stubA = smoothstep(0.84, 0.94, progress);
        if (stubA > 0) {
          ctx.fillStyle = muted;
          ctx.textAlign = "center";
          ctx.font = `600 ${isMobile ? 9 : 11}px Manrope, Arial, sans-serif`;
          const stubCx = stubDividerX + stubWidth / 2;
          ctx.fillText("✦", stubCx, ticketY + ticketHeight * 0.14);
          ctx.save();
          ctx.translate(stubCx, centerY);
          ctx.rotate(Math.PI / 2);
          ctx.font = `600 ${isMobile ? 8 : 10}px Manrope, Arial, sans-serif`;
          ctx.fillText("DISCO TILL DAWN", 0, 0);
          ctx.restore();

          const barW = isMobile ? 36 : 48;
          const barH = isMobile ? 22 : 31;
          const barX = stubCx - barW / 2;
          const barY = ticketY + ticketHeight * 0.62;
          for (let bx = 0; bx < barW; bx += 3) {
            const thick = bx % 7 < 3 ? 1.2 : 0.7;
            ctx.fillStyle = `rgba(72, 68, 91, ${stubA * 0.7})`;
            ctx.fillRect(barX + bx, barY, thick, barH);
          }
          ctx.fillStyle = muted;
          ctx.font = `600 ${isMobile ? 9 : 11}px Manrope, Arial, sans-serif`;
          ctx.fillText("2026", stubCx, ticketY + ticketHeight * 0.88);
        }

        const bottomA = smoothstep(0.86, 0.96, progress);
        if (bottomA > 0) {
          ctx.textAlign = "left";
          ctx.fillStyle = `rgba(39, 37, 57, ${bottomA * 0.85})`;
          ctx.font = `600 ${isMobile ? 8 : 10}px Manrope, Arial, sans-serif`;
          const by = ticketY + ticketHeight - (isMobile ? 22 : 28);
          ctx.fillText("14 · 11 · 26", ticketX + (isMobile ? 22 : 38), by);
          ctx.textAlign = "right";
          ctx.fillText(
            "CLASS OF 2026",
            stubDividerX - (isMobile ? 14 : 20),
            by,
          );
        }

        // 9. Soft surface highlight sweep
        const sheen = smoothstep(0.88, 0.98, progress);
        if (sheen > 0) {
          const light = ctx.createLinearGradient(
            ticketX,
            ticketY,
            ticketX + ticketWidth,
            ticketY + ticketHeight,
          );
          light.addColorStop(0, "rgba(255,255,255,0)");
          light.addColorStop(0.45, `rgba(255,255,255,${0.14 * sheen})`);
          light.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = light;
          ctx.fillRect(ticketX, ticketY, ticketWidth, ticketHeight);
        }

        ctx.restore();
      }
    }

    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      context.clearRect(0, 0, width, height);

      // Predominantly black throughout; celestial veil only late and soft.
      context.fillStyle = `rgba(0, 0, 0, ${Math.max(0.04, 1 - progress * 0.92)})`;
      context.fillRect(0, 0, width, height);

      const gather = smoothstep(0, 0.3, progress);
      const densityShift = smoothstep(0.34, 0.48, progress);
      const outlinePhysical = smoothstep(0.44, 0.58, progress);
      const radius =
        finalRadius * smoothstep(0.44, 0.62, progress);
      const centerGlow = smoothstep(0.5, 0.6, progress) *
        (1 - smoothstep(0.72, 0.86, progress) * 0.55);
      const rotateT = smoothstep(0.8, 0.93, progress);
      const rotation = (finalRotation * Math.PI) / 180 * rotateT;
      const driftAway = smoothstep(0.78, 0.96, progress);

      // Early reflection distortion (preserved from original).
      if (progress < 0.22) {
        const distort = ease(progress / 0.22);
        const distortRadius = ticketWidth * 0.35 * distort;
        const gradient = context.createRadialGradient(
          centerX,
          centerY + 30 * (1 - distort),
          0,
          centerX,
          centerY,
          distortRadius,
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${distort * 0.07})`);
        gradient.addColorStop(0.55, `rgba(200, 195, 220, ${distort * 0.035})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      }

      // Stage D — soft diffuse center light (pearl → lavender → faint pink).
      if (centerGlow > 0.01) {
        const glow = context.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          ticketWidth * 0.42,
        );
        glow.addColorStop(0, `rgba(241, 233, 224, ${centerGlow * 0.28})`);
        glow.addColorStop(0.35, `rgba(208, 185, 232, ${centerGlow * 0.16})`);
        glow.addColorStop(0.7, `rgba(231, 180, 212, ${centerGlow * 0.07})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }

      // Particle target migration: gather → densify edges → lock / drift.
      for (const particle of particles) {
        let aimX = particle.targetX;
        let aimY = particle.targetY;
        if (densityShift > 0 && particle.role !== "edge") {
          // Interiors migrate toward the border while keeping some interior life.
          const pull = densityShift * (particle.role === "interior" ? 0.72 : 0.35);
          aimX = particle.targetX + (particle.edgeX - particle.targetX) * pull;
          aimY = particle.targetY + (particle.edgeY - particle.targetY) * pull;
        }
        if (particle.role === "edge" || particle.role === "interior") {
          // Lock toward the physical outline.
          const lock = smoothstep(0.55, 0.78, progress);
          aimX = aimX + (particle.edgeX - aimX) * lock;
          aimY = aimY + (particle.edgeY - aimY) * lock;
        }
        if (particle.role === "drift" && driftAway > 0) {
          aimX = particle.edgeX + (particle.driftX - particle.edgeX) * driftAway;
          aimY = particle.edgeY + (particle.driftY - particle.edgeY) * driftAway;
        }

        const spring = 0.04 + gather * 0.08 + densityShift * 0.03;
        particle.velocityX =
          particle.velocityX * 0.84 + (aimX - particle.x) * spring;
        particle.velocityY =
          particle.velocityY * 0.84 + (aimY - particle.y) * spring;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.alpha = Math.min(1, particle.alpha + 0.035);
        particle.shimmer += 0.045;
      }

      context.save();
      context.translate(centerX, centerY);
      context.rotate(rotation);
      context.translate(-centerX, -centerY);

      // Extremely subtle forward scale as the object becomes physical.
      const forward = 1 + smoothstep(0.55, 0.9, progress) * 0.012;
      context.translate(centerX, centerY);
      context.scale(forward, forward);
      context.translate(-centerX, -centerY);

      // Constructed ticket surface / details under the particles.
      drawConstructedTicket(context, progress, radius);

      // Early sharp outline (pre-radius) while particles still dominate.
      if (outlinePhysical > 0.01 && progress < 0.72) {
        const sharp = 1 - smoothstep(0.58, 0.72, progress);
        drawTicketPath(
          context,
          ticketX,
          ticketY,
          ticketWidth,
          ticketHeight,
          radius,
        );
        context.strokeStyle = `rgba(255, 255, 255, ${outlinePhysical * sharp * 0.75})`;
        context.lineWidth = 1.4;
        context.stroke();
      }

      // Particles — majority lock to edges; drifters leave gently.
      const color = getColor(progress);
      const surfaceCover = smoothstep(0.62, 0.85, progress);
      for (const particle of particles) {
        const shimmer =
          0.85 + 0.15 * Math.sin(particle.shimmer + particle.x * 0.02);
        let alpha = particle.alpha * (0.55 + gather * 0.35) * shimmer;
        if (particle.role !== "drift") {
          // Edge particles remain readable; interiors fade as surface forms.
          alpha *=
            particle.role === "edge"
              ? 1 - surfaceCover * 0.35
              : 1 - surfaceCover * 0.82;
        } else {
          alpha *= 0.85 - driftAway * 0.35;
        }
        if (alpha < 0.02) continue;
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.size * (1 + outlinePhysical * 0.25),
          0,
          Math.PI * 2,
        );
        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.fill();
      }

      context.restore();

      // Music handoff when the surface begins forming (existing hook).
      if (progress >= 0.55 && !handedOff.current) {
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  if (!isMounted) return null;

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
  const start = useRef(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    start.current = performance.now();
  }, []);

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
    }, 2600);
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
              <InvitationLine text="YOU ACTUALLY THOUGHT THAT WAS IT?" speed={27} dissolving={dissolving} />
            </div>
          )}
          {showTrollAnswer && (
            <div className={dissolving ? "troll-dissolve" : "troll-fade-up"}>
              <InvitationLine text="WAIT UNTIL YOU SEE WHAT'S BEHIND THIS." speed={24} dissolving={dissolving} />
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
