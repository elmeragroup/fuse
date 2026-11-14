"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderDescription() {
  return <Slider label="Volume" description="The master output level." defaultValue={60} />;
}
