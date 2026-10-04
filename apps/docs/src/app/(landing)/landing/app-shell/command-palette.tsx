"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, KeyboardEvent, ReactElement, RefObject } from "react";

import { tv } from "tailwind-variants";

import { Dialog } from "@elmeragroup/fuse/dialog";
import { MagnifyingGlass, Plus, SidebarSimple, SlidersHorizontal } from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

import { useDashboard } from "./dashboard-context";
import { ORDER_STATUSES } from "./dashboard-orders";
import type { OrderStatus } from "./dashboard-orders";
import { VIEW_ENTRIES } from "./dashboard-views";
import { Kbd } from "./kbd";
import { OrderStatusIcon } from "./order-status-icon";

const commandPalette = tv({
  slots: {
    // The palette sits high in the window, as Linear's does, and keeps one width.
    popup: "max-w-lg top-16 w-full translate-y-0",
    list: "m-0 -mx-2 max-h-80 list-none overflow-y-auto p-0",
    groupList: "m-0 list-none p-0",
    group: "text-xs font-medium px-2 pt-3 pb-1 text-muted-foreground",
    option:
      "text-sm flex min-h-9 cursor-default items-center gap-3 rounded-md px-2 text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground",
    optionLabel: "min-w-0 flex-1 truncate",
    optionHint: "text-xs shrink-0 text-muted-foreground tabular-nums",
    optionIcon: "flex size-4 shrink-0 items-center justify-center text-muted-foreground",
    empty: "text-sm m-0 px-2 py-6 text-center text-muted-foreground",
  },
});

const styles = commandPalette();

/** What a result leads with: an action's or view's icon, or an order's status. */
type CommandMark =
  | { readonly _tag: "Icon"; readonly icon: ComponentType<ElmeraIconProps> }
  | { readonly _tag: "Status"; readonly status: OrderStatus };

type Command = {
  readonly key: string;
  readonly group: "Actions" | "Views" | "Orders";
  readonly label: string;
  readonly hint: string;
  readonly keywords: string;
  readonly mark: CommandMark;
  readonly shortcut: readonly string[];
  readonly run: () => void;
};

const GROUPS = ["Actions", "Views", "Orders"] as const;
/** With nothing typed, the palette lists only the newest orders. */
const IDLE_ORDERS = 5;

function useCommands(): readonly Command[] {
  const { state, navigate, openOrder, openNewOrder, toggleSidebar, dispatch } = useDashboard();
  return useMemo(() => {
    const actions: Command[] = [
      {
        key: "new",
        group: "Actions",
        label: "New order",
        hint: "",
        keywords: "create draft",
        mark: { _tag: "Icon", icon: Plus },
        shortcut: ["C"],
        run: openNewOrder,
      },
      {
        key: "sidebar",
        group: "Actions",
        label: "Toggle sidebar",
        hint: "",
        keywords: "collapse expand",
        mark: { _tag: "Icon", icon: SidebarSimple },
        shortcut: ["⌘", "B"],
        run: toggleSidebar,
      },
      {
        key: "grouping",
        group: "Actions",
        label: state.grouping === "status" ? "Stop grouping by status" : "Group by status",
        hint: "",
        keywords: "display view",
        mark: { _tag: "Icon", icon: SlidersHorizontal },
        shortcut: [],
        run: () => {
          dispatch({ _tag: "Group", grouping: state.grouping === "status" ? "none" : "status" });
        },
      },
    ];
    const views: Command[] = VIEW_ENTRIES.map((entry) => ({
      key: `view-${entry.view}`,
      group: "Views",
      label: `Go to ${entry.label}`,
      hint: "",
      keywords: entry.view,
      mark: { _tag: "Icon", icon: entry.icon },
      shortcut: [],
      run: () => {
        navigate({ _tag: "Open", view: entry.view });
      },
    }));
    const orders: Command[] = state.orders
      .toSorted((left, right) => Date.parse(right.created) - Date.parse(left.created))
      .map((order) => ({
        key: `order-${String(order.id)}`,
        group: "Orders",
        label: order.customer,
        hint: `${String(order.id)} · ${ORDER_STATUSES[order.status].label}`,
        keywords: `${order.meterPointId} ${order.address} ${order.product}`,
        mark: { _tag: "Status", status: order.status },
        shortcut: [],
        run: () => {
          openOrder(order.id);
        },
      }));
    return [...actions, ...views, ...orders];
  }, [state.orders, state.grouping, navigate, openOrder, openNewOrder, toggleSidebar, dispatch]);
}

function matches(command: Command, query: string): boolean {
  const haystack = `${command.label} ${command.hint} ${command.keywords}`.toLocaleLowerCase("nb-NO");
  return query
    .toLocaleLowerCase("nb-NO")
    .split(/\s+/u)
    .every((word) => haystack.includes(word));
}

/** Keeps the active option in view as the arrows walk past the list's edge. */
function useActiveIntoView(activeId: string | undefined): void {
  useLayoutEffect(() => {
    if (activeId !== undefined) {
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId]);
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
 * The window's ⌘K palette: jump to an order, open a view or run an action. Fuse has no Command
 * part yet (TODO.md), so this composes Dialog with the ARIA combobox pattern the docs search
 * uses: focus stays in the field and the arrows move `aria-activedescendant`.
 */
export function CommandPalette({ open, onOpenChange, finalFocus, popup }: CommandPaletteProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  // Counts transitions to open. The search is keyed by it, because the popup stays mounted
  // through its exit animation and a quick reopen would otherwise keep the search.
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOpening(opening + 1);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        ref={popup}
        className={styles.popup()}
        showCloseButton={false}
        initialFocus={input}
        finalFocus={finalFocus}>
        <Dialog.Title className="sr-only">Command palette</Dialog.Title>
        <PaletteSearch
          key={opening}
          input={input}
          onRun={() => {
            onOpenChange(false);
          }}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * The field and its results. The palette keys this by its opening count, so every opening, from
 * any opener and even during the previous exit animation, starts with an empty query and the
 * first result active.
 */
function PaletteSearch({
  input,
  onRun,
}: {
  input: RefObject<HTMLInputElement | null>;
  onRun: () => void;
}): ReactElement {
  const commands = useCommands();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const found = commands.filter((command) => matches(command, query.trim()));
    if (query.trim() !== "") {
      return found;
    }
    const orders = found.filter((command) => command.group === "Orders").slice(0, IDLE_ORDERS);
    return [...found.filter((command) => command.group !== "Orders"), ...orders];
  }, [commands, query]);
  const optionId = (index: number) => `${listId}-${String(index)}`;
  const current = results[active];
  useActiveIntoView(current === undefined ? undefined : optionId(active));

  const run = (command: Command) => {
    onRun();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = results.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => (index >= last ? 0 : index + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => (index <= 0 ? Math.max(last, 0) : index - 1));
        return;
      case "Enter":
        if (current !== undefined) {
          event.preventDefault();
          run(current);
        }
        return;
    }
  };

  return (
    <>
      <InputGroup.Root>
        <InputGroup.Addon>
          <MagnifyingGlass aria-hidden />
        </InputGroup.Addon>
        <InputGroup.Input
          ref={input}
          role="combobox"
          aria-label="Search orders, views and actions"
          aria-autocomplete="list"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={current === undefined ? "" : optionId(active)}
          autoComplete="off"
          placeholder="Search orders, views and actions"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </InputGroup.Root>
      <ul id={listId} role="listbox" aria-label="Results" className={styles.list()}>
        {GROUPS.map((group) => {
          const members = results.filter((command) => command.group === group);
          return members.length === 0 ? null : (
            <li key={group} role="presentation">
              <div role="presentation" className={styles.group()}>
                {group}
              </div>
              <ul role="group" aria-label={group} className={styles.groupList()}>
                {members.map((command) => {
                  const index = results.indexOf(command);
                  return (
                    <li
                      key={command.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      className={styles.option()}
                      onPointerMove={() => {
                        setActive(index);
                      }}
                      onClick={() => {
                        run(command);
                      }}>
                      <span className={styles.optionIcon()}>
                        <CommandMarkIcon mark={command.mark} />
                      </span>
                      <span className={styles.optionLabel()}>{command.label}</span>
                      {command.hint === "" ? null : (
                        <span className={styles.optionHint()}>{command.hint}</span>
                      )}
                      {command.shortcut.length === 0 ? null : <Kbd keys={command.shortcut} />}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      {results.length === 0 ? (
        <p role="status" className={styles.empty()}>
          Nothing matches “{query}”.
        </p>
      ) : null}
    </>
  );
}

function CommandMarkIcon({ mark }: { mark: CommandMark }): ReactElement {
  if (mark._tag === "Status") {
    return <OrderStatusIcon status={mark.status} />;
  }
  const Icon = mark.icon;
  return <Icon />;
}
