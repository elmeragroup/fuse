"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderBasic() {
  return <Slider label="Volume" description="Master output level." showValue defaultValue={60} />;
}
