"use client";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

const READINGS = Array.from({ length: 24 }, (_, index) => `Meter reading ${String(index + 1)} received`);

export function ScrollAreaAuto() {
  return (
    <ScrollArea.Root type="auto" className="h-72 w-64 rounded-md border">
      <ul className="flex flex-col gap-2 p-4">
        {READINGS.map((reading) => (
          <li key={reading} className="text-sm">
            {reading}
          </li>
        ))}
      </ul>
    </ScrollArea.Root>
  );
}
