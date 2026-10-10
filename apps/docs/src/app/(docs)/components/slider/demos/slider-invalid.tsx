"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderInvalid() {
  return (
    <Slider
      label="Monthly budget"
      showValue
      isInvalid
      errorMessage="Keep the budget at 80% or less."
      defaultValue={0.95}
      minValue={0}
      maxValue={1}
      step={0.05}
      formatOptions={{ style: "percent" }}
    />
  );
}
