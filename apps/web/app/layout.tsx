import type { ReactNode } from "react";
import { ConvexProviders } from "./ConvexProviders";

export const metadata = {
  title: "G3netic Crypto",
  description: "Signals platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <ConvexProviders>{children}</ConvexProviders>
      </body>
    </html>
  );
}
