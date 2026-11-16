"use client";

import { Command } from "@elmeragroup/fuse/command";

type ActionGroup = { readonly value: string; readonly items: readonly string[] };

const GROUPS: readonly ActionGroup[] = [
  { value: "Create", items: ["New customer", "New contract", "Register meter reading"] },
  { value: "Go to", items: ["Customers", "Invoices", "Meter points"] },
];

export function CommandGroups() {
  return (
    <div className="max-w-xl flex w-full flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
      <Command.Root grouped items={GROUPS}>
        <Command.Input />
        <Command.Empty />
        <Command.List>
          {(group: ActionGroup) => (
            <Command.Group key={group.value} items={group.items}>
              <Command.Label>{group.value}</Command.Label>
              <Command.Collection>
                {(action: string) => (
                  <Command.Item key={action} value={action}>
                    {action}
                  </Command.Item>
                )}
              </Command.Collection>
            </Command.Group>
          )}
        </Command.List>
      </Command.Root>
    </div>
  );
}
