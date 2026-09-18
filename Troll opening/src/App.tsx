import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────
type Stage =
  | 'date' | 'time' | 'venue' | 'title' | 'cls' | 'seeyou'
  | 'pause' | 'thatsit' | 'troll' | 'dissolve'
  | 'morph'

// ─── Timing (ms) — slower pacing with longer holds ───────────
const TIMING: Record<string, number> = {
  date:      0,
  time:      3000,
  venue:     6100,
  title:     9800,
  cls:       12400,
  seeyou:    17200,
  pause:     20200,
  thatsit:   21500,
  troll:     23700,
  dissolve:  26200,
  morph:     27200,
}

// ─── Font size by character count (single-line fit) ───────────
function getFontSize(text: string): string {
  const len = text.length
  if (len <= 15) return 'clamp(2.6rem, 7.5vw, 6.5rem)'
  if (len <= 22) return 'clamp(2.2rem, 6vw, 5rem)'
  if (len <= 30) return 'clamp(1.8rem, 4.8vw, 3.8rem)'
  if (len <= 38) return 'clamp(1.4rem, 3.8vw, 3rem)'
  return 'clamp(1.1rem, 3vw, 2.4rem)'
}

// ─── Invitation line: typewriter + synced reflection + fog ────
function InvitationLine({
  text, speed = 75, dissolving, className = '', fontSize: fontSizeOverride,
}: {
  text: string; speed?: number;
  dissolving?: boolean; className?: string; fontSize?: string
}) {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)
  const fontSize = fontSizeOverride ?? getFontSize(text)

  useEffect(() => {
    setDisplayed('')
    indexRef.current = 0
    const id = setInterval(() => {
      indexRef.current++
      setDisplayed(text.slice(0, indexRef.current))
      if (indexRef.current >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  const sharedStyle: React.CSSProperties = {
    fontSize,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 600,
    letterSpacing: '0.12em',
    whiteSpace: 'nowrap',
  }

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Fog — left */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          left: '-18%', top: '50%', transform: 'translateY(-50%)',
          width: '36%', height: '300%',
          background: 'radial-gradient(ellipse at right center, rgba(255,255,255,0.07) 0%, transparent 70%)',
          filter: 'blur(18px)',
        }}
      />
      {/* Fog — right */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          right: '-18%', top: '50%', transform: 'translateY(-50%)',
          width: '36%', height: '300%',
          background: 'radial-gradient(ellipse at left center, rgba(255,255,255,0.07) 0%, transparent 70%)',
          filter: 'blur(18px)',
        }}
      />

      {/* Main text */}
      <div
        className={`leading-none text-white ${dissolving ? 'dissolve' : ''}`}
        style={sharedStyle}
      >
        {displayed}
      </div>

      {/* Reflection — same displayed string, synced */}
      <div
        aria-hidden="true"
        className="reflection leading-none text-white"
        style={{ ...sharedStyle, marginTop: 3 }}
      >
        {displayed}
      </div>
    </div>
  )
}

// ─── Particle Morph Canvas ────────────────────────────────────
interface Particle {
  x: number; y: number
  tx: number; ty: number
  vx: number; vy: number
  size: number; alpha: number
}

function MorphCanvas({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const completedRef = useRef(false)
  const MORPH_DURATION = 4200

  const colorAt = (p: number): string => {
    if (p < 0.2) return 'rgba(255,255,255,'
    if (p < 0.4) return 'rgba(240,235,250,'
    if (p < 0.55) return 'rgba(200,180,230,'
    if (p < 0.7) return 'rgba(230,180,210,'
    if (p < 0.85) return 'rgba(180,230,225,'
    return 'rgba(212,175,106,'
  }

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = window.innerWidth
    const H = canvas.height = window.innerHeight

    const ticketW = Math.min(W * 0.72, 720)
    const ticketH = ticketW * 0.38
    const ticketX = (W - ticketW) / 2
    const ticketY = (H - ticketH) / 2 - 20

    const N = Math.min(800, Math.floor(W * H / 2000))
    const targets: [number, number][] = []
    for (let i = 0; i < N; i++) {
      if (i < N * 0.45) {
        const perimeter = 2 * (ticketW + ticketH)
        const pos = Math.random() * perimeter
        if (pos < ticketW) targets.push([ticketX + pos, ticketY])
        else if (pos < ticketW + ticketH) targets.push([ticketX + ticketW, ticketY + (pos - ticketW)])
        else if (pos < 2 * ticketW + ticketH) targets.push([ticketX + ticketW - (pos - ticketW - ticketH), ticketY + ticketH])
        else targets.push([ticketX, ticketY + ticketH - (pos - 2 * ticketW - ticketH)])
      } else {
        targets.push([ticketX + Math.random() * ticketW, ticketY + Math.random() * ticketH])
      }
    }

    const particles: Particle[] = targets.map(([tx, ty]) => {
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * (Math.min(W, H) * 0.55)
      return {
        x: W / 2 + Math.cos(angle) * dist,
        y: H / 2 + Math.sin(angle) * dist,
        tx, ty, vx: 0, vy: 0,
        size: 1 + Math.random() * 1.8,
        alpha: 0,
      }
    })

    const start = performance.now()
    completedRef.current = false

    function draw(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / MORPH_DURATION, 1)
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = `rgba(0,0,0,${1 - progress * 0.95})`
      ctx.fillRect(0, 0, W, H)

      const gatherP = Math.min(progress / 0.5, 1)
      const revealP = Math.max((progress - 0.4) / 0.6, 0)

      if (progress > 0.3) {
        const ga = Math.min((progress - 0.3) / 0.3, 1) * 0.3
        const grd = ctx.createRadialGradient(
          ticketX + ticketW / 2, ticketY + ticketH / 2, 0,
          ticketX + ticketW / 2, ticketY + ticketH / 2, ticketW * 0.65
        )
        grd.addColorStop(0, `rgba(220,200,255,${ga})`)
        grd.addColorStop(0.5, `rgba(200,170,230,${ga * 0.35})`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, W, H)
      }

      if (progress > 0.35) {
        const oa = Math.min((progress - 0.35) / 0.2, 1)
        ctx.strokeStyle = `rgba(255,255,255,${oa * 0.8})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(ticketX, ticketY, ticketW, ticketH, 8)
        ctx.stroke()
        const stubX = ticketX + ticketW * 0.795
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(stubX, ticketY)
        ctx.lineTo(stubX, ticketY + ticketH)
        ctx.strokeStyle = `rgba(200,180,255,${oa * 0.45})`
        ctx.stroke()
        ctx.setLineDash([])
      }

      const colorStr = colorAt(progress)
      const ease = 0.06 + gatherP * 0.08
      for (const p of particles) {
        p.vx = p.vx * 0.85 + (p.tx - p.x) * ease
        p.vy = p.vy * 0.85 + (p.ty - p.y) * ease
        p.x += p.vx; p.y += p.vy
        p.alpha = Math.min(p.alpha + 0.04, 1)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 + revealP * 0.4), 0, Math.PI * 2)
        ctx.fillStyle = `${colorStr}${p.alpha * (0.6 + revealP * 0.4)})`
        ctx.fill()
      }

      if (progress >= 1) {
        if (!completedRef.current) { completedRef.current = true; onComplete() }
        return
      }
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frameRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 20, display: active ? 'block' : 'none' }}
    />
  )
}

// ─── Sparkle SVG ─────────────────────────────────────────────
function Sparkle({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2 L13.2 10 L21 12 L13.2 14 L12 22 L10.8 14 L3 12 L10.8 10 Z" />
    </svg>
  )
}

// ─── Stars ────────────────────────────────────────────────────
function Stars({ visible }: { visible: boolean }) {
  const stars = useRef(
    Array.from({ length: 60 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      dur: 2 + Math.random() * 4, delay: Math.random() * 5,
      size: Math.random() > 0.8 ? 2 : 1,
    }))
  )
  return (
    <div className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10, opacity: visible ? 1 : 0, transition: 'opacity 2s ease' }}>
      {stars.current.map((s, i) => (
        <div key={i} className="star" style={{
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          '--dur': `${s.dur}s`, '--delay': `${s.delay}s`,
        } as React.CSSProperties} />
      ))}
      <Sparkle size={12} className="absolute top-[6%] left-[4%] text-[#c8b4e8] opacity-50 sparkle" />
      <Sparkle size={10} className="absolute top-[10%] right-[6%] text-[#c8b4e8] opacity-40 sparkle" />
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [stage, setStage] = useState<Stage>('date')
  const [dissolvingText, setDissolvingText] = useState(false)
  const [morphActive, setMorphActive] = useState(false)
  const [starsVisible, setStarsVisible] = useState(false)

  const [showTroll1, setShowTroll1] = useState(false)
  const [showTroll2, setShowTroll2] = useState(false)
  const [showScroll, setShowScroll] = useState(false)

  const startRef = useRef(performance.now())

  useEffect(() => {
    const id = setInterval(() => {
      const e = performance.now() - startRef.current

      if (e >= TIMING.morph && stage !== 'morph') {
        setStage('morph')
        setMorphActive(true)
        setStarsVisible(true)
      } else if (e >= TIMING.dissolve && stage === 'troll') {
        setStage('dissolve')
        setDissolvingText(true)
      } else if (e >= TIMING.troll && (stage === 'thatsit' || stage === 'pause')) {
        setStage('troll')
        setShowTroll1(true)
        setTimeout(() => setShowTroll2(true), 700)
        setTimeout(() => setShowScroll(true), 1500)
      } else if (e >= TIMING.thatsit && stage === 'pause') {
        setStage('thatsit')
      } else if (e >= TIMING.pause && stage === 'seeyou') {
        setStage('pause')
      } else if (e >= TIMING.seeyou && stage === 'cls') {
        setStage('seeyou')
      } else if (e >= TIMING.cls && stage === 'title') {
        setStage('cls')
      } else if (e >= TIMING.title && stage === 'venue') {
        setStage('title')
      } else if (e >= TIMING.venue && stage === 'time') {
        setStage('venue')
      } else if (e >= TIMING.time && stage === 'date') {
        setStage('time')
      }
    }, 50)
    return () => clearInterval(id)
  }, [stage])

  const handleMorphComplete = useCallback(() => {}, [])

  const isInvitation = ['date','time','venue','title','cls','seeyou','pause','thatsit'].includes(stage)

  const phaseConfig: Partial<Record<Stage, { text: string; speed?: number }>> = {
    date:    { text: '14 NOVEMBER 2026',              speed: 90 },
    time:    { text: '4:00 PM onwards',               speed: 85 },
    venue:   { text: 'TIPS MAIN — SEMINAR HALL',      speed: 75 },
    title:   { text: 'CELESTIAL ELEGANCE',            speed: 65 },
    cls:     { text: 'A FAREWELL FOR THE CLASS OF 2026.', speed: 72 },
    seeyou:  { text: 'SEE YOU THERE.',                speed: 90 },
    thatsit: { text: "...THAT'S IT.",                 speed: 100 },
  }

  const currentConfig = phaseConfig[stage]

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Stars (post-morph) */}
      <Stars visible={starsVisible} />

      {/* Phase A: single invitation line */}
      {isInvitation && (
        <div key={stage} className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 15 }}>
          {currentConfig ? (
            <>
              {stage === 'title' ? (
                <div className="flex flex-col items-center gap-[3vh]">
                  <InvitationLine
                    text="CELESTIAL ELEGANCE"
                    speed={currentConfig.speed}
                    dissolving={dissolvingText}
                  />
                  <InvitationLine
                    text="Disco till dawn"
                    speed={currentConfig.speed}
                    dissolving={dissolvingText}
                    fontSize="clamp(1.1rem, 3vw, 2.5rem)"
                  />
                </div>
              ) : (
                <InvitationLine
                  text={currentConfig.text}
                  speed={currentConfig.speed}
                  dissolving={dissolvingText}
                />
              )}
            </>
          ) : (
            <div /> // pause — pure black
          )}
        </div>
      )}

      {/* Troll reveal */}
      {(stage === 'troll' || stage === 'dissolve') && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-[2vh]" style={{ zIndex: 15 }}>
          {showTroll1 && (
            <div className={dissolvingText ? 'dissolve' : ''}>
              <InvitationLine text="YOU ACTUALLY THOUGHT THAT WAS IT?" speed={42} dissolving={false} />
            </div>
          )}
          {showTroll2 && (
            <div className={dissolvingText ? 'dissolve' : 'fade-up'}
              style={{ animationDelay: dissolvingText ? '0.15s' : '0s' }}>
              <InvitationLine text="WAIT UNTIL YOU SEE WHAT'S BEHIND THIS." speed={35} dissolving={false} />
            </div>
          )}
          {showScroll && (
            <div className={dissolvingText ? 'dissolve' : 'fade-up'}
              style={{ animationDelay: dissolvingText ? '0.3s' : '0s' }}>
              <p
                className="text-[clamp(1.2rem,3vw,2.4rem)] tracking-[0.4em] text-white mt-[0.5vh]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400 }}
              >
                SCROLL.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Morph canvas */}
      <MorphCanvas active={morphActive} onComplete={handleMorphComplete} />

    </div>
  )
}
