"use client";

import { useState } from "react";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { Check, Trash } from "@elmeragroup/fuse/icons";

const MESSAGES = ["Meter reading reminder", "New price from 1 April", "Your March invoice"];

export function ActionBarNarrow() {
  const [selected, setSelected] = useState<readonly string[]>(["New price from 1 April"]);

  return (
    <div className="max-w-xs relative min-h-48 w-full">
      <ul className="text-sm flex flex-col gap-2">
        {MESSAGES.map((message) => (
          <li key={message}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(message)}
                onChange={(event) => {
                  setSelected(
                    event.target.checked
                      ? [...selected, message]
                      : selected.filter((name) => name !== message)
                  );
                }}
              />
              {message}
            </label>
          </li>
        ))}
      </ul>
      <ActionBar.Root count={selected.length} aria-label="Message actions">
        <ActionBar.Count />
        <ActionBar.Clear
          onClick={() => {
            setSelected([]);
          }}
        />
        <ActionBar.Separator />
        <ActionBar.Button>
          <Check data-icon="inline-start" />
          <ActionBar.ButtonLabel>Mark as read</ActionBar.ButtonLabel>
        </ActionBar.Button>
        <ActionBar.Button>
          <Trash data-icon="inline-start" />
          <ActionBar.ButtonLabel>Delete</ActionBar.ButtonLabel>
        </ActionBar.Button>
      </ActionBar.Root>
    </div>
  );
}
