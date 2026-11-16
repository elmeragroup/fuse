"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterFull() {
  return <Meter label="Storage used" value={100} />;
}
