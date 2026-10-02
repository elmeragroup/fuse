/**
 * The landing's Funnel window paints each order status the way Funnel does. The oracle is the
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
} from "../src/app/(landing)/landing/app-shell/funnel-orders";
import type { OrderStatus, StatusTone } from "../src/app/(landing)/landing/app-shell/funnel-orders";
import { initialState, reduce } from "../src/app/(landing)/landing/app-shell/funnel-state";

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

describe("Funnel order statuses", () => {
  it.each(STATUS_ORDER)("maps %s to Core's integer and Funnel's tone", (status) => {
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
});
