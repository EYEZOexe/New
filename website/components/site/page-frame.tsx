import type { ReactNode } from "react";

type PageFrameProps = {
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  return (
    <main className="site-page">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(41,190,255,0.14),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(45,216,184,0.1),transparent_42%),radial-gradient(circle_at_52%_100%,rgba(82,108,255,0.2),transparent_45%)]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-500/18 blur-[110px]" />
      <div className="pointer-events-none absolute -right-16 top-16 h-80 w-80 rounded-full bg-teal-500/12 blur-[132px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/18 blur-[150px]" />
      <div className="site-grid-pattern pointer-events-none absolute inset-0 opacity-55" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
      <section className="site-wrap">{props.children}</section>
    </main>
  );
}
