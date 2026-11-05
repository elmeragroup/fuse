/** An order's state in the internal apps the video shows. */
export type OrderStatus = "active" | "pending" | "paused";

/** One customer order, its amount in whole units of the app's currency. */
export type Order = {
  readonly customer: string;
  readonly status: OrderStatus;
  readonly amount: number;
};

/** The orders every internal app in the video lists. Names are Norwegian, as Elmera's customers are. */
export const ORDERS = [
  { customer: "Ingrid Lie", status: "active", amount: 1240 },
  { customer: "Ola Berg", status: "pending", amount: 860 },
  { customer: "Kari Nygård", status: "active", amount: 2015 },
  { customer: "Erik Haugen", status: "active", amount: 1480 },
  { customer: "Sofie Dahl", status: "paused", amount: 0 },
  { customer: "Jonas Vik", status: "active", amount: 990 },
  { customer: "Marte Moe", status: "pending", amount: 1105 },
  { customer: "Lars Strand", status: "active", amount: 1760 },
  { customer: "Nora Bakke", status: "active", amount: 640 },
] as const satisfies readonly Order[];

/** A customer with an order in {@link ORDERS}. */
export type OrderCustomer = (typeof ORDERS)[number]["customer"];

/** The Badge variant each status draws with. */
export const STATUS_BADGE = {
  active: "soft-success",
  pending: "soft-warning",
  paused: "outline",
} as const satisfies Record<OrderStatus, string>;

/** The meter the reading forms and toasts show. */
export const METER_NUMBER = "7070575000";

/** The reading the forms and toasts show, in kWh. */
export const READING_KWH = 48_213;

/** A week of daily use in kWh, Monday first; the last {@link CURRENT_DAYS} are the current ones. */
export const WEEK_KWH = [13.1, 12.4, 14.0, 15.2, 13.6, 14.8, 12.9] as const;

/** How many of the week's last days are current, which every chart of the week marks. */
export const CURRENT_DAYS = 2;
