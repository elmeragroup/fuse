"use client";

import { Suspense, useEffect } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";
import { tv } from "tailwind-variants";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { MagnifyingGlass, SidebarSimple, SlidersHorizontal } from "@elmeragroup/fuse/icons";
import { ListDetail } from "@elmeragroup/fuse/list-detail";
import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { BRANDS } from "@elmeragroup/fuse/theme";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { SingleToggle } from "../../../../components/single-toggle";
import { useLandingTheme } from "../landing-theme";
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
    // A size container, so the breadcrumb follows the pane's width. Sidebar.Inset draws the
    // raised panel against the inset rail; it renders a `<div>` because the landing already has
    // its own `<main>`.
    root: "@container min-w-0 overflow-hidden text-foreground",
    header: "flex h-12 shrink-0 items-center gap-2 border-b border-border px-3",
    crumbs: "min-w-0",
    crumbHidden: "@xl:inline-flex hidden",
    end: "ml-auto flex items-center gap-1.5",
    // The sidebar carries Search from md; phones get it here instead.
    phoneSearch: "md:hidden",
    filters: "flex h-11 shrink-0 items-center gap-3 border-b border-border px-3",
    total: "text-xs ml-auto text-muted-foreground tabular-nums",
    body: "flex-1",
    listColumn: "@container relative",
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
 * The open order's detail. ListDetail puts it beside a queue's list where the pane has room, and
 * in a Sheet over the list below that and in Order search, whose table keeps the width at every
 * size. Keyed by order, so a comment draft or a pending Elhub retry never carries into another
 * order.
 */
function Detail(): ReactElement {
  const { state } = useDashboard();
  const order = state.orders.find((candidate) => candidate.id === state.selected);
  return (
    <ListDetail.Detail aria-label="Order details" size="lg" showCloseButton={false}>
      {order === undefined ? (
        <p className={styles.detailEmpty()}>Select an order to see its details.</p>
      ) : (
        <OrderDetail key={order.id} order={order} />
      )}
    </ListDetail.Detail>
  );
}

export type DashboardMainProps = {
  /** Whether the open order's detail Sheet shows below the split. */
  detailOpen: boolean;
  onDetailOpenChange: (open: boolean) => void;
};

/** The pane beside the sidebar: header, tabs, the order list with its bulk toolbar, the detail. */
export function DashboardMain({ detailOpen, onDetailOpenChange }: DashboardMainProps): ReactElement {
  const { state, openPalette } = useDashboard();
  useEffect(() => {
    // A failed fetch is not an error yet: opening Order search imports the module again.
    import("./order-search").catch(() => undefined);
  }, []);
  return (
    <Sidebar.Inset render={<div />} className={styles.root()}>
      <header className={styles.header()}>
        <SidebarToggle />
        <Crumbs />
        <div className={styles.end()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            aria-keyshortcuts="/"
            className={styles.phoneSearch()}
            onClick={openPalette}>
            <MagnifyingGlass />
          </Button>
          {/* Grouping is the queues' display; Order search has its table's column menu. */}
          {state.view === "order-search" ? null : <DisplayMenu />}
        </div>
      </header>
      <Filters />
      <ListDetail.Root
        open={detailOpen}
        onOpenChange={onDetailOpenChange}
        // Only a queue sits beside its detail; Order search's table keeps the width at every size.
        split={state.view === "order-search" ? "never" : "4xl"}
        className={styles.body()}>
        <ListDetail.List className={styles.listColumn()}>
          {state.view === "order-search" ? (
            <Suspense fallback={null}>
              <OrderSearch />
            </Suspense>
          ) : (
            <OrderList />
          )}
          <BulkToolbar />
        </ListDetail.List>
        <Detail />
      </ListDetail.Root>
    </Sidebar.Inset>
  );
}
