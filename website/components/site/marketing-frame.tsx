import type { ReactNode } from "react";

type MarketingFrameProps = {
  children: ReactNode;
};

export function MarketingFrame(props: MarketingFrameProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(41,190,255,0.18),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(23,196,142,0.12),transparent_38%),radial-gradient(circle_at_50%_96%,rgba(73,88,210,0.2),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(96,165,250,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(96,165,250,0.06)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent" />
      <section className="relative z-10 mx-auto w-full max-w-[1240px] space-y-8">{props.children}</section>
    </main>
  );
}
