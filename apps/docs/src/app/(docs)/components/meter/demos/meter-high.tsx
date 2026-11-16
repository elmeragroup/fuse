"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterHigh() {
  return <Meter label="Storage used" value={85} />;
}
