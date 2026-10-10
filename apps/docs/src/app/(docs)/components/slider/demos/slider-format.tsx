"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderFormat() {
  return (
    <div className="flex flex-col gap-6">
      <Slider
        label="Opacity"
        showValue
        defaultValue={0.8}
        minValue={0}
        maxValue={1}
        step={0.05}
        largeStep={0.25}
        formatOptions={{ style: "percent" }}
      />
      <Slider
        label="Corner radius (px)"
        showValue
        defaultValue={8}
        minValue={0}
        maxValue={24}
        step={2}
        largeStep={4}
      />
    </div>
  );
}
