"use client";

import { useState } from "react";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { Download } from "@elmeragroup/fuse/icons";

const READINGS = ["January", "February", "March"];

export function ActionBarCountText() {
  const [selected, setSelected] = useState<readonly string[]>(["January", "February"]);

  return (
    <div className="max-w-xl relative min-h-48 w-full">
      <ul className="text-sm flex flex-col gap-2">
        {READINGS.map((month) => (
          <li key={month}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(month)}
                onChange={(event) => {
                  setSelected(
                    event.target.checked ? [...selected, month] : selected.filter((name) => name !== month)
                  );
                }}
              />
              {month} readings
            </label>
          </li>
        ))}
      </ul>
      <ActionBar.Root count={selected.length} aria-label="Reading actions">
        <ActionBar.Count>{selected.length} of 3 months</ActionBar.Count>
        <ActionBar.Clear
          onClick={() => {
            setSelected([]);
          }}
        />
        <ActionBar.Separator />
        <ActionBar.Button>
          <Download data-icon="inline-start" />
          <ActionBar.ButtonLabel>Download</ActionBar.ButtonLabel>
        </ActionBar.Button>
      </ActionBar.Root>
    </div>
  );
}
