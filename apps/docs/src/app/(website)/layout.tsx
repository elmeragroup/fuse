import type { ReactElement, ReactNode } from "react";

import { DocumentRoot } from "../../components/document-root";
import "../../styles/globals.css";

export type WebsiteLayoutProps = {
  children: ReactNode;
};

export default function WebsiteLayout({ children }: WebsiteLayoutProps): ReactElement {
  return (
    <DocumentRoot>
      <body>{children}</body>
    </DocumentRoot>
  );
}
