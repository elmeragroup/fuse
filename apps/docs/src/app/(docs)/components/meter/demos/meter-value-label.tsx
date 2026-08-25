"use client";

import { Meter } from "@elmeragroup/ui/meter";

export function MeterValueLabel() {
  return <Meter label="Storage used" value={82} maxValue={120} valueLabel="82 of 120 GB" />;
}
