"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

export function ScrollAreaComposed() {
  return (
    <ScrollAreaPrimitive.Root className="relative h-72 w-96 overflow-hidden rounded-md border">
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
        <ScrollAreaPrimitive.Content>
          <div className="text-sm h-[480px] w-[720px] p-4">
            Two-axis content. Root only ships one bar; compose two <code>ScrollArea.Bar</code>s on the base-ui
            primitive for both axes.
          </div>
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollArea.Bar orientation="vertical" type="always" />
      <ScrollArea.Bar orientation="horizontal" type="always" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
