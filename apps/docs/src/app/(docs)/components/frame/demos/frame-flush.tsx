"use client";

import { Frame } from "@elmeragroup/fuse/frame";

export function FrameFlush() {
  return (
    <Frame.Root layout="flush" className="max-w-sm">
      <Frame.Header>
        <Frame.Title>Consumption</Frame.Title>
        <Frame.Description>Updated every hour</Frame.Description>
      </Frame.Header>
      <Frame.Panel>
        <p className="text-sm font-semibold">Storgata 12</p>
        <p className="text-sm text-muted-foreground">1 240 kWh this month, 8% below March.</p>
      </Frame.Panel>
    </Frame.Root>
  );
}
