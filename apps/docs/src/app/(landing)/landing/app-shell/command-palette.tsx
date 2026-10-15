"use client";

import { useMemo, useState } from "react";
import type { ComponentType, ReactElement, RefObject } from "react";

import { tv } from "tailwind-variants";

import { Command } from "@elmeragroup/fuse/command";
import { Plus, SidebarSimple, SlidersHorizontal } from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import { Kbd } from "@elmeragroup/fuse/kbd";

import { useDashboard } from "./dashboard-context";
import { ORDER_STATUSES } from "./dashboard-orders";
import type { OrderStatus } from "./dashboard-orders";
import { VIEW_ENTRIES } from "./dashboard-views";
import { OrderStatusIcon } from "./order-status-icon";

const commandPalette = tv({
  slots: {
    // The palette sits high in the window, as Linear's does, and keeps one width.
    popup: "max-w-lg top-16",
    label: "min-w-0 flex-1 truncate",
    hint: "text-xs shrink-0 text-muted-foreground tabular-nums in-data-highlighted:text-accent-foreground",
    mark: "flex size-4 shrink-0 items-center justify-center text-muted-foreground in-data-highlighted:text-accent-foreground",
  },
});

const styles = commandPalette();

/** What a result leads with: an action's or view's icon, or an order's status. */
type CommandMark =
  | { readonly _tag: "Icon"; readonly icon: ComponentType<ElmeraIconProps> }
  | { readonly _tag: "Status"; readonly status: OrderStatus };

/** A command's shortcut: the caps it shows and the `aria-keyshortcuts` value of its row. */
type CommandShortcut = { readonly keys: readonly string[]; readonly aria: string };

type DashboardCommand = {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly keywords: string;
  readonly mark: CommandMark;
  readonly shortcut?: CommandShortcut;
  readonly run: () => void;
};

type CommandGroup = {
  readonly value: "Actions" | "Views" | "Orders";
  readonly items: readonly DashboardCommand[];
};

/** With nothing typed, the palette lists only the newest orders. */
const IDLE_ORDERS = 5;

function useCommandGroups(): readonly CommandGroup[] {
  const { state, navigate, openOrder, openNewOrder, toggleSidebar, dispatch } = useDashboard();
  return useMemo(() => {
    const actions: DashboardCommand[] = [
      {
        key: "new",
        label: "New order",
        hint: "",
        keywords: "create draft",
        mark: { _tag: "Icon", icon: Plus },
        shortcut: { keys: ["C"], aria: "C" },
        run: openNewOrder,
      },
      {
        key: "sidebar",
        label: "Toggle sidebar",
        hint: "",
        keywords: "collapse expand",
        mark: { _tag: "Icon", icon: SidebarSimple },
        shortcut: { keys: ["⌘", "B"], aria: "Meta+B Control+B" },
        run: toggleSidebar,
      },
      {
        key: "grouping",
        label: state.grouping === "status" ? "Stop grouping by status" : "Group by status",
        hint: "",
        keywords: "display view",
        mark: { _tag: "Icon", icon: SlidersHorizontal },
        run: () => {
          dispatch({ _tag: "Group", grouping: state.grouping === "status" ? "none" : "status" });
        },
      },
    ];
    const views = VIEW_ENTRIES.map((entry): DashboardCommand => ({
      key: `view-${entry.view}`,
      label: `Go to ${entry.label}`,
      hint: "",
      keywords: entry.view,
      mark: { _tag: "Icon", icon: entry.icon },
      run: () => {
        navigate({ _tag: "Open", view: entry.view });
      },
    }));
    const orders = state.orders
      .toSorted((left, right) => Date.parse(right.created) - Date.parse(left.created))
      .map((order): DashboardCommand => ({
        key: `order-${String(order.id)}`,
        label: order.customer,
        hint: `${String(order.id)} · ${ORDER_STATUSES[order.status].label}`,
        keywords: `${order.meterPointId} ${order.address} ${order.product}`,
        mark: { _tag: "Status", status: order.status },
        run: () => {
          openOrder(order.id);
        },
      }));
    return [
      { value: "Actions", items: actions },
      { value: "Views", items: views },
      { value: "Orders", items: orders },
    ];
  }, [state.orders, state.grouping, navigate, openOrder, openNewOrder, toggleSidebar, dispatch]);
}

/** Every word of the query appears in the label, the hint or the keywords, in Norwegian case. */
function matches(command: DashboardCommand, words: readonly string[]): boolean {
  const haystack = `${command.label} ${command.hint} ${command.keywords}`.toLocaleLowerCase("nb-NO");
  return words.every((word) => haystack.includes(word));
}

/**
 * The groups for a query, empty groups left out. With nothing typed only the newest orders show.
 * The match is the Dashboard's own, so Base UI's filter is off.
 */
function filterGroups(groups: readonly CommandGroup[], query: string): readonly CommandGroup[] {
  const words = query
    .trim()
    .toLocaleLowerCase("nb-NO")
    .split(/\s+/u)
    .filter((word) => word !== "");
  return groups
    .map((group) => {
      const found = group.items.filter((command) => matches(command, words));
      return {
        value: group.value,
        items: words.length === 0 && group.value === "Orders" ? found.slice(0, IDLE_ORDERS) : found,
      };
    })
    .filter((group) => group.items.length > 0);
}

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus returns on close: the control that opened the palette. */
  finalFocus: RefObject<HTMLElement | null>;
  /** The popup element, so openers can tell focus inside the palette from focus outside it. */
  popup: RefObject<HTMLDivElement | null>;
};

/**
 * The window's palette: jump to an order, open a view or run an action. Its buttons and `/` open
 * it; ⌘K and Ctrl+K belong to the site's own palette. It is Fuse's `Command` in a dialog, with the
 * query held here so the Dashboard's matcher can list the newest orders on an empty query.
 */
export function CommandPalette({ open, onOpenChange, finalFocus, popup }: CommandPaletteProps): ReactElement {
  const groups = useCommandGroups();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterGroups(groups, query), [groups, query]);
  return (
    <Command.Root
      grouped
      items={shown}
      filter={null}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(command) => command.label}
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        // Every opening starts with an empty query, as an uncontrolled one would.
        if (!isOpen) {
          setQuery("");
        }
      }}>
      <Command.Content ref={popup} finalFocus={finalFocus} className={styles.popup()}>
        <Command.Input
          aria-label="Search orders, views and actions"
          placeholder="Search orders, views and actions"
        />
        <Command.Empty>Nothing matches “{query}”.</Command.Empty>
        <Command.List>
          {(group: CommandGroup) => (
            <Command.Group key={group.value} items={group.items}>
              <Command.Label>{group.value}</Command.Label>
              <Command.Collection>
                {(command: DashboardCommand) => (
                  <Command.Item
                    key={command.key}
                    value={command}
                    aria-keyshortcuts={command.shortcut?.aria}
                    onClick={() => {
                      onOpenChange(false);
                      command.run();
                    }}>
                    <span className={styles.mark()}>
                      <CommandMarkIcon mark={command.mark} />
                    </span>
                    <span className={styles.label()}>{command.label}</span>
                    {command.hint === "" ? null : <span className={styles.hint()}>{command.hint}</span>}
                    {command.shortcut === undefined ? null : (
                      <Command.Shortcut>
                        {command.shortcut.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </Command.Shortcut>
                    )}
                  </Command.Item>
                )}
              </Command.Collection>
            </Command.Group>
          )}
        </Command.List>
      </Command.Content>
    </Command.Root>
  );
}

function CommandMarkIcon({ mark }: { mark: CommandMark }): ReactElement {
  if (mark._tag === "Status") {
    return <OrderStatusIcon status={mark.status} />;
  }
  const Icon = mark.icon;
  return <Icon />;
}
