import type { ReactElement, ReactNode } from "react";

import { DocumentRoot } from "../../components/document-root";
import "../../styles/globals.css";

export type WebsiteLayoutProps = {
  children: ReactNode;
};

export default function WebsiteLayout({ children }: WebsiteLayoutProps): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 bg-background text-foreground">{children}</body>
    </DocumentRoot>
  );
}
