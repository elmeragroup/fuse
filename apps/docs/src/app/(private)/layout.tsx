import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { DocumentRoot } from "../../components/document-root";
import "../../styles/globals.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export type PrivateLayoutProps = {
  children: ReactNode;
};

export default function PrivateLayout({ children }: PrivateLayoutProps): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 bg-background text-foreground">{children}</body>
    </DocumentRoot>
  );
}
