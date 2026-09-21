"use client";

import { Meter } from "@elmeragroup/fuse/meter";

export function MeterBasic() {
  return <Meter label="Storage used" value={42} />;
}
