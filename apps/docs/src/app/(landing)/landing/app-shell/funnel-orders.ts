/**
 * The orders the hero's Funnel window shows: Funnel, Elmera's internal sales and back-office tool,
 * as a back-office agent sees it. This module owns what an order is, its statuses and the rules
 * and formatting over them; `funnel-seeds.ts` holds the fixture. Labels follow
 * `.ref/OrderModuleInternalWeb`, and every SSN is shown masked, the way the tool prints it.
 */

/**
 * The order statuses the demo uses, by their `OrderStatusEnum` names
 * (`packages/db-order-module/src/order-status-enum.ts` in the reference).
 */
export type OrderStatus =
  | "ElhubFailed"
  | "VerifyPersonFailed"
  | "AwaitingCustomerApproval"
  | "AwaitingStartup"
  | "InProgress"
  | "Ready"
  | "SendtToTm"
  | "Done"
  | "Cancelled";

/** How a status reads at a glance: the three tones Funnel paints its status icons in. */
export type StatusTone = "success" | "warning" | "destructive";

type StatusFacts = {
  /** The integer Core stores. */
  readonly code: number;
  /** The English display name. */
  readonly label: string;
};

/** Each status's Core integer and English label, in the order the list groups them. */
export const ORDER_STATUSES = {
  ElhubFailed: { code: 404, label: "Elhub failed" },
  VerifyPersonFailed: { code: 409, label: "Person verification failed" },
  AwaitingCustomerApproval: { code: 101, label: "Awaiting customer approval" },
  AwaitingStartup: { code: 108, label: "Awaiting startup" },
  InProgress: { code: 100, label: "In progress" },
  Ready: { code: 0, label: "Ready to send" },
  SendtToTm: { code: 301, label: "Sent to telemarketing" },
  Done: { code: 200, label: "Done" },
  Cancelled: { code: 300, label: "Cancelled" },
} as const satisfies Record<OrderStatus, StatusFacts>;

/** Every status in group order: failures first, finished work last. */
export const STATUS_ORDER = [
  "ElhubFailed",
  "VerifyPersonFailed",
  "AwaitingCustomerApproval",
  "AwaitingStartup",
  "InProgress",
  "Ready",
  "SendtToTm",
  "Done",
  "Cancelled",
] as const satisfies readonly OrderStatus[];

/**
 * Funnel's colour rule (`components/order/order-status.tsx`): cancelled and every code from 400
 * up are destructive, 101 to 199 and 301 are warning, and the rest are success.
 *
 * @param status - The status to classify.
 * @returns The tone its icon is painted in.
 */
export function statusTone(status: OrderStatus): StatusTone {
  const { code } = ORDER_STATUSES[status];
  if (code >= 400 || code === 300) {
    return "destructive";
  }
  if ((code > 100 && code < 200) || code === 301) {
    return "warning";
  }
  return "success";
}

/**
 * Funnel sends the signing SMS only while the customer has yet to approve (SALGSL-4056). The
 * detail's Resend contract and the bulk Send SMS share this rule.
 *
 * @param status - The order's status.
 * @returns Whether the order can get a new signing link by SMS.
 */
export function canSendContractSms(status: OrderStatus): boolean {
  return status === "AwaitingCustomerApproval";
}

/**
 * A receipt exists once an order is finished or withdrawn (SALGSL-4058). The detail's and the
 * bulk Send receipt share this rule.
 *
 * @param status - The order's status.
 * @returns Whether the order has a receipt to send.
 */
export function canSendReceipt(status: OrderStatus): boolean {
  return status === "Done" || status === "Cancelled";
}

/** The five Norwegian price areas. */
export type PriceArea = "NO1" | "NO2" | "NO3" | "NO4" | "NO5";

const PRICE_AREA_NAMES = {
  NO1: "Øst-Norge",
  NO2: "Sør-Norge",
  NO3: "Midt-Norge",
  NO4: "Nord-Norge",
  NO5: "Vest-Norge",
} as const satisfies Record<PriceArea, string>;

/**
 * @param area - A price area.
 * @returns The area with its region, such as "NO5 Vest-Norge".
 */
export function priceAreaLabel(area: PriceArea): string {
  return `${area} ${PRICE_AREA_NAMES[area]}`;
}

/** The commission campaign an order was sold under (`order-info-details.tsx`). */
export type SalesChannel = "New sales" | "Comeback" | "Winback" | "Leads" | "Backoffice";

/** How the facility changes supplier (`OrderStartupType` in the reference). */
export type StartupType = "Change of supplier" | "Move" | "Renewal";

/** The people who sell and process orders. Fictional. */
export type SellerId = "reodor" | "solan" | "mysil" | "kristine";

/** A seller and where they sell from. */
export type Seller = {
  readonly id: SellerId;
  readonly name: string;
  readonly initials: string;
  readonly team: string;
};

/** Every seller, the signed-in one first. */
export const SELLERS = {
  reodor: { id: "reodor", name: "Reodor Felgen", initials: "RF", team: "Back office" },
  solan: { id: "solan", name: "Solan Gundersen", initials: "SG", team: "Store, Bergen sentrum" },
  mysil: { id: "mysil", name: "Mysil Bergsprekken", initials: "MB", team: "Telemarketing" },
  kristine: { id: "kristine", name: "Kristine Vold", initials: "KV", team: "Store, Trondheim Torg" },
} as const satisfies Record<SellerId, Seller>;

/** The seller signed in to the demo. */
export const SIGNED_IN: Seller = SELLERS.reodor;

/** Every seller in display order. */
export const SELLER_LIST: readonly Seller[] = Object.values(SELLERS);

/** An order number as Funnel prints it: Core's integer id. */
export type OrderId = number;

/** The electricity products the demo sells, with the price elements they carry. */
export type Product = "Spotpris" | "Fastpris 12 mnd" | "StrømSmart+";

const PRODUCT_PRICES = {
  Spotpris: "Spot + 5 øre/kWh, 49 kr/mnd",
  "Fastpris 12 mnd": "89,90 øre/kWh, 49 kr/mnd",
  "StrømSmart+": "Spot + 3 øre/kWh, 69 kr/mnd",
} as const satisfies Record<Product, string>;

/**
 * @param product - A product.
 * @returns Its price elements in Norwegian units, such as "Spot + 5 øre/kWh, 49 kr/mnd".
 */
export function productPrice(product: Product): string {
  return PRODUCT_PRICES[product];
}

/** What Elhub answered when Funnel checked the facility's owner. */
export type ElhubCheck =
  | { readonly _tag: "Verified"; readonly checkedAt: string }
  | { readonly _tag: "OwnerMismatch"; readonly checkedAt: string; readonly registeredOwner: string }
  | { readonly _tag: "MeterPointNotFound"; readonly checkedAt: string }
  | { readonly _tag: "NotChecked" };

/** What Elhub holds about the facility; a draft has not asked yet. */
export type Facility =
  | {
      readonly _tag: "Known";
      readonly priceArea: PriceArea;
      readonly gridOwner: string;
      /** Estimated annual consumption, kWh. */
      readonly annualKwh: number;
    }
  | { readonly _tag: "Pending" };

/** One entry in an order's activity log. */
export type ActivityEvent = {
  readonly id: string;
  /** ISO timestamp. */
  readonly at: string;
  readonly title: string;
  readonly detail: string;
  /** Who wrote it; system events carry none. */
  readonly author: SellerId | undefined;
};

/** One order as the list and the detail pane read it. */
export type Order = {
  readonly id: OrderId;
  readonly status: OrderStatus;
  readonly customer: string;
  /** Birth date and personal number; the UI only ever shows it through {@link maskSsn}. */
  readonly ssn: string;
  readonly address: string;
  readonly meterPointId: string;
  readonly facility: Facility;
  readonly product: Product;
  readonly campaign: string | undefined;
  readonly channel: SalesChannel;
  readonly startup: StartupType;
  readonly salesType: "New sale" | "Product exchange";
  readonly seller: SellerId;
  /** ISO timestamp the order was created. */
  readonly created: string;
  /** New activity the signed-in seller has not opened yet. */
  readonly unread: boolean;
  readonly elhub: ElhubCheck;
  readonly activity: readonly ActivityEvent[];
};

/** The instant the demo treats as now, so the server and every client print the same dates. */
export const DEMO_NOW = Date.parse("2026-10-02T13:30:00+02:00");

/**
 * A national identity number as back office prints it: the birth date, then the personal number
 * hidden.
 *
 * @param ssn - The 11-digit number.
 * @returns The birth date and five bullets, such as "120388 •••••".
 */
export function maskSsn(ssn: string): string {
  return `${ssn.slice(0, 6)} •••••`;
}

const kwh = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/**
 * @param value - Kilowatt-hours a year.
 * @returns The value in Norwegian grouping, such as "14 200 kWh".
 */
export function formatKwh(value: number): string {
  return `${kwh.format(value)} kWh`;
}

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Oslo",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

/**
 * A timestamp the way the list prints it against {@link DEMO_NOW}: minutes or hours today,
 * days this week, and the date beyond.
 *
 * @param iso - The timestamp.
 * @returns A short relative label, such as "2h", "3d" or "26 Sep".
 */
export function relativeDate(iso: string): string {
  const minutes = Math.max(0, Math.round((DEMO_NOW - Date.parse(iso)) / 60_000));
  if (minutes < 60) {
    return `${String(Math.max(minutes, 1))}m`;
  }
  if (minutes < 60 * 24) {
    return `${String(Math.floor(minutes / 60))}h`;
  }
  if (minutes < 60 * 24 * 7) {
    return `${String(Math.floor(minutes / (60 * 24)))}d`;
  }
  return dayMonth.format(Date.parse(iso));
}

/**
 * @param iso - The timestamp.
 * @returns The date and Oslo time, such as "2 Oct, 09:14".
 */
export function dateTime(iso: string): string {
  return `${dayMonth.format(Date.parse(iso))}, ${clock.format(Date.parse(iso))}`;
}
