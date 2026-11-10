import type { ReactElement } from "react";

import type { Metadata } from "next";

import { OverviewPage } from "../../../../(docs)/blocks/app-shell/demos/overview-page";
import { PreviewHydrationMarker } from "../../../preview-hydration-marker";

export const metadata: Metadata = { title: "Overview" };

export default function Page(): ReactElement {
  return (
    <>
      <OverviewPage />
      <PreviewHydrationMarker />
    </>
  );
}
