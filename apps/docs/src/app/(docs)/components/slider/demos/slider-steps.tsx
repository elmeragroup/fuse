"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderSteps() {
  return <Slider label="Corner radius" showValue defaultValue={8} maxValue={24} step={2} largeStep={8} />;
}
