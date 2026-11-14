"use client";

import { Command } from "@elmeragroup/fuse/command";

const COMMANDS = ["New customer", "Register meter reading", "Create credit note", "Open invoices"];

/** A palette on the page itself. The box around it is the app's; Command.Content draws its own. */
export function CommandDemo() {
  return (
    <div className="max-w-xl flex w-full flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
      <Command.Root items={COMMANDS}>
        <Command.Input />
        <Command.Empty />
        <Command.List>
          {(command: string) => (
            <Command.Item key={command} value={command}>
              {command}
            </Command.Item>
          )}
        </Command.List>
        <Command.Footer>
          <Command.NavigateHint />
          <Command.SelectHint />
        </Command.Footer>
      </Command.Root>
    </div>
  );
}
