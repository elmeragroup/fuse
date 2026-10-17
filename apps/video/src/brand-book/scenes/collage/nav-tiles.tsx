import type { ReactElement } from "react";

import { Command } from "@elmeragroup/fuse/command";
import { ChartBar, House, Package, Receipt, Users } from "@elmeragroup/fuse/icons";
import { Sidebar } from "@elmeragroup/fuse/sidebar";

import { useCopy } from "../../../copy/copy";

/** The sidebar's icons, in the order the copy names its items. */
const SIDEBAR_ICONS = [House, Package, Users, Receipt, ChartBar] as const;

/** An internal app's sidebar, the orders page current. */
export function SidebarTile(): ReactElement {
  const { sidebar } = useCopy().brandBook.collage;
  return (
    // The sidebar's container is fixed to its plate, which the plate's transform contains; the
    // wrapper's paint containment keeps it inside the plate's frame, as the docs demo does.
    <div className="relative -mx-5 -mt-5 h-[calc(100%+1.25rem)] overflow-hidden contain-paint">
      <Sidebar.Provider defaultOpen className="min-h-full">
        <Sidebar.Root className="h-full">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>{sidebar.group}</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {sidebar.items.map((label, index) => {
                    const Icon = SIDEBAR_ICONS[index] ?? House;
                    return (
                      <Sidebar.MenuItem key={label}>
                        <Sidebar.MenuButton isActive={index === 1}>
                          <Icon aria-hidden />
                          <span>{label}</span>
                        </Sidebar.MenuButton>
                      </Sidebar.MenuItem>
                    );
                  })}
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
        </Sidebar.Root>
      </Sidebar.Provider>
    </div>
  );
}

/** A command palette inline on the page, filtered by its query. */
export function CommandTile(): ReactElement {
  const { command } = useCopy().brandBook.collage;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
      <Command.Root items={command.items} value={command.query}>
        <Command.Input aria-label={command.placeholder} placeholder={command.placeholder} />
        <Command.Empty />
        <Command.List>
          {(item: string) => (
            <Command.Item key={item} value={item}>
              {item}
            </Command.Item>
          )}
        </Command.List>
      </Command.Root>
    </div>
  );
}
