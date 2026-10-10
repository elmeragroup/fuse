"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderDisabled() {
  return <Slider label="Brightness" showValue isDisabled defaultValue={40} />;
}
