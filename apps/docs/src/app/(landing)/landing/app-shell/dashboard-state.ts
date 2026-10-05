import {
  dateTime,
  formatKwh,
  ORDER_STATUSES,
  SELLERS,
  SIGNED_IN,
  STATUS_ORDER,
  statusTone,
} from "./dashboard-orders";
import type { ActivityEvent, Order, OrderId, OrderStatus, SellerId } from "./dashboard-orders";
import { ORDERS } from "./dashboard-seeds";
import type { DraftInput } from "./order-draft";
import { EMPTY_QUERY, matchesQuery } from "./order-query";
import type { OrderQuery } from "./order-query";

/**
 * The sidebar entries, each a filter over the same orders. Order search lists every order through
 * its own query and shows them as a table; the others are queues.
 */
export type View =
  | "inbox"
  | "mine"
  | "drafts"
  | "sent"
  | "establishment-stopped"
  | "errors"
  | "deviations"
  | "order-search";

/**
 * Who a list view belongs to. A personal view holds only the signed-in seller's orders, the way
 * the sales tool's My orders, Drafts and Sent do; a shared view holds every seller's.
 */
export type Audience = "personal" | "shared";

type ViewRule = { readonly audience: Audience; readonly holds: (order: Order) => boolean };

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
} as const satisfies Record<View, ViewRule>;

/**
 * @param view - A list view.
 * @returns Whether it holds only the signed-in seller's orders or every seller's.
 */
export function audienceOf(view: View): Audience {
  return LIST_VIEWS[view].audience;
}

/** The tabs above the list: open work, finished work, or both. */
export type Scope = "active" | "closed" | "all";

// Telemarketing still works an order it was sent, so only delivered and cancelled orders close.
const CLOSED: ReadonlySet<OrderStatus> = new Set(["Done", "Cancelled"]);

/** How the list groups its rows. */
export type Grouping = "status" | "none";

/** The window's whole state. Selection and checks refer to orders by id. */
export type DashboardState = {
  readonly orders: readonly Order[];
  readonly view: View;
  /** The queues' tab. Order search narrows through its query instead. */
  readonly scope: Scope;
  readonly grouping: Grouping;
  /** Order search's text and facets, kept while other views are open. */
  readonly query: OrderQuery;
  readonly selected: OrderId | undefined;
  readonly checked: readonly OrderId[];
};

/** The state the window opens in: My orders, open work, the first row selected. */
export function initialState(): DashboardState {
  const opening: DashboardState = {
    orders: ORDERS,
    view: "mine",
    scope: "active",
    grouping: "status",
    query: EMPTY_QUERY,
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
function ordersIn(orders: readonly Order[], view: View): readonly Order[] {
  const rule: ViewRule = LIST_VIEWS[view];
  return orders.filter(
    (order) => (rule.audience === "shared" || order.seller === SIGNED_IN.id) && rule.holds(order)
  );
}

/**
 * @param view - A sidebar entry.
 * @returns Whether it is a queue of work. Order search is a search over every order instead: it
 * carries no count, and its table keeps the pane's width with its detail in a Sheet.
 */
export function isQueue(view: View): boolean {
  return view !== "order-search";
}

/**
 * The open orders in `view`, as the sidebar counts them and the Active tab lists them.
 *
 * @param orders - Every order.
 * @param view - A list view.
 * @returns How many of its orders are still open.
 */
export function openCount(orders: readonly Order[], view: View): number {
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
 * The rows the view shows. A queue lists them by status group, newest first inside each, or
 * newest first overall when grouping is off; keyboard movement walks this order. Order search
 * lists every order its query matches, newest first, and its table sorts them from there.
 *
 * @param state - The window state.
 * @returns The visible orders.
 */
export function visibleOrders(state: DashboardState): readonly Order[] {
  if (state.view === "order-search") {
    return searchOrders(state.orders, state.query);
  }
  const rows = ordersIn(state.orders, state.view).filter((order) => inScope(order, state.scope));
  if (state.grouping === "none") {
    return rows.toSorted(byNewest);
  }
  return STATUS_ORDER.flatMap((status) => rows.filter((order) => order.status === status).toSorted(byNewest));
}

/**
 * @param orders - Every order.
 * @param query - Order search's query.
 * @returns The orders it matches, newest first.
 */
export function searchOrders(orders: readonly Order[], query: OrderQuery): readonly Order[] {
  return orders.filter((order) => matchesQuery(order, query)).toSorted(byNewest);
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
export type DashboardAction =
  | { readonly _tag: "Select"; readonly id: OrderId }
  | { readonly _tag: "Move"; readonly by: 1 | -1 }
  | { readonly _tag: "Open"; readonly view: View }
  | { readonly _tag: "Reveal"; readonly id: OrderId }
  | { readonly _tag: "Scope"; readonly scope: Scope }
  | { readonly _tag: "Group"; readonly grouping: Grouping }
  | { readonly _tag: "Toggle"; readonly id: OrderId }
  | { readonly _tag: "Check"; readonly ids: readonly OrderId[] }
  | { readonly _tag: "Query"; readonly query: OrderQuery }
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

function update(
  state: DashboardState,
  ids: readonly OrderId[],
  change: (order: Order) => Order
): DashboardState {
  return { ...state, orders: state.orders.map((order) => (ids.includes(order.id) ? change(order) : order)) };
}

function logged(order: Order, at: string, title: string, detail: string, author?: SellerId): Order {
  const event: ActivityEvent = { id: `${String(order.id)}-${at}-${title}`, at, title, detail, author };
  return { ...order, activity: [...order.activity, event] };
}

/** Keeps the selection on a visible row after the view or its filters change. */
function settle(state: DashboardState): DashboardState {
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
export function reduce(state: DashboardState, action: DashboardAction): DashboardState {
  const next = transition(state, action);
  if (next.orders === state.orders && next.query === state.query && next.scope === state.scope) {
    return next;
  }
  // Checks on rows a change hides would act unseen, so they drop with the rows. Every order
  // mutation, query change and scope change passes here, whichever action caused it.
  const shown = new Set(visibleOrders(next).map((order) => order.id));
  const checked = next.checked.filter((id) => shown.has(id));
  return checked.length === next.checked.length ? next : { ...next, checked };
}

function transition(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action._tag) {
    case "Select": {
      const selected = { ...state, selected: action.id };
      // A read order changes nothing, so the orders keep their identity and memos on them hold.
      return state.orders.some((order) => order.id === action.id && order.unread)
        ? update(selected, [action.id], (order) => ({ ...order, unread: false }))
        : selected;
    }
    case "Move": {
      const rows = visibleOrders(state);
      const index = rows.findIndex((order) => order.id === state.selected);
      const next = rows[Math.min(Math.max(index + action.by, 0), rows.length - 1)];
      return next === undefined ? state : transition(state, { _tag: "Select", id: next.id });
    }
    case "Open":
      return settle({ ...state, view: action.view, checked: [] });
    case "Reveal": {
      const shown = visibleOrders(state).some((order) => order.id === action.id);
      // Order search with an empty query lists every order, so the reveal always finds its row.
      const opened = shown ? state : { ...state, view: "order-search" as const, query: EMPTY_QUERY };
      return transition(opened, { _tag: "Select", id: action.id });
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
    case "Check":
      return { ...state, checked: action.ids };
    case "ClearChecks":
      return { ...state, checked: [] };
    case "Query":
      return settle({ ...state, query: action.query });
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
      const { draft: input } = action;
      const event = (key: string, title: string, detail: string): ActivityEvent => ({
        id: `${String(id)}-${key}`,
        at: action.at,
        title,
        detail,
        author: SIGNED_IN.id,
      });
      const draft: Order = {
        id,
        status: "Ready",
        customer: input.customer,
        ssn: input.ssn,
        address: input.address,
        meterPointId: input.meterPointId,
        facility: { _tag: "Pending" },
        product: input.product,
        campaign: input.campaign,
        channel: "Backoffice",
        startup: input.startup,
        salesType: "New sale",
        seller: SIGNED_IN.id,
        created: action.at,
        unread: false,
        elhub: { _tag: "NotChecked" },
        activity: [
          event(
            "draft",
            "Draft saved",
            `${input.product} for ${input.customer}, ${input.startup.toLocaleLowerCase("en-GB")} from ${startDay(input.startDate)}`
          ),
          event("contact", "Contact details", `${input.phone} · ${input.email}`),
          event(
            "estimate",
            "Consumption estimate",
            `${formatKwh(input.annualKwh)} a year, until Elhub answers`
          ),
          event("attorney", "Power of attorney", "Given by the customer"),
          ...(input.note === "" ? [] : [event("note", "Comment", input.note)]),
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

/** A `yyyy-mm-dd` start date as the activity log prints dates, such as "14 Oct". */
function startDay(date: string): string {
  return dateTime(`${date}T12:00:00+02:00`).split(",")[0] ?? date;
}

function statusChange(order: Order, status: OrderStatus): string {
  return `${ORDER_STATUSES[order.status].label} → ${ORDER_STATUSES[status].label}`;
}
