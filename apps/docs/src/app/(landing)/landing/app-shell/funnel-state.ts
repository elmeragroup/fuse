import { ORDER_STATUSES, SELLERS, SIGNED_IN, STATUS_ORDER, statusTone } from "./funnel-orders";
import type { ActivityEvent, Order, OrderId, OrderStatus, Product, SellerId } from "./funnel-orders";
import { ORDERS } from "./funnel-seeds";

/** What the New order dialog collects; everything else a draft starts with is fixed. */
export type DraftInput = {
  readonly customer: string;
  readonly ssn: string;
  readonly address: string;
  readonly meterPointId: string;
  readonly product: Product;
};

/** The sidebar entries that list orders, each a filter over the same orders. */
export type ListView =
  | "inbox"
  | "mine"
  | "drafts"
  | "sent"
  | "establishment-stopped"
  | "errors"
  | "deviations"
  | "order-search";

/** The sidebar entries Funnel has that this demo names but does not build. */
export type PageView =
  | "checkout"
  | "statistics"
  | "import"
  | "competitor-price"
  | "batch-search"
  | "move-out"
  | "meter-point-search";

/** Every place the sidebar can open. */
export type View = ListView | PageView;

/**
 * Who a list view belongs to. A personal view holds only the signed-in seller's orders, the way
 * Funnel's My orders, Drafts and Sent do; a shared view holds every seller's.
 */
export type Audience = "personal" | "shared";

type ListViewRule = { readonly audience: Audience; readonly holds: (order: Order) => boolean };

const LIST_VIEWS = {
  inbox: { audience: "personal", holds: (order) => order.unread },
  mine: { audience: "personal", holds: () => true },
  drafts: { audience: "personal", holds: (order) => order.status === "Ready" },
  sent: { audience: "personal", holds: (order) => order.status !== "Ready" },
  "establishment-stopped": {
    audience: "shared",
    holds: (order) => order.status === "SendtToTm" || order.status === "Cancelled",
  },
  errors: {
    audience: "shared",
    holds: (order) => statusTone(order.status) === "destructive" && order.status !== "Cancelled",
  },
  deviations: { audience: "shared", holds: (order) => statusTone(order.status) === "warning" },
  "order-search": { audience: "shared", holds: () => true },
} as const satisfies Record<ListView, ListViewRule>;

/**
 * @param view - A list view.
 * @returns Whether it holds only the signed-in seller's orders or every seller's.
 */
export function audienceOf(view: ListView): Audience {
  return LIST_VIEWS[view].audience;
}

/**
 * @param view - A sidebar entry.
 * @returns Whether it lists orders.
 */
export function isListView(view: View): view is ListView {
  return view in LIST_VIEWS;
}

/** The tabs above the list: open work, finished work, or both. */
export type Scope = "active" | "closed" | "all";

// Telemarketing still works an order it was sent, so only delivered and cancelled orders close.
const CLOSED: ReadonlySet<OrderStatus> = new Set(["Done", "Cancelled"]);

/** How the list groups its rows. */
export type Grouping = "status" | "none";

/** The window's whole state. Selection and checks refer to orders by id. */
export type FunnelState = {
  readonly orders: readonly Order[];
  readonly view: View;
  readonly scope: Scope;
  readonly grouping: Grouping;
  readonly selected: OrderId | undefined;
  readonly checked: readonly OrderId[];
};

/** The state the window opens in: My orders, open work, the first row selected. */
export function initialState(): FunnelState {
  const opening: FunnelState = {
    orders: ORDERS,
    view: "mine",
    scope: "active",
    grouping: "status",
    selected: undefined,
    checked: [],
  };
  return { ...opening, selected: visibleOrders(opening)[0]?.id };
}

/**
 * The orders in `view`, unfiltered by scope.
 *
 * @param orders - Every order.
 * @param view - A list view.
 * @returns The orders it holds.
 */
export function ordersIn(orders: readonly Order[], view: ListView): readonly Order[] {
  const rule: ListViewRule = LIST_VIEWS[view];
  return orders.filter(
    (order) => (rule.audience === "shared" || order.seller === SIGNED_IN.id) && rule.holds(order)
  );
}

/**
 * The open orders in `view`, as the sidebar counts them and the Active tab lists them.
 *
 * @param orders - Every order.
 * @param view - A list view.
 * @returns How many of its orders are still open.
 */
export function openCount(orders: readonly Order[], view: ListView): number {
  return ordersIn(orders, view).filter((order) => inScope(order, "active")).length;
}

function inScope(order: Order, scope: Scope): boolean {
  switch (scope) {
    case "active":
      return !CLOSED.has(order.status);
    case "closed":
      return CLOSED.has(order.status);
    case "all":
      return true;
  }
}

const byNewest = (left: Order, right: Order) => Date.parse(right.created) - Date.parse(left.created);

/**
 * The rows the list shows, in display order: by status group, newest first inside each, or
 * newest first overall when grouping is off. Keyboard movement walks this order.
 *
 * @param state - The window state.
 * @returns The visible orders, or none for a page view.
 */
export function visibleOrders(state: FunnelState): readonly Order[] {
  if (!isListView(state.view)) {
    return [];
  }
  const rows = ordersIn(state.orders, state.view).filter((order) => inScope(order, state.scope));
  if (state.grouping === "none") {
    return rows.toSorted(byNewest);
  }
  return STATUS_ORDER.flatMap((status) => rows.filter((order) => order.status === status).toSorted(byNewest));
}

/** One status group as the list renders it. */
export type StatusGroup = { readonly status: OrderStatus; readonly orders: readonly Order[] };

/**
 * @param orders - Visible orders in display order.
 * @returns The non-empty status groups, in group order.
 */
export function groupByStatus(orders: readonly Order[]): readonly StatusGroup[] {
  return STATUS_ORDER.flatMap((status) => {
    const members = orders.filter((order) => order.status === status);
    return members.length === 0 ? [] : [{ status, orders: members }];
  });
}

/** Everything that changes the window's state. Timestamps come from the shell's clock. */
export type FunnelAction =
  | { readonly _tag: "Select"; readonly id: OrderId }
  | { readonly _tag: "Move"; readonly by: 1 | -1 }
  | { readonly _tag: "Open"; readonly view: View }
  | { readonly _tag: "Reveal"; readonly id: OrderId }
  | { readonly _tag: "Scope"; readonly scope: Scope }
  | { readonly _tag: "Group"; readonly grouping: Grouping }
  | { readonly _tag: "Toggle"; readonly id: OrderId }
  | { readonly _tag: "ClearChecks" }
  | { readonly _tag: "SetStatus"; readonly id: OrderId; readonly status: OrderStatus; readonly at: string }
  | { readonly _tag: "Comment"; readonly id: OrderId; readonly text: string; readonly at: string }
  | { readonly _tag: "Log"; readonly ids: readonly OrderId[]; readonly title: string; readonly at: string }
  | {
      readonly _tag: "Reassign";
      readonly ids: readonly OrderId[];
      readonly seller: SellerId;
      readonly at: string;
    }
  | {
      readonly _tag: "VerifyElhub";
      readonly id: OrderId;
      /** The status the retry started from; a completion after the status moved is stale. */
      readonly expected: OrderStatus;
      readonly at: string;
    }
  | { readonly _tag: "CreateDraft"; readonly draft: DraftInput; readonly at: string };

function update(state: FunnelState, ids: readonly OrderId[], change: (order: Order) => Order): FunnelState {
  return { ...state, orders: state.orders.map((order) => (ids.includes(order.id) ? change(order) : order)) };
}

function logged(order: Order, at: string, title: string, detail: string, author?: SellerId): Order {
  const event: ActivityEvent = { id: `${String(order.id)}-${at}-${title}`, at, title, detail, author };
  return { ...order, activity: [...order.activity, event] };
}

/** Keeps the selection on a visible row after the view or its filters change. */
function settle(state: FunnelState): FunnelState {
  const rows = visibleOrders(state);
  if (rows.some((order) => order.id === state.selected)) {
    return state;
  }
  return { ...state, selected: rows[0]?.id };
}

/**
 * The window's state machine. Pure: the shell supplies every timestamp.
 *
 * @param state - The current state.
 * @param action - What happened.
 * @returns The next state.
 */
export function reduce(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action._tag) {
    case "Select":
      return update({ ...state, selected: action.id }, [action.id], (order) => ({ ...order, unread: false }));
    case "Move": {
      const rows = visibleOrders(state);
      const index = rows.findIndex((order) => order.id === state.selected);
      const next = rows[Math.min(Math.max(index + action.by, 0), rows.length - 1)];
      return next === undefined ? state : reduce(state, { _tag: "Select", id: next.id });
    }
    case "Open":
      return settle({ ...state, view: action.view, checked: [] });
    case "Reveal": {
      const shown = visibleOrders(state).some((order) => order.id === action.id);
      const opened = shown ? state : { ...state, view: "order-search" as const, scope: "all" as const };
      return reduce(opened, { _tag: "Select", id: action.id });
    }
    case "Scope":
      return settle({ ...state, scope: action.scope });
    case "Group":
      return { ...state, grouping: action.grouping };
    case "Toggle":
      return {
        ...state,
        checked: state.checked.includes(action.id)
          ? state.checked.filter((id) => id !== action.id)
          : [...state.checked, action.id],
      };
    case "ClearChecks":
      return { ...state, checked: [] };
    case "SetStatus":
      return update(state, [action.id], (order) =>
        order.status === action.status
          ? order
          : logged(
              { ...order, status: action.status },
              action.at,
              "Status changed",
              statusChange(order, action.status),
              SIGNED_IN.id
            )
      );
    case "Comment":
      return update(state, [action.id], (order) =>
        logged(order, action.at, "Comment", action.text, SIGNED_IN.id)
      );
    case "Log":
      return update(state, action.ids, (order) =>
        logged(order, action.at, action.title, `By ${SIGNED_IN.name}`, SIGNED_IN.id)
      );
    case "Reassign":
      return update(state, action.ids, (order) =>
        logged(
          { ...order, seller: action.seller },
          action.at,
          "Seller changed",
          `${SELLERS[order.seller].name} → ${SELLERS[action.seller].name}`,
          SIGNED_IN.id
        )
      );
    case "VerifyElhub":
      return update(state, [action.id], (order) =>
        retryApplies(order, action.expected)
          ? logged(
              { ...order, status: "InProgress", elhub: { _tag: "Verified", checkedAt: action.at } },
              action.at,
              "Elhub check passed",
              "Owner matches the customer after the retry"
            )
          : order
      );
    case "CreateDraft": {
      const id = nextOrderId(state.orders);
      const draft: Order = {
        ...action.draft,
        id,
        status: "Ready",
        facility: { _tag: "Pending" },
        campaign: undefined,
        channel: "Backoffice",
        startup: "Change of supplier",
        salesType: "New sale",
        seller: SIGNED_IN.id,
        created: action.at,
        unread: false,
        elhub: { _tag: "NotChecked" },
        activity: [
          {
            id: `${String(id)}-draft`,
            at: action.at,
            title: "Draft saved",
            detail: `${action.draft.product} for ${action.draft.customer}`,
            author: SIGNED_IN.id,
          },
        ],
      };
      return {
        ...state,
        orders: [...state.orders, draft],
        view: "drafts",
        scope: "active",
        selected: id,
        checked: [],
      };
    }
  }
}

/**
 * @param orders - Every order.
 * @returns The id the next draft gets, one past the highest.
 */
export function nextOrderId(orders: readonly Order[]): OrderId {
  return Math.max(...orders.map((order) => order.id)) + 1;
}

/**
 * An Elhub retry answers for the order as it was when the retry started. Once someone changed
 * the status meanwhile, such as cancelling the order, the answer no longer applies.
 *
 * @param order - The order as it is now.
 * @param expected - Its status when the retry started.
 * @returns Whether the retry's outcome may still change the order.
 */
export function retryApplies(order: Order, expected: OrderStatus): boolean {
  return order.status === expected;
}

function statusChange(order: Order, status: OrderStatus): string {
  return `${ORDER_STATUSES[order.status].label} → ${ORDER_STATUSES[status].label}`;
}
