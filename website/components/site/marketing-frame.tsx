import type { ReactNode } from "react";

import { PageFrame } from "@/components/site/page-frame";

type MarketingFrameProps = {
  children: ReactNode;
};

export function MarketingFrame(props: MarketingFrameProps) {
  return <PageFrame>{props.children}</PageFrame>;
}
