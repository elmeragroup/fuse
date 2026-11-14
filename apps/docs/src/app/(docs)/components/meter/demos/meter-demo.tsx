"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterDemo() {
  return <Meter label="Storage used" value={42} />;
}
