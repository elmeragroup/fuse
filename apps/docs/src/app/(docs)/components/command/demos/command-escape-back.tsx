"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";
import { Dialog } from "@elmeragroup/fuse/dialog";

const SETTINGS = [
  { label: "Language", page: "language" },
  { label: "Theme", page: "theme" },
] as const;

const OPTIONS = {
  language: ["Norsk bokmål", "Svenska", "Suomi", "English"],
  theme: ["Light", "Dark", "Match the system"],
} as const;

/**
 * Escape goes back a page and closes the palette only from the first page. The stack is
 * controlled, and the dialog cancels an Escape close while there is a page to go back to.
 */
export function CommandEscapeBack() {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState(["settings"]);
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="flex flex-col items-start gap-3">
      <Dialog.Root
        open={open}
        onOpenChange={(next, details) => {
          if (!next && details.reason === "escape-key" && stack.length > 1) {
            details.cancel();
            setStack(stack.slice(0, -1));
            return;
          }
          setOpen(next);
          if (!next) {
            setStack(["settings"]);
          }
        }}>
        <Dialog.Trigger render={<Button variant="outline" />}>Change settings</Dialog.Trigger>
        <Command.Dialog>
          <Command.Pages value={stack} onValueChange={setStack}>
            <Command.Page id="settings" label="Settings">
              <Command.Root items={SETTINGS}>
                <Command.Input />
                <Command.Empty />
                <Command.List>
                  {(setting: (typeof SETTINGS)[number]) => (
                    <Command.PageTrigger key={setting.page} value={setting} page={setting.page}>
                      {setting.label}
                    </Command.PageTrigger>
                  )}
                </Command.List>
                <Command.Footer>
                  <Command.NavigateHint />
                  <Command.SelectHint />
                  <Command.CloseHint />
                </Command.Footer>
              </Command.Root>
            </Command.Page>
            {SETTINGS.map((setting) => (
              <Command.Page key={setting.page} id={setting.page} label={setting.label}>
                <Command.Root items={OPTIONS[setting.page]}>
                  <Command.Input />
                  <Command.Empty />
                  <Command.List>
                    {(option: string) => (
                      <Command.Item
                        key={option}
                        value={option}
                        onClick={() => {
                          setLastRun(`${setting.label}: ${option}`);
                          setOpen(false);
                          setStack(["settings"]);
                        }}>
                        {option}
                      </Command.Item>
                    )}
                  </Command.List>
                  <Command.Footer>
                    <Command.NavigateHint />
                    <Command.SelectHint />
                    <Command.BackHint />
                    <Command.CloseHint>Back</Command.CloseHint>
                  </Command.Footer>
                </Command.Root>
              </Command.Page>
            ))}
          </Command.Pages>
        </Command.Dialog>
      </Dialog.Root>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No setting changed yet." : `Changed ${lastRun}`}
      </p>
    </div>
  );
}
