"use client";

import { useState } from "react";

import { Command } from "@elmeragroup/fuse/command";
import { Kbd } from "@elmeragroup/fuse/kbd";

type Action = {
  readonly label: string;
  /** The letter that runs the action with Alt while the palette has focus. */
  readonly key: string;
};

type ActionGroup = { readonly value: string; readonly items: readonly Action[] };

const GROUPS: readonly ActionGroup[] = [
  {
    value: "Create",
    items: [
      { label: "New customer", key: "N" },
      { label: "New contract", key: "C" },
      { label: "Register meter reading", key: "R" },
    ],
  },
  {
    value: "Go to",
    items: [
      { label: "Customers", key: "U" },
      { label: "Invoices", key: "I" },
      { label: "Meter points", key: "M" },
    ],
  },
];

const ACTIONS = GROUPS.flatMap((group) => group.items);

/** A palette on the page itself. The box around it is the app's; Command.Content draws its own. */
export function CommandGroups() {
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="max-w-xl flex w-full flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
        <Command.Root grouped items={GROUPS}>
          <Command.Input
            aria-label="Search actions"
            placeholder="Search actions…"
            onKeyDown={(event) => {
              // `code` names the physical key, so the shortcut still matches on keyboard layouts
              // where Alt types a symbol.
              const action = ACTIONS.find((candidate) => event.code === `Key${candidate.key}`);
              if (event.altKey && action !== undefined) {
                event.preventDefault();
                setLastRun(action.label);
              }
            }}
          />
          <Command.Empty />
          <Command.List>
            {(group: ActionGroup) => (
              <Command.Group key={group.value} items={group.items}>
                <Command.Label>{group.value}</Command.Label>
                <Command.Collection>
                  {(action: Action) => (
                    <Command.Item
                      key={action.label}
                      value={action}
                      aria-keyshortcuts={`Alt+${action.key}`}
                      onClick={() => {
                        setLastRun(action.label);
                      }}>
                      {action.label}
                      <Command.Shortcut>
                        <Kbd>Alt</Kbd>
                        <Kbd>{action.key}</Kbd>
                      </Command.Shortcut>
                    </Command.Item>
                  )}
                </Command.Collection>
              </Command.Group>
            )}
          </Command.List>
        </Command.Root>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No action run yet." : `Ran: ${lastRun}`}
      </p>
    </div>
  );
}
