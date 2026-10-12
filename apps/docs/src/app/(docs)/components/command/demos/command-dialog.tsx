"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";

const COMMANDS = [
  "New customer",
  "Register meter reading",
  "Create credit note",
  "Open invoices",
  "Open contracts",
  "Open settings",
];

export function CommandDialog() {
  const [open, setOpen] = useState(false);
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="flex flex-col items-start gap-3">
      <Command.Root items={COMMANDS} open={open} onOpenChange={setOpen}>
        <Command.Trigger render={<Button variant="outline" />}>Open command palette</Command.Trigger>
        <Command.Content>
          <Command.Input />
          <Command.Empty />
          <Command.List>
            {(command: string) => (
              <Command.Item
                key={command}
                value={command}
                onClick={() => {
                  setLastRun(command);
                  setOpen(false);
                }}>
                {command}
              </Command.Item>
            )}
          </Command.List>
          <Command.Footer>
            <Command.NavigateHint />
            <Command.SelectHint>Run</Command.SelectHint>
            <Command.CloseHint />
          </Command.Footer>
        </Command.Content>
      </Command.Root>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No command run yet." : `Ran: ${lastRun}`}
      </p>
    </div>
  );
}
