import { copy } from "@/lib/scene/invitationCopy";
export default function StaticInvitation() {
  return (
    <article className="static-invitation">
      <p className="eyebrow">{copy.brand}</p>
      <h1>{copy.title}</h1>
      <p>{copy.dear}</p>
      <p>{copy.invitation}</p>
      <h2>{copy.promises.join("\n")}</h2>
      <p>{copy.celebration}</p>
      <span>✦</span>
      <h2>{copy.date}</h2>
      <p>
        {copy.time}
        <br />
        {copy.venue}
      </p>
      <span>✦</span>
      <blockquote>{copy.quote}</blockquote>
      <span>✦</span>
      <p>{copy.dawn}</p>
      <span>✦</span>
      <p>{copy.love}</p>
    </article>
  );
}
