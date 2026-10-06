"use client";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

const EVENTS = Array.from({ length: 16 }, (_, index) => `Meter reading ${String(index + 1)} received`);

export function ScrollAreaMaxHeight() {
  return (
    <ScrollArea.Root className="max-h-72 rounded-md border">
      <ul className="flex flex-col gap-2 p-4">
        {EVENTS.map((event) => (
          <li key={event} className="text-sm">
            {event}
          </li>
        ))}
      </ul>
    </ScrollArea.Root>
  );
}
