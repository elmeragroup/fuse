"use client";

import { useState } from "react";

import { NumberField } from "@elmeragroup/fuse/number-field";
import { Slider } from "@elmeragroup/fuse/slider";

export function SliderLabelLess() {
  const [weight, setWeight] = useState(500);
  return (
    <div className="flex items-center gap-3">
      <Slider
        aria-label="Font weight"
        className="flex-1"
        value={weight}
        onChange={setWeight}
        minValue={100}
        maxValue={900}
        step={100}
      />
      <NumberField
        aria-label="Font weight value"
        className="w-32"
        value={weight}
        onChange={(next) => setWeight(Number.isNaN(next) ? 100 : next)}
        minValue={100}
        maxValue={900}
        step={100}
      />
    </div>
  );
}
