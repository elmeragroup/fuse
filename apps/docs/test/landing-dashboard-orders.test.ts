/**
 * The landing's Dashboard window paints each order status the way the sales tool does. The oracle is the
 * reference's own table: `OrderStatusEnum` integers (`packages/db-order-module/src/order-status-enum.ts`)
 * and the tone `getOrderStatusIconVariant` gives each one (`components/order/order-status.tsx`),
 * copied here by hand rather than computed.
 */
import { describe, expect, it } from "vitest";

import {
  maskSsn,
  ORDER_STATUSES,
  STATUS_ORDER,
  statusTone,
} from "../src/app/(landing)/landing/app-shell/dashboard-orders";
import type { OrderStatus, StatusTone } from "../src/app/(landing)/landing/app-shell/dashboard-orders";
import { initialState, reduce } from "../src/app/(landing)/landing/app-shell/dashboard-state";
import { parseDraft } from "../src/app/(landing)/landing/app-shell/order-draft";
import type { DraftFields } from "../src/app/(landing)/landing/app-shell/order-draft";
import { EMPTY_QUERY, optionCount, togglePick } from "../src/app/(landing)/landing/app-shell/order-query";

const REFERENCE = {
  ElhubFailed: { code: 404, tone: "destructive" },
  VerifyPersonFailed: { code: 409, tone: "destructive" },
  AwaitingCustomerApproval: { code: 101, tone: "warning" },
  AwaitingStartup: { code: 108, tone: "warning" },
  InProgress: { code: 100, tone: "success" },
  Ready: { code: 0, tone: "success" },
  SendtToTm: { code: 301, tone: "warning" },
  Done: { code: 200, tone: "success" },
  Cancelled: { code: 300, tone: "destructive" },
} as const satisfies Record<OrderStatus, { code: number; tone: StatusTone }>;

describe("Dashboard order statuses", () => {
  it.each(STATUS_ORDER)("maps %s to Core's integer and the sales tool's tone", (status) => {
    expect({ code: ORDER_STATUSES[status].code, tone: statusTone(status) }).toEqual(REFERENCE[status]);
  });

  it("prints only the birth date of an SSN", () => {
    expect(maskSsn("12038841236")).toBe("120388 •••••");
  });

  it("files a new draft under Drafts with the next order number, selected", () => {
    const next = reduce(initialState(), {
      _tag: "CreateDraft",
      draft: {
        customer: "Kari Nordmann",
        ssn: "15057723964",
        address: "Storgata 1, 3611 Kongsberg",
        meterPointId: "707057500012345678",
        product: "Spotpris",
        phone: "+4791234567",
        email: "kari@eksempel.no",
        campaign: undefined,
        startup: "Change of supplier",
        startDate: "2026-10-16",
        annualKwh: 12000,
        note: "",
      },
      at: "2026-10-02T11:30:00.000Z",
    });
    // The fixture's highest order number is 284134.
    expect({ view: next.view, selected: next.selected }).toEqual({ view: "drafts", selected: 284135 });
    expect(next.orders.find((order) => order.id === 284135)?.status).toBe("Ready");
  });

  it("ignores an Elhub retry that completes after the order was cancelled", () => {
    // Marius Kvam's order 284125 opens in Elhub failed, with an owner mismatch to retry.
    const started = initialState();
    const cancelled = reduce(started, {
      _tag: "SetStatus",
      id: 284125,
      status: "Cancelled",
      at: "2026-10-02T11:30:00.000Z",
    });
    const completed = reduce(cancelled, {
      _tag: "VerifyElhub",
      id: 284125,
      expected: "ElhubFailed",
      at: "2026-10-02T11:30:01.000Z",
    });
    const order = completed.orders.find((candidate) => candidate.id === 284125);
    expect(order?.status).toBe("Cancelled");
    expect(order?.elhub._tag).toBe("OwnerMismatch");
    expect(order?.activity.map((event) => event.title)).not.toContain("Elhub check passed");
  });

  it("drops the check on an order a status change moves out of Order search's filter", () => {
    // Ingrid Haugland's 284117 and Marius Kvam's 284125 both open in Elhub failed.
    const opened = reduce(initialState(), { _tag: "Open", view: "order-search" });
    const filtered = reduce(opened, {
      _tag: "Query",
      query: togglePick(EMPTY_QUERY, "status", "ElhubFailed"),
    });
    const checked = reduce(filtered, { _tag: "Check", ids: [284117, 284125] });
    const moved = reduce(checked, {
      _tag: "SetStatus",
      id: 284125,
      status: "InProgress",
      at: "2026-10-02T11:30:00.000Z",
    });
    expect(moved.checked).toEqual([284117]);
  });

  it("counts a facet's option under the rest of the query, as a faceted search does", () => {
    // In the fixture, three New sales orders failed in Elhub: Ingrid Haugland, Marius Kvam and
    // Vilde Sæther. Picking Elhub failed itself does not narrow its own counts.
    const query = togglePick(togglePick(EMPTY_QUERY, "channel", "New sales"), "status", "ElhubFailed");
    expect(optionCount(initialState().orders, query, "status", "ElhubFailed")).toBe(3);
  });
});

/** A form a seller filled in correctly on 2 October 2026. */
const FILLED: DraftFields = {
  customer: " Turid Fjellheim ",
  ssn: "240765 12345",
  phone: "+4791234567",
  email: "turid@eksempel.no",
  address: "Fjordgata 2, 7010 Trondheim",
  meterPointId: "7070 5750 0012 3456 78",
  product: "StrømSmart+",
  campaign: "none",
  startup: "Move",
  startDate: "2026-10-20",
  annualKwh: 16000,
  powerOfAttorney: true,
  note: "",
};

describe("New order draft parsing", () => {
  it("trims the name, strips spaces from the numbers and drops the empty campaign", () => {
    expect(parseDraft(FILLED, "2026-10-02")).toEqual({
      _tag: "Draft",
      draft: {
        customer: "Turid Fjellheim",
        ssn: "24076512345",
        phone: "+4791234567",
        email: "turid@eksempel.no",
        address: "Fjordgata 2, 7010 Trondheim",
        meterPointId: "707057500012345678",
        product: "StrømSmart+",
        campaign: undefined,
        startup: "Move",
        startDate: "2026-10-20",
        annualKwh: 16000,
        note: "",
      },
    });
  });

  it.each([
    ["a start date before today", { startDate: "2026-10-01" }, "startDate"],
    ["a metering point outside Norway's 7070 prefix", { meterPointId: "707157500012345678" }, "meterPointId"],
    ["an estimate above a household's range", { annualKwh: 250_000 }, "annualKwh"],
  ] as const)("rejects %s, and only that field", (_case, change, field) => {
    const parsed = parseDraft({ ...FILLED, ...change }, "2026-10-02");
    expect(parsed._tag === "Invalid" ? [...parsed.errors.keys()] : []).toEqual([field]);
  });

  // The phone field emits what it has so far, so a prefix alone or a short number reaches the parse.
  it.each([
    ["the country prefix alone", "+47"],
    ["a Norwegian number cut short", "+479123"],
  ])("rejects %s as the phone number", (_case, phone) => {
    const parsed = parseDraft({ ...FILLED, phone }, "2026-10-02");
    expect(parsed._tag === "Invalid" ? [...parsed.errors.keys()] : []).toEqual(["phone"]);
  });

  it("accepts a Swedish mobile number as the phone number", () => {
    const parsed = parseDraft({ ...FILLED, phone: "+46701234567" }, "2026-10-02");
    expect(parsed._tag === "Draft" ? parsed.draft.phone : undefined).toBe("+46701234567");
  });
});
