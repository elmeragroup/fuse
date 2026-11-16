"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderRange() {
  return <Slider label="Price range" showValue defaultValue={[200, 800]} maxValue={1000} step={50} />;
}
