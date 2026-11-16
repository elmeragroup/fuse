"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderVertical() {
  return (
    <div className="h-60">
      <Slider label="Bass" orientation="vertical" defaultValue={60} />
    </div>
  );
}
