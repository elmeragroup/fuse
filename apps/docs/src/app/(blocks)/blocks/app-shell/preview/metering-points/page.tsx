import type { ReactElement } from "react";

import type { Metadata } from "next";

import { MeteringPointsPage } from "../../../../../(docs)/blocks/app-shell/demos/metering-points-page";

export const metadata: Metadata = { title: "Metering points" };

export default function Page(): ReactElement {
  return <MeteringPointsPage />;
}
