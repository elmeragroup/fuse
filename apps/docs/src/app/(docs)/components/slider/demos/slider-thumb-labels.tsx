"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderThumbLabels() {
  return (
    <Slider
      label="Indoor temperature"
      showValue
      defaultValue={[19, 23]}
      minValue={15}
      maxValue={28}
      thumbLabels={["Night temperature", "Day temperature"]}
    />
  );
}
