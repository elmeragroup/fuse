"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterInverted() {
  return <Meter label="Battery charge" value={40} mode="inverted" />;
}
