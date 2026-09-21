"use client";

import { Meter } from "@elmeragroup/fuse/meter";

const MODES = ["default", "inverted", "success-only-when-full", "neutral"] as const;

const SAMPLES = [
  { label: "LOW", value: 50 },
  { label: "MEDIUM", value: 85 },
  { label: "FULL", value: 100 },
  { label: "Exceeded", value: 130, maxValue: 120 },
] as const;

export function MeterModes() {
  return (
    <div className="flex flex-col gap-6">
      {MODES.map((mode) => (
        <div key={mode} className="flex flex-col gap-3">
          {SAMPLES.map((sample) => (
            <Meter
              key={`${mode}-${sample.label}`}
              label={`${mode} · ${sample.label}`}
              value={sample.value}
              maxValue={"maxValue" in sample ? sample.maxValue : undefined}
              mode={mode}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
