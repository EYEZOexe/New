import type { ReactNode } from "react";

type PageFrameProps = {
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  return (
    <main className="site-page">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,201,255,0.2),transparent_33%),radial-gradient(circle_at_84%_8%,rgba(38,227,194,0.14),transparent_40%),radial-gradient(circle_at_52%_102%,rgba(91,118,255,0.22),transparent_45%)]" />
      <div className="pointer-events-none absolute -left-24 -top-8 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 top-12 h-96 w-96 rounded-full bg-teal-500/14 blur-[132px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-500/18 blur-[155px]" />
      <div className="pointer-events-none absolute inset-x-10 top-26 h-28 rounded-[999px] border border-cyan-300/10 bg-cyan-300/8 blur-[76px]" />
      <div className="site-grid-pattern pointer-events-none absolute inset-0 opacity-55" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
      <section className="site-wrap site-animate-in">{props.children}</section>
    </main>
  );
}
