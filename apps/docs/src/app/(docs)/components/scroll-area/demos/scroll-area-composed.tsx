"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

export function ScrollAreaComposed() {
  return (
    <ScrollAreaPrimitive.Root className="relative h-72 w-96 overflow-hidden rounded-md border">
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
        <ScrollAreaPrimitive.Content>
          <div className="text-sm h-[480px] w-[720px] p-4">
            Content wider and taller than the area scrolls on both axes, with one bar for each.
          </div>
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollArea.Bar orientation="vertical" type="always" />
      <ScrollArea.Bar orientation="horizontal" type="always" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
