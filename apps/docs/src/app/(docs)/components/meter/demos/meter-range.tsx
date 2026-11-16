"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterRange() {
  return <Meter label="Indoor temperature" value={21} minValue={15} maxValue={28} />;
}
