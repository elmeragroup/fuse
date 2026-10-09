"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderRange() {
  return (
    <Slider
      label="Price range"
      showValue
      defaultValue={[200, 800]}
      minValue={0}
      maxValue={1000}
      step={50}
      largeStep={200}
      formatOptions={{ style: "currency", currency: "NOK", maximumFractionDigits: 0 }}
    />
  );
}
