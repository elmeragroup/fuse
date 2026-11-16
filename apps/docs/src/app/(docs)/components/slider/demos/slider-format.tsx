"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderFormat() {
  return (
    <Slider
      label="Opacity"
      showValue
      defaultValue={0.8}
      maxValue={1}
      step={0.05}
      formatOptions={{ style: "percent" }}
    />
  );
}
