"use client";

import { Frame } from "@elmeragroup/fuse/frame";

function ThreePanels() {
  return (
    <>
      <Frame.Panel>March — 1 240 kWh</Frame.Panel>
      <Frame.Panel>April — 980 kWh</Frame.Panel>
      <Frame.Panel>May — 1 105 kWh</Frame.Panel>
    </>
  );
}

export function FrameStackedPanels() {
  return (
    <div className="md:grid-cols-2 grid gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">stackedPanels</p>
        <Frame.Root stackedPanels>
          <ThreePanels />
        </Frame.Root>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Default gutter</p>
        <Frame.Root>
          <ThreePanels />
        </Frame.Root>
      </div>
    </div>
  );
}
