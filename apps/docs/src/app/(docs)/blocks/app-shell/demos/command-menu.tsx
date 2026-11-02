"use client";

/**
 * The command menu: ⌘K or Ctrl+K anywhere in the app, or the header's search button, opens it. It
 * goes to every page and runs the app's actions, and it matches every word typed against each
 * command's name and keywords.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactElement } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";
import { Link as LinkIcon, MagnifyingGlass, Moon, SidebarSimple, Sun } from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";
import { useSidebar } from "@elmeragroup/fuse/sidebar";
import { useColorScheme } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { APP_PAGES } from "./app-config";

type MenuCommand = {
  readonly id: string;
  readonly label: string;
  readonly keywords: string;
  readonly icon: ComponentType<ElmeraIconProps>;
  /** The keys that run it without the menu, as its row shows them. */
  readonly keys?: readonly string[];
  /** The route a page command opens; actions stay on the page. */
  readonly route?: string;
  readonly run: () => void;
};

type MenuGroup = { readonly value: "Pages" | "Actions"; readonly items: readonly MenuCommand[] };

function subscribeNever(): () => void {
  return () => undefined;
}

/** Whether the visitor is on an Apple platform, whose command key is ⌘. The server assumes so. */
function useApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/u.test(navigator.userAgent),
    () => true
  );
}

/** Whether a command's name or keywords hold every word of the query. */
function matches(command: MenuCommand, query: string): boolean {
  const haystack = `${command.label} ${command.keywords}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/u)
    .every((word) => haystack.includes(word));
}

function useCommands(): readonly MenuGroup[] {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const { resolvedColorScheme, setColorScheme } = useColorScheme();
  const toasts = Toast.useToastManager();
  const apple = useApplePlatform();
  return useMemo(() => {
    const dark = resolvedColorScheme === "dark";
    return [
      {
        value: "Pages",
        items: APP_PAGES.map((page) => ({
          id: `page:${page.href}`,
          label: page.label,
          keywords: page.keywords,
          icon: page.icon,
          route: page.href,
          run: () => {
            router.push(page.href);
          },
        })),
      },
      {
        value: "Actions",
        items: [
          {
            id: "toggle-sidebar",
            label: "Toggle sidebar",
            keywords: "collapse expand navigation",
            icon: SidebarSimple,
            keys: [apple ? "⌘" : "Ctrl", "B"],
            run: toggleSidebar,
          },
          {
            id: "appearance",
            label: dark ? "Switch to light appearance" : "Switch to dark appearance",
            keywords: "theme color scheme mode",
            icon: dark ? Sun : Moon,
            run: () => {
              setColorScheme(dark ? "light" : "dark");
            },
          },
          {
            id: "copy-link",
            label: "Copy link to this page",
            keywords: "url share address",
            icon: LinkIcon,
            run: () => {
              navigator.clipboard.writeText(window.location.href).then(
                () => toasts.add({ type: "success", title: "Link copied" }),
                () => toasts.add({ type: "error", title: "Could not copy the link" })
              );
            },
          },
        ],
      },
    ];
  }, [router, toggleSidebar, resolvedColorScheme, setColorScheme, toasts, apple]);
}

/** The header's search button and the command menu it opens. */
export function CommandMenu(): ReactElement {
  const [open, setOpen] = useState(false);
  const groups = useCommands();
  const apple = useApplePlatform();
  const pathname = usePathname();
  // Whether the last command left for another page. The shell then focuses the new page's title,
  // so the closing menu must not hand focus back to its trigger in the header.
  const leaving = useRef(false);
  // Each opening starts on the page it opened on, however it opened: the trigger or ⌘K.
  useEffect(() => {
    if (open) leaving.current = false;
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <Command.Root
      grouped
      items={groups}
      itemToStringValue={(command) => command.label}
      filter={(command, query) => matches(command, query)}
      open={open}
      onOpenChange={setOpen}>
      <Command.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            className="sm:w-56 sm:justify-start"
          />
        }>
        <MagnifyingGlass data-icon="inline-start" />
        <span className="sm:inline hidden">Search…</span>
        <KbdGroup className="sm:inline-flex ml-auto hidden">
          <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Command.Trigger>
      <Command.Content finalFocus={() => !leaving.current}>
        <Command.Input aria-label="Search pages and actions" placeholder="Search pages and actions" />
        <Command.Empty>No page or action matches.</Command.Empty>
        <Command.List>
          {(group: MenuGroup) => (
            <Command.Group key={group.value} items={group.items}>
              <Command.Label>{group.value}</Command.Label>
              <Command.Collection>
                {(command: MenuCommand) => {
                  const Icon = command.icon;
                  return (
                    <Command.Item
                      key={command.id}
                      value={command}
                      onClick={() => {
                        leaving.current = command.route !== undefined && command.route !== pathname;
                        setOpen(false);
                        command.run();
                      }}>
                      <Icon />
                      {command.label}
                      {command.keys === undefined ? null : (
                        <Command.Shortcut>
                          {command.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </Command.Shortcut>
                      )}
                    </Command.Item>
                  );
                }}
              </Command.Collection>
            </Command.Group>
          )}
        </Command.List>
        <Command.Footer>
          <Command.NavigateHint />
          <Command.SelectHint />
          <Command.CloseHint />
        </Command.Footer>
      </Command.Content>
    </Command.Root>
  );
}
