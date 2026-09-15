import Experience from "@/components/experience/Experience";
import StaticInvitation from "@/components/ui/StaticInvitation";
export default function Page() {
  return (
    <>
      <Experience />
      <noscript>
        <style>{"#journey{display:none}"}</style>
        <StaticInvitation />
      </noscript>
    </>
  );
}
