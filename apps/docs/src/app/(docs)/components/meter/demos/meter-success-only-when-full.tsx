"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterSuccessOnlyWhenFull() {
  return <Meter label="Profile complete" value={100} mode="success-only-when-full" />;
}
