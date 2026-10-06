"use client";

import { Suspense, useEffect } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";
import { tv } from "tailwind-variants";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { MagnifyingGlass, SidebarSimple, SlidersHorizontal, X } from "@elmeragroup/fuse/icons";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { BRANDS } from "@elmeragroup/fuse/theme";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { useLandingTheme } from "../landing-theme";
import { SingleToggle } from "../product-parts";
import { useSideOverlay } from "../window-side";
import { BulkToolbar } from "./bulk-toolbar";
import { useDashboard } from "./dashboard-context";
import { visibleOrders } from "./dashboard-state";
import type { Grouping, Scope } from "./dashboard-state";
import { PRIMARY_VIEWS, VIEW_GROUPS, viewEntry } from "./dashboard-views";
import { Kbd } from "./kbd";
import { OrderDetail } from "./order-detail";
import { OrderList } from "./order-list";

const dashboardMain = tv({
  slots: {
    // A size container, so the breadcrumb follows the pane's width. Against the inset rail it
    // reads as a raised panel, the way Sidebar.Inset draws one; Sidebar.Inset itself renders a
    // `<main>`, and the landing already has its own.
    root: "md:m-2 md:ml-0 md:rounded-xl md:shadow-sm md:peer-data-[state=collapsed]:ml-2 @container relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground",
    header: "flex h-12 shrink-0 items-center gap-2 border-b border-border px-3",
    crumbs: "min-w-0",
    crumbHidden: "@xl:inline-flex hidden",
    end: "ml-auto flex items-center gap-1.5",
    // The sidebar carries Search from md; phones get it here instead.
    phoneSearch: "md:hidden",
    filters: "flex h-11 shrink-0 items-center gap-3 border-b border-border px-3",
    total: "text-xs ml-auto text-muted-foreground tabular-nums",
    body: "flex min-h-0 flex-1",
    listColumn: "@container relative flex min-w-0 flex-1 flex-col",
    detail: "w-88 shrink-0 border-l border-border bg-right-panel text-right-panel-foreground",
    detailEmpty: "text-sm flex h-full items-center justify-center p-6 text-center text-muted-foreground",
    tooltipKeys: "ml-2",
  },
});

const styles = dashboardMain();

// Order search's table engine loads apart from the queue the Dashboard opens on, once the
// Dashboard has mounted, so neither the landing's first load nor the Dashboard's hydration waits
// for it. Keeping SSR costs nothing: no address opens the Dashboard on Order search. With SSR on,
// `dynamic` adds no Suspense boundary, so the list column brings its own.
const OrderSearch = dynamic(async () => (await import("./order-search")).OrderSearch);

const SCOPES = ["active", "closed", "all"] as const satisfies readonly Scope[];
const SCOPE_LABELS = { active: "Active", closed: "Closed", all: "All" } as const satisfies Record<
  Scope,
  string
>;

function groupLabelOf(view: ReturnType<typeof viewEntry>["view"]): string | undefined {
  if (PRIMARY_VIEWS.some((entry) => entry.view === view)) {
    return undefined;
  }
  return VIEW_GROUPS.find((group) => group.entries.some((entry) => entry.view === view))?.label;
}

function SidebarToggle(): ReactElement {
  const { toggleSidebar } = useDashboard();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle sidebar"
            aria-keyshortcuts="Meta+B Control+B"
            onClick={toggleSidebar}
          />
        }>
        <SidebarSimple />
      </Tooltip.Trigger>
      <Tooltip.Content>
        Toggle sidebar
        <span className={styles.tooltipKeys()}>
          <Kbd keys={["⌘", "B"]} />
        </span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function Crumbs(): ReactElement {
  const { state } = useDashboard();
  const { theme } = useLandingTheme();
  const entry = viewEntry(state.view);
  const group = groupLabelOf(entry.view);
  return (
    <Breadcrumb.Root className={styles.crumbs()}>
      <Breadcrumb.List>
        <Breadcrumb.Item className={styles.crumbHidden()}>{BRANDS[theme.brand].displayName}</Breadcrumb.Item>
        <Breadcrumb.Separator className={styles.crumbHidden()} />
        {group === undefined ? null : (
          <>
            <Breadcrumb.Item>{group}</Breadcrumb.Item>
            <Breadcrumb.Separator />
          </>
        )}
        <Breadcrumb.Item>
          <Breadcrumb.Page>{entry.label}</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
}

const GROUPINGS = { status: "Status", none: "No grouping" } as const satisfies Record<Grouping, string>;

function DisplayMenu(): ReactElement {
  const { state, dispatch } = useDashboard();
  const [open, setOpen] = useSideOverlay(false);
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger render={<Button variant="outline" size="sm" />}>
        <SlidersHorizontal data-icon="inline-start" />
        Display
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.RadioGroup
          value={state.grouping}
          onValueChange={(grouping) => {
            dispatch({ _tag: "Group", grouping });
          }}>
          <DropdownMenu.Label>Grouping</DropdownMenu.Label>
          {(["status", "none"] as const).map((grouping) => (
            <DropdownMenu.RadioItem key={grouping} value={grouping}>
              {GROUPINGS[grouping]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/** The queues' tabs. Order search filters through its own toolbar instead. */
function Filters(): ReactElement | null {
  const { state, navigate } = useDashboard();
  if (state.view === "order-search") {
    return null;
  }
  const shown = visibleOrders(state).length;
  return (
    <div className={styles.filters()}>
      <SingleToggle
        label="Orders to show"
        size="sm"
        options={SCOPES}
        labels={SCOPE_LABELS}
        value={state.scope}
        onValueChange={(scope) => {
          navigate({ _tag: "Scope", scope });
        }}
      />
      <span className={styles.total()}>{`${String(shown)} ${shown === 1 ? "order" : "orders"}`}</span>
    </div>
  );
}

/**
 * The detail beside a queue's list, or a Sheet over it in Order search and where the window is too
 * narrow for both. Keyed by order, so a comment draft or a pending Elhub retry never carries into
 * another order.
 */
function Detail({
  sheetOpen,
  onSheetOpenChange,
}: {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}): ReactElement {
  const { state, splitView } = useDashboard();
  const order = state.orders.find((candidate) => candidate.id === state.selected);

  if (splitView) {
    return (
      <aside aria-label="Order details" className={styles.detail()}>
        {order === undefined ? (
          <p className={styles.detailEmpty()}>Select an order to see its details.</p>
        ) : (
          <OrderDetail key={order.id} order={order} />
        )}
      </aside>
    );
  }

  return (
    <Sheet.Root open={sheetOpen && order !== undefined} onOpenChange={onSheetOpenChange}>
      <Sheet.Content showCloseButton={false} size="lg">
        {order === undefined ? null : (
          <OrderDetail
            key={order.id}
            order={order}
            renderTitle={(title) => <Sheet.Title>{title}</Sheet.Title>}
            barEnd={
              <Sheet.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close details" />}>
                <X />
              </Sheet.Close>
            }
          />
        )}
      </Sheet.Content>
    </Sheet.Root>
  );
}

export type DashboardMainProps = {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
};

/** The pane beside the sidebar: header, tabs, the order list with its bulk toolbar, the detail. */
export function DashboardMain({ sheetOpen, onSheetOpenChange }: DashboardMainProps): ReactElement {
  const { state, openPalette } = useDashboard();
  useEffect(() => {
    // A failed fetch is not an error yet: opening Order search imports the module again.
    import("./order-search").catch(() => undefined);
  }, []);
  return (
    <div className={styles.root()}>
      <header className={styles.header()}>
        <SidebarToggle />
        <Crumbs />
        <div className={styles.end()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            className={styles.phoneSearch()}
            onClick={openPalette}>
            <MagnifyingGlass />
          </Button>
          {/* Grouping is the queues' display; Order search has its table's column menu. */}
          {state.view === "order-search" ? null : <DisplayMenu />}
        </div>
      </header>
      <Filters />
      <div className={styles.body()}>
        <div className={styles.listColumn()}>
          {state.view === "order-search" ? (
            <Suspense fallback={null}>
              <OrderSearch />
            </Suspense>
          ) : (
            <OrderList />
          )}
          <BulkToolbar />
        </div>
        <Detail sheetOpen={sheetOpen} onSheetOpenChange={onSheetOpenChange} />
      </div>
    </div>
  );
}
