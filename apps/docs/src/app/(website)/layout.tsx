import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { DocumentRoot } from "../../components/document-root";
import "../../styles/globals.css";

export type WebsiteLayoutProps = {
  children: ReactNode;
};

export const ensureStatic = "navigation";

/** A reserved root with no content yet, so search engines leave it out, as they do `/private`. */
export const metadata: Metadata = {
  title: "Website · Fuse",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WebsiteLayout({ children }: WebsiteLayoutProps): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 bg-background text-foreground">{children}</body>
    </DocumentRoot>
  );
}
