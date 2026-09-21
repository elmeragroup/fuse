"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterNeutral() {
  return <Meter label="Upload progress" value={64} mode="neutral" />;
}
