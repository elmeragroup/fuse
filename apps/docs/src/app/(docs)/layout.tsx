import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { DocsShell } from "../../components/DocsShell";
import { SkipNav } from "../../components/SkipNav";
import "../../styles/globals.css";
import "./layout.css";

export const metadata: Metadata = {
  title: {
    template: "%s · elmera/ui",
    default: "elmera/ui",
  },
};

export type DocsLayoutProps = {
  children: ReactNode;
};

export default function DocsLayout({ children }: DocsLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body>
        <SkipNav />
        <DocsShell>{children}</DocsShell>
      </body>
    </html>
  );
}
