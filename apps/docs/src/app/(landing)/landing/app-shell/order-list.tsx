"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Empty } from "@elmeragroup/fuse/empty";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Skeleton } from "@elmeragroup/fuse/skeleton";

import { useFunnel } from "./funnel-context";
import { ORDER_STATUSES, relativeDate, SELLERS } from "./funnel-orders";
import type { Order } from "./funnel-orders";
import { audienceOf, groupByStatus, isListView, visibleOrders } from "./funnel-state";
import type { Audience, StatusGroup } from "./funnel-state";
import { viewEntry } from "./funnel-views";
import { OrderStatusIcon } from "./order-status-icon";

const orderList = tv({
  slots: {
    // The pane is a size container, so columns follow the window's width, not the viewport's.
    pane: "@container relative min-h-0 flex-1",
    scroll: "h-full",
    // ScrollArea's content is at least as wide as its children's widest line, so the list
    // contains its inline size to let rows truncate at the pane's width.
    list: "group/list m-0 list-none p-0 pb-24 contain-inline-size",
    // Sticky, so the band stays opaque: the page background below a faint muted tint, which
    // keeps the header quieter than the rows in both schemes.
    groupHead:
      "text-sm sticky top-0 z-20 flex h-9 items-center gap-2 border-b border-border bg-background px-4 text-foreground before:absolute before:inset-0 before:-z-10 before:bg-muted/50",
    groupLabel: "text-sm font-medium m-0",
    groupCount: "text-muted-foreground tabular-nums",
    rows: "m-0 list-none p-0",
    item: "group/row relative border-b border-border/60",
    // A 40px column the checkbox sits in, shown on hover, focus or once anything is checked.
    check:
      "absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-center opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-data-[checking=true]/list:opacity-100 focus-within:opacity-100 motion-reduce:transition-none",
    row: "text-sm flex h-10 w-full cursor-default items-center gap-3 pr-4 pl-10 text-left text-foreground transition-colors duration-100 outline-none hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground motion-reduce:transition-none",
    id: "text-xs w-13 shrink-0 font-mono text-muted-foreground tabular-nums",
    // The customer keeps its name; the product gives way first. The campaign is in the detail.
    customer: "font-medium w-32 shrink-0 truncate",
    // The product takes the free width itself; the spacer stands in only where it is hidden, so
    // no empty flex item spends a gap the product could use.
    product: "@lg:block hidden min-w-0 flex-1 truncate text-muted-foreground",
    spacer: "@lg:hidden flex-1",
    meter: "text-xs @4xl:block hidden shrink-0 font-mono text-muted-foreground tabular-nums",
    // `outline` draws in the text colour; the border token keeps the badge quieter than the name.
    channel: "@md:inline-flex hidden shrink-0 border-border text-muted-foreground",
    // The seller's column keeps its width in personal views, where it stays empty, so every
    // view lines up column for column.
    seller: "@md:flex hidden size-6 shrink-0",
    // A ring keeps the avatar's edge on hovered and selected rows, which share its fill.
    avatar: "size-6 ring-1 ring-border",
    date: "text-xs w-8 shrink-0 text-right text-muted-foreground tabular-nums",
    loading: "contain-inline-size",
    skeletonRow: "flex h-10 items-center gap-3 border-b border-border/60 pr-4 pl-10",
    skeletonIcon: "size-3.5 rounded-full",
    skeletonId: "h-3 w-12",
    skeletonName: "h-3.5 w-36",
    skeletonProduct: "@lg:block hidden h-3 w-28",
    skeletonDate: "ml-auto h-3 w-8",
    empty: "h-full",
  },
});

const styles = orderList();

/** One order row: a checkbox beside a button that selects the order. */
function OrderRow({ order, audience }: { order: Order; audience: Audience }): ReactElement {
  const { state, dispatch, openOrder } = useFunnel();
  const current = state.selected === order.id;
  const seller = SELLERS[order.seller];

  return (
    <li className={styles.item()}>
      <span className={styles.check()}>
        <Checkbox
          aria-label={`Select ${order.customer}`}
          checked={state.checked.includes(order.id)}
          onCheckedChange={() => {
            dispatch({ _tag: "Toggle", id: order.id });
          }}
        />
      </span>
      <button
        type="button"
        data-row
        data-order-id={order.id}
        data-customer={order.customer}
        aria-current={current ? "true" : "false"}
        aria-label={`${order.customer}, order ${String(order.id)}, ${ORDER_STATUSES[order.status].label}`}
        className={styles.row()}
        onClick={() => {
          openOrder(order.id);
        }}>
        <OrderStatusIcon status={order.status} />
        <span className={styles.id()}>{order.id}</span>
        <span className={styles.customer()}>{order.customer}</span>
        <span className={styles.product()}>{order.product}</span>
        <span className={styles.spacer()} />
        <span className={styles.meter()}>{order.meterPointId}</span>
        <Badge variant="outline" size="sm" className={styles.channel()}>
          {order.channel}
        </Badge>
        <span className={styles.seller()}>
          {audience === "shared" ? (
            <Avatar.Root className={styles.avatar()}>
              <Avatar.Fallback>{seller.initials}</Avatar.Fallback>
            </Avatar.Root>
          ) : null}
        </span>
        <time dateTime={order.created} className={styles.date()}>
          {relativeDate(order.created)}
        </time>
      </button>
    </li>
  );
}

function GroupSection({ group, audience }: { group: StatusGroup; audience: Audience }): ReactElement {
  const label = ORDER_STATUSES[group.status].label;
  return (
    <li>
      <div className={styles.groupHead()}>
        <OrderStatusIcon status={group.status} />
        <h3 className={styles.groupLabel()}>{label}</h3>
        <span className={styles.groupCount()}>{group.orders.length}</span>
      </div>
      <ul aria-label={label} className={styles.rows()}>
        {group.orders.map((order) => (
          <OrderRow key={order.id} order={order} audience={audience} />
        ))}
      </ul>
    </li>
  );
}

const SKELETON_ROWS = 9;

/** Placeholder rows in the list's own geometry, shown while a view "fetches". */
function LoadingRows(): ReactElement {
  return (
    <div role="status" aria-label="Loading orders" className={styles.loading()}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={styles.skeletonRow()}>
          <Skeleton className={styles.skeletonIcon()} />
          <Skeleton className={styles.skeletonId()} />
          <Skeleton className={styles.skeletonName()} />
          <Skeleton className={styles.skeletonProduct()} />
          <Skeleton className={styles.skeletonDate()} />
        </div>
      ))}
    </div>
  );
}

/** A Funnel page the demo names in the sidebar but does not build. */
function PlaceholderPage(): ReactElement {
  const { state, navigate } = useFunnel();
  const entry = viewEntry(state.view);
  const Icon = entry.icon;
  return (
    <Empty.Root className={styles.empty()}>
      <Empty.Header>
        <Empty.Media variant="icon">
          <Icon />
        </Empty.Media>
        <Empty.Title>{entry.label}</Empty.Title>
        <Empty.Description>
          This Funnel page is not part of the demo. Orders, deviations and order search are.
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigate({ _tag: "Open", view: "mine" });
          }}>
          Open My orders
        </Button>
      </Empty.Content>
    </Empty.Root>
  );
}

function EmptyList(): ReactElement {
  const { state, navigate } = useFunnel();
  return (
    <Empty.Root className={styles.empty()}>
      <Empty.Header>
        <Empty.Title>No orders here</Empty.Title>
        <Empty.Description>
          {state.scope === "all"
            ? "This queue is empty."
            : "Nothing matches this tab. Show every order instead."}
        </Empty.Description>
      </Empty.Header>
      {state.scope === "all" ? null : (
        <Empty.Content>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate({ _tag: "Scope", scope: "all" });
            }}>
            Show all orders
          </Button>
        </Empty.Content>
      )}
    </Empty.Root>
  );
}

/**
 * The order list, grouped by status like Linear's issue groups: a sticky header with the status
 * and its count, then one row per order. Each group is a list named after its status.
 */
export function OrderList(): ReactElement {
  const { state, loading } = useFunnel();

  if (!isListView(state.view)) {
    return (
      <div className={styles.pane()}>
        <PlaceholderPage />
      </div>
    );
  }

  const orders = visibleOrders(state);
  const audience = audienceOf(state.view);
  const content = loading ? (
    <LoadingRows />
  ) : orders.length === 0 ? (
    <EmptyList />
  ) : (
    <ul aria-label="Orders" data-checking={state.checked.length > 0} className={styles.list()}>
      {state.grouping === "status" ? (
        groupByStatus(orders).map((group) => (
          <GroupSection key={group.status} group={group} audience={audience} />
        ))
      ) : (
        <li>
          <ul aria-label="All orders" className={styles.rows()}>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} audience={audience} />
            ))}
          </ul>
        </li>
      )}
    </ul>
  );

  return (
    <div className={styles.pane()}>
      <ScrollArea.Root className={styles.scroll()}>{content}</ScrollArea.Root>
    </div>
  );
}
