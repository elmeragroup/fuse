"use client";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderVertical() {
  return (
    <div className="flex h-60 gap-8">
      <Slider label="Bass" orientation="vertical" defaultValue={60} />
      <Slider label="Mid" orientation="vertical" defaultValue={45} />
      <Slider label="Treble" orientation="vertical" defaultValue={70} />
    </div>
  );
}
