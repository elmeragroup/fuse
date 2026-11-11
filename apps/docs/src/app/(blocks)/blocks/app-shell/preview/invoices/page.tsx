import type { ReactElement } from "react";

import type { Metadata } from "next";

import { InvoicesPage } from "../../../../../(docs)/blocks/app-shell/demos/invoices-page";
import { PreviewHydrationMarker } from "../../../../preview-hydration-marker";

export const metadata: Metadata = { title: "Invoices" };

export default function Page(): ReactElement {
  return (
    <>
      <InvoicesPage />
      <PreviewHydrationMarker />
    </>
  );
}
