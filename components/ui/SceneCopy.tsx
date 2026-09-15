import { copy } from "@/lib/scene/invitationCopy";
import { textCues, textPhase } from "@/lib/scene/sceneTransitions";
import { smooth } from "@/lib/scene/sceneTimeline";
type Cue = { start: number; end: number };
function Letterform({
  text,
  entry,
  exit,
}: {
  text: string;
  entry: number;
  exit: number;
}) {
  let index = 0;
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return (
    <span className="letterform">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, w) => (
          <span key={w}>
            {w > 0 ? " " : ""}
            <span className="letter-word">
              {[...segmenter.segment(word)].map(({ segment: letter }) => {
                const i = index++;
                return (
                  <span
                    className="letter"
                    key={i}
                    style={{
                      transform: `translate3d(${exit * Math.sin(i * 2) * 28}px,${(1 - entry) * (12 + (i % 3) * 8) - exit * (20 + (i % 5) * 10)}px,0) rotate(${(1 - entry) * (i % 2 ? 5 : -5) + exit * (i % 2 ? 8 : -8)}deg)`,
                      opacity: Math.min(1, entry * 1.8) * (1 - exit),
                      filter: `blur(${(1 - entry) * 4 + exit * 3}px)`,
                    }}
                  >
                    {letter}
                  </span>
                );
              })}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
function Beat({
  cue,
  progress,
  kind,
  children,
}: {
  cue: Cue;
  progress: number;
  kind: string;
  children: (phase: ReturnType<typeof textPhase>) => React.ReactNode;
}) {
  const phase = textPhase(progress, cue);
  return (
    <section
      className={`scene-copy copy-${kind}`}
      aria-hidden={!phase.visible || phase.opacity < 0.08}
      style={
        {
          visibility: phase.visible ? "visible" : "hidden",
          opacity: phase.opacity,
          "--entry": phase.entrance,
          "--exit": phase.exit,
          transform: `translate3d(0,${(1 - phase.entrance) * 14 - phase.exit * 10}px,0)`,
        } as React.CSSProperties
      }
    >
      {children(phase)}
    </section>
  );
}
export default function SceneCopy({
  progress,
  entered,
}: {
  progress: number;
  entered: boolean;
}) {
  const p = entered ? progress : -1;
  return (
    <div className="copy-layer">
      <Beat cue={textCues.title} progress={p} kind="title">
        {(s) => (
          <>
            <p className="eyebrow">{copy.brand}</p>
            <h1>
              <Letterform text="DISCO" entry={s.entrance} exit={s.exit} />
              <em>
                <Letterform
                  text="TILL DAWN"
                  entry={smooth((s.t - 0.035) / 0.2)}
                  exit={s.exit}
                />
              </em>
            </h1>
            <div
              className="type-sweep"
              style={{ transform: `translateX(${(s.t - 0.35) * 450}%)` }}
              aria-hidden="true"
            />
          </>
        )}
      </Beat>
      <Beat cue={textCues.beneath} progress={p} kind="celebration">
        {() => (
          <>
            <span className="copy-star">✦</span>
            <p className="text-block">{copy.celebration}</p>
          </>
        )}
      </Beat>
      <Beat cue={textCues.farewell} progress={p} kind="farewell">
        {(s) => (
          <>
            <span className="copy-star">✦</span>
            <h2>
              <Letterform text={copy.dear} entry={s.entrance} exit={s.exit} />
            </h2>
            <p
              className="text-block"
              style={{
                clipPath: `inset(0 0 ${(1 - smooth((s.t - 0.05) / 0.18)) * 100}% 0)`,
                transform: `translateY(${(1 - smooth((s.t - 0.05) / 0.18)) * 12}px)`,
              }}
            >
              {copy.invitation}
            </p>
          </>
        )}
      </Beat>
      {textCues.promises.map((cue, i) => (
        <Beat key={i} cue={cue} progress={p} kind={`promise promise-${i}`}>
          {(s) => (
            <h2
              style={{
                transform: `perspective(900px) rotateX(${(1 - s.entrance) * 12}deg) scale(${0.9 + s.entrance * 0.1 - s.exit * 0.07})`,
              }}
            >
              <Letterform
                text={copy.promises[i]}
                entry={s.entrance}
                exit={s.exit}
              />
            </h2>
          )}
        </Beat>
      ))}
      <Beat cue={textCues.details} progress={p} kind="details">
        {(s) => (
          <>
            <span className="copy-star">✦</span>
            <h2
              style={{
                clipPath: `inset(0 ${(1 - smooth(s.t / 0.18)) * 50}% 0)`,
              }}
            >
              {copy.date}
            </h2>
            <p
              className="event-time"
              style={{
                opacity: smooth((s.t - 0.09) / 0.13),
                transform: `translateY(${(1 - smooth((s.t - 0.09) / 0.13)) * 14}px)`,
              }}
            >
              {copy.time}
            </p>
            <p
              className="event-venue"
              style={{
                opacity: smooth((s.t - 0.18) / 0.13),
                letterSpacing: `${0.13 + (1 - smooth((s.t - 0.18) / 0.13)) * 0.15}em`,
              }}
            >
              {copy.venue}
            </p>
            <span className="copy-star">✦</span>
          </>
        )}
      </Beat>
      <Beat cue={textCues.quote} progress={p} kind="quote">
        {() => (
          <>
            <blockquote>{copy.quote}</blockquote>
            <span className="copy-star">✦</span>
          </>
        )}
      </Beat>
      <Beat cue={textCues.dawn} progress={p} kind="dawn">
        {() => (
          <>
            <p className="text-block">{copy.dawn}</p>
            <span className="copy-star">✦</span>
          </>
        )}
      </Beat>
      <Beat cue={textCues.love} progress={p} kind="love">
        {() => (
          <>
            <span className="copy-star">✦</span>
            <p>{copy.love}</p>
          </>
        )}
      </Beat>
      <Beat cue={textCues.goodbye} progress={p} kind="goodbye">
        {() => (
          <>
            <h2>{copy.title}</h2>
            <p>{copy.date}</p>
            <p className="eyebrow">{copy.brand}</p>
          </>
        )}
      </Beat>
    </div>
  );
}
