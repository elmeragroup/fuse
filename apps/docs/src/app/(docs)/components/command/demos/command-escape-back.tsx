"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";

type SettingPage = "language" | "theme";

type Setting = { readonly label: string; readonly page: SettingPage };

const SETTINGS: readonly Setting[] = [
  { label: "Language", page: "language" },
  { label: "Theme", page: "theme" },
];

const OPTIONS = {
  language: ["Norsk bokmål", "Svenska", "Suomi", "English"],
  theme: ["Light", "Dark", "Match the system"],
} satisfies Record<SettingPage, readonly string[]>;

const FIRST_PAGE = ["settings"];

/**
 * Escape goes back a page and closes the palette only from the first page. The demo controls the
 * stack, and the Root's `onOpenChange` cancels an Escape close while there is a page to go back
 * to. The same handler sets the stack back to the first page each time the palette opens.
 */
export function CommandEscapeBack() {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState(FIRST_PAGE);
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="flex flex-col items-start gap-3">
      <Command.Root
        open={open}
        pages={stack}
        onPagesChange={setStack}
        onOpenChange={(next, details) => {
          if (!next && details.reason === "escape-key" && stack.length > 1) {
            details.cancel();
            setStack(stack.slice(0, -1));
            return;
          }
          if (next) {
            setStack(FIRST_PAGE);
          }
          setOpen(next);
        }}>
        <Command.Trigger render={<Button variant="outline" />}>Change settings</Command.Trigger>
        <Command.Content>
          <Command.Page id="settings" label="Settings" items={SETTINGS}>
            <Command.Input />
            <Command.Empty />
            <Command.List>
              {(setting: Setting) => (
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
          </Command.Page>
          {SETTINGS.map((setting) => (
            <Command.Page
              key={setting.page}
              id={setting.page}
              label={setting.label}
              items={OPTIONS[setting.page]}>
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
            </Command.Page>
          ))}
        </Command.Content>
      </Command.Root>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No setting changed yet." : `Changed ${lastRun}`}
      </p>
    </div>
  );
}
