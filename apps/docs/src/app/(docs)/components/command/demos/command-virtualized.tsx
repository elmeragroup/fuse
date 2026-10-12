"use client";

import { useState } from "react";

import { Command } from "@elmeragroup/fuse/command";
import { CommandVirtual } from "@elmeragroup/fuse/command-virtual";

type MeterPoint = { readonly id: string; readonly label: string };

const STREETS = [
  "Storgata",
  "Kirkegata",
  "Skolegata",
  "Parkveien",
  "Sjøgata",
  "Strandveien",
  "Elvegata",
  "Bakkegata",
  "Torggata",
  "Havnegata",
];

/** 2,000 meter points: 200 house numbers on each of ten streets. */
const METER_POINTS: readonly MeterPoint[] = STREETS.flatMap((street, streetIndex) =>
  Array.from({ length: 200 }, (_, numberIndex) => {
    const serial = streetIndex * 200 + numberIndex + 1;
    return {
      id: `7070575000${String(serial).padStart(8, "0")}`,
      label: `${street} ${String(numberIndex + 1)}`,
    };
  })
);

export function CommandVirtualized() {
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="max-w-xl flex w-full flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
        <CommandVirtual.Root items={METER_POINTS}>
          <Command.Input aria-label="Search meter points" placeholder="Search 2,000 meter points…" />
          <Command.Empty />
          <CommandVirtual.List>
            {(point: MeterPoint) => (
              <Command.Item
                value={point}
                onClick={() => {
                  setLastRun(point.label);
                }}>
                {point.label}
                <span className="text-xs ms-auto text-muted-foreground tabular-nums">{point.id}</span>
              </Command.Item>
            )}
          </CommandVirtual.List>
          <Command.Footer>
            <Command.NavigateHint />
            <Command.SelectHint>Open</Command.SelectHint>
          </Command.Footer>
        </CommandVirtual.Root>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No meter point opened yet." : `Opened ${lastRun}`}
      </p>
    </div>
  );
}
