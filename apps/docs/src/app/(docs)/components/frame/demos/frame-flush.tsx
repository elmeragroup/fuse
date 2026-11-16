"use client";

import { Frame } from "@elmeragroup/fuse/frame";

export function FrameFlush() {
  return (
    <Frame.Root layout="flush" className="max-w-md w-full">
      <Frame.Header>
        <Frame.Title>Usage</Frame.Title>
        <Frame.Description>Last three months</Frame.Description>
      </Frame.Header>
      <Frame.Panel>March, 1 240 kWh</Frame.Panel>
      <Frame.Panel>April, 980 kWh</Frame.Panel>
      <Frame.Panel>May, 1 105 kWh</Frame.Panel>
      <Frame.Footer>
        <p>Readings arrive every hour.</p>
      </Frame.Footer>
    </Frame.Root>
  );
}
