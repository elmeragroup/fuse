"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterExceeded() {
  return <Meter label="Storage used" value={130} maxValue={120} />;
}
