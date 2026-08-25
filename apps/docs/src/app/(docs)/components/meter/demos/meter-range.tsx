"use client";

import { Meter } from "@elmeragroup/ui/meter";

export function MeterRange() {
  return (
    <div className="flex flex-col gap-3">
      <Meter label="Storage used" value={82} minValue={0} maxValue={120} />
      <Meter label="Storage used" value={130} minValue={0} maxValue={120} />
    </div>
  );
}
