import type { ReactNode } from "react";

type PageFrameProps = {
  children: ReactNode;
};

export function PageFrame(props: PageFrameProps) {
  return (
    <main className="site-page">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-20 h-80 w-80 rounded-full bg-sky-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[140px]" />
      <div className="site-grid-pattern pointer-events-none absolute inset-0 opacity-70" />
      <section className="site-wrap">{props.children}</section>
    </main>
  );
}
