import { ORDERS } from "../sample/customer-data";
import type { OrderCustomer } from "../sample/customer-data";

/** The customers the collage's table lists: four of the shared orders. */
const TABLE_CUSTOMERS: ReadonlySet<OrderCustomer> = new Set([
  "Ingrid Lie",
  "Ola Berg",
  "Kari Nygård",
  "Sofie Dahl",
]);

/** The orders the collage's table lists, in the shared list's order. */
export const TABLE_ORDERS = ORDERS.filter((order) => TABLE_CUSTOMERS.has(order.customer));

/** The people the item list shows, with the year each became a customer. */
export const PEOPLE = [
  { name: "Ingrid Lie", initials: "IL", since: 2019 },
  { name: "Jonas Vik", initials: "JV", since: 2021 },
  { name: "Marte Moe", initials: "MM", since: 2024 },
] as const;

/** The days the timeline's three events fall on, as UTC midnights, in the order the copy lists them. */
export const TIMELINE_DAYS = [Date.UTC(2026, 2, 3), Date.UTC(2026, 2, 12), Date.UTC(2026, 3, 1)] as const;

/** The customer the description list shows. Customer data stays as it is in every locale. */
export const CUSTOMER = {
  name: "Kari Nordmann",
  customerNumber: "10492831",
  address: "Storgata 1, 3611 Kongsberg",
} as const;

/** The day the calendar shows selected: in March 2026, a month already past, so no render day is ever "today" in it. */
export const CALENDAR_DAY = { year: 2026, month: 3, day: 14 } as const;
