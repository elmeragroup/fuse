"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderDisabled() {
  return <Slider label="Volume" isDisabled showValue defaultValue={60} />;
}
