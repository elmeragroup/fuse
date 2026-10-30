"use client";

import { Frame } from "@elmeragroup/fuse/frame";

const LAYOUTS = ["gutter", "stacked", "flush"] as const;

export function FrameLayouts() {
  return (
    <div className="md:grid-cols-3 grid gap-6">
      {LAYOUTS.map((layout) => (
        <div key={layout} className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{layout}</p>
          <Frame.Root layout={layout}>
            <Frame.Panel>March — 1 240 kWh</Frame.Panel>
            <Frame.Panel>April — 980 kWh</Frame.Panel>
            <Frame.Panel>May — 1 105 kWh</Frame.Panel>
          </Frame.Root>
        </div>
      ))}
    </div>
  );
}
