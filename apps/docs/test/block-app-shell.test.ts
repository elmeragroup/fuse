import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";
import { BLOCK_FILES, TABLE_INSTALL_COMMAND } from "../src/app/(docs)/blocks/app-shell/block-files";
import {
  APP_BASE,
  APP_PAGES,
  appHome,
  appPages,
  pageForPath,
} from "../src/app/(docs)/blocks/app-shell/demos/app-config";
import {
  AS_OF,
  DAILY_CONSUMPTION,
  DAILY_INVOICING,
  INVOICES,
  METERING_POINTS,
  MONTHLY_ENERGY,
  osloMidnight,
  SPOT_TODAY,
  spotAt,
} from "../src/app/(docs)/blocks/app-shell/demos/power-data";
import { encodeBlockPreviewMessage, parseBlockPreviewMessage } from "../src/lib/block-preview";
import { fitViewport } from "../src/lib/block-viewport";
import { isWidePage } from "../src/lib/pages";

const demosDir = path.join(docsRoot, "src/app/(docs)/blocks/app-shell/demos");

describe("the app shell's Code view", () => {
  it("lists every file of the block's folder once", () => {
    // Oracle: the directory itself, which the preview route imports from.
    expect(BLOCK_FILES.map((entry) => entry.file).toSorted()).toEqual(readdirSync(demosDir).toSorted());
  });
});

describe("the app shell's copy steps", () => {
  it("install TanStack Table in Fuse's own peer range", () => {
    // Oracle: Fuse's package manifest, which owns the peer range the block's tables need.
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(docsRoot, "../../packages/fuse/package.json"), "utf8")
    );
    // SAFETY: the test reads one string, and a missing key reads undefined and fails the expectation.
    const peers = (parsed as { peerDependencies: Record<string, string | undefined> }).peerDependencies;
    expect(TABLE_INSTALL_COMMAND).toBe(
      `pnpm add @tanstack/react-table@${peers["@tanstack/react-table"] ?? "missing"}`
    );
  });
});

describe("the docs layout for a route", () => {
  it.each([
    ["/blocks/app-shell", true],
    ["/components/button", false],
    ["/handbook/theming", false],
    ["/blocks/app-shell/preview", false],
  ] as const)("lays %s out wide: %s", (pathname, wide) => {
    expect(isWidePage(pathname)).toBe(wide);
  });
});

describe("the app shell's pages", () => {
  it("are the four pages under the preview route, in sidebar order", () => {
    expect(APP_PAGES.map((page) => page.href)).toEqual([
      "/blocks/app-shell/preview",
      "/blocks/app-shell/preview/metering-points",
      "/blocks/app-shell/preview/invoices",
      "/blocks/app-shell/preview/settings",
    ]);
  });

  it.each([
    ["/blocks/app-shell/preview", "Overview"],
    ["/blocks/app-shell/preview/", "Overview"],
    ["/blocks/app-shell/preview/invoices", "Invoices"],
    ["/blocks/app-shell/preview/invoices/INV-2602-0001", "Invoices"],
    ["/blocks/app-shell/preview/settings", "Settings"],
  ])("marks %s as %s", (pathname, label) => {
    expect(pageForPath(pathname)?.label).toBe(label);
  });

  it("links home to / and keeps the children's routes when the app is the whole site", () => {
    const pages = appPages("");
    expect(appHome("")).toBe("/");
    expect(pages.map((page) => page.href)).toEqual(["/", "/metering-points", "/invoices", "/settings"]);
    expect(pageForPath("/", pages)?.label).toBe("Overview");
    expect(pageForPath("/invoices", pages)?.label).toBe("Invoices");
    expect(pageForPath("/invoices/INV-2602-0001", pages)?.label).toBe("Invoices");
    expect(pageForPath("/settings/", pages)?.label).toBe("Settings");
  });

  it("links home to its prefix when the app is mounted below the site's root", () => {
    expect(appHome("/dashboard")).toBe("/dashboard");
    expect(appPages("/dashboard").map((page) => page.href)).toEqual([
      "/dashboard",
      "/dashboard/metering-points",
      "/dashboard/invoices",
      "/dashboard/settings",
    ]);
  });

  it("marks nothing outside the app", () => {
    expect(pageForPath("/blocks/app-shell")).toBeUndefined();
    expect(pageForPath(`${APP_BASE}-other`)).toBeUndefined();
  });
});

describe("the app shell's power data", () => {
  it("starts each Oslo day on the offset its date has, across both clock changes", () => {
    // Winter time, UTC+1, up to and including the midnight that starts 29 March 2026.
    expect(osloMidnight(2026, 2, 29).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(osloMidnight(2026, 2, 30).toISOString()).toBe("2026-03-29T22:00:00.000Z");
    // Summer time, UTC+2, up to and including the midnight that starts 25 October 2026.
    expect(osloMidnight(2026, 9, 25).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(osloMidnight(2026, 9, 26).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("gives the spring-forward day 92 quarter-hours, skipping 02:00 to 03:00", () => {
    // 23 hours × 4.
    expect(SPOT_TODAY).toHaveLength(92);
    expect(SPOT_TODAY[0]?.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // The ninth quarter is 03:00 in Oslo, UTC+2: two hours after midnight in UTC terms.
    expect(SPOT_TODAY[8]?.start.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(SPOT_TODAY.at(-1)?.start.toISOString()).toBe("2026-03-29T21:45:00.000Z");
    // 13:20 in Oslo falls in the quarter from 13:15.
    expect(spotAt(AS_OF)?.start.toISOString()).toBe("2026-03-29T11:15:00.000Z");
  });

  it("finds a quarter only inside it, and nothing outside today", () => {
    // The last quarter runs from 23:45 to midnight on March 29, which is 21:45 to 22:00 UTC.
    expect(spotAt(new Date("2026-03-29T23:59:59+02:00"))?.start.toISOString()).toBe(
      "2026-03-29T21:45:00.000Z"
    );
    expect(spotAt(new Date("2026-03-30T00:00:00+02:00"))).toBeUndefined();
    expect(spotAt(new Date("2026-03-30T12:00:00+02:00"))).toBeUndefined();
    expect(spotAt(new Date("2026-03-28T23:59:59+01:00"))).toBeUndefined();
    expect(spotAt(new Date("2026-03-29T00:00:00+01:00"))?.start.toISOString()).toBe(
      "2026-03-28T23:00:00.000Z"
    );
  });

  it("prices the evening above the midday solar dip", () => {
    const at = (iso: string) => spotAt(new Date(iso))?.price ?? Number.NaN;
    expect(at("2026-03-29T19:00:00+02:00")).toBeGreaterThan(at("2026-03-29T13:00:00+02:00") * 2);
  });

  it("splits a year of 7,680 MWh and 312 MWh of solar by season", () => {
    const month = (iso: string) => MONTHLY_ENERGY.find((row) => row.month.toISOString() === iso);
    // January 2026: 12.6 % of 7,680 is 967.68; July 2025: 4.6 % is 353.28.
    expect(month("2025-12-31T23:00:00.000Z")?.consumption).toBe(967.7);
    expect(month("2025-06-30T22:00:00.000Z")?.consumption).toBe(353.3);
    // June 2025: 16 % of 312 is 49.92; December 2025: 1 % is 3.12.
    expect(month("2025-05-31T22:00:00.000Z")?.production).toBe(49.9);
    expect(month("2025-11-30T23:00:00.000Z")?.production).toBe(3.1);
    // Twelve months, March 2025 to February 2026.
    expect(MONTHLY_ENERGY).toHaveLength(12);
    expect(MONTHLY_ENERGY[0]?.month.toISOString()).toBe("2025-02-28T23:00:00.000Z");
  });

  it("has readings for 1 to 28 March and leaves today and later pending", () => {
    expect(DAILY_CONSUMPTION).toHaveLength(31);
    expect(DAILY_CONSUMPTION.filter((day) => day.thisYear !== null)).toHaveLength(28);
    expect(DAILY_CONSUMPTION[28]?.thisYear).toBeNull();
    expect(DAILY_CONSUMPTION[28]?.day.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // March 2025 runs over the whole month, for comparison.
    expect(DAILY_CONSUMPTION.every((day) => day.lastYear > 0)).toBe(true);
  });

  it("invoices each day at its consumption and its spot price, so the days differ", () => {
    // March 1: 30.2 MWh at 96.4 øre spot plus 4.9 øre markup, with 25 % VAT:
    // 30,200 kWh × 1.013 kr × 1.25 = 38,240.75 kr.
    expect(DAILY_CONSUMPTION[0]?.thisYear).toBe(30.2);
    expect(DAILY_INVOICING[0]).toBe(38_240.75);
    expect(DAILY_INVOICING).toHaveLength(28);
    expect(new Set(DAILY_INVOICING).size).toBe(28);
  });

  it("holds 480 metering points in the counts the cycles give", () => {
    const count = (keep: (point: (typeof METERING_POINTS)[number]) => boolean) =>
      METERING_POINTS.filter(keep).length;
    expect(METERING_POINTS).toHaveLength(480);
    expect(new Set(METERING_POINTS.map((point) => point.id)).size).toBe(480);
    // Areas repeat every 10 rows, 4 of them NO1 and 1 NO4; statuses every 12, 1 disconnected;
    // contracts every 4, 1 fixed. NO4 and fixed meet at index 18 mod 20; NO4 (even) and
    // disconnected (odd) never meet.
    expect(count((point) => point.priceArea === "NO1")).toBe(192);
    expect(count((point) => point.priceArea === "NO4")).toBe(48);
    expect(count((point) => point.status === "disconnected")).toBe(40);
    expect(count((point) => point.contract === "fixed")).toBe(120);
    expect(count((point) => point.priceArea === "NO4" && point.contract === "fixed")).toBe(24);
    expect(count((point) => point.priceArea === "NO4" && point.status === "disconnected")).toBe(0);
  });

  it("gives every metering point an 18-digit GSRN whose GS1 check digit holds", () => {
    // The GS1 rule over the whole number, written here apart from the generator: weigh the digits 1,
    // 3, 1, 3 … from the right, the check digit first, and the sum is a multiple of 10.
    const holds = (gsrn: string) =>
      gsrn
        .split("")
        .reverse()
        .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0) %
        10 ===
      0;
    // The rule's oracle: GS1's worked GTIN-13, 629104150021 with check digit 3, holds, and a wrong
    // check digit does not.
    expect(holds("6291041500213")).toBe(true);
    expect(holds("6291041500210")).toBe(false);
    for (const point of METERING_POINTS) {
      expect(point.id, point.id).toMatch(/^7070575\d{11}$/u);
      expect(holds(point.id), point.id).toBe(true);
    }
  });

  it("reads zero at a disconnected point and nothing before an onboarding point's start", () => {
    for (const point of METERING_POINTS) {
      if (point.status === "disconnected") expect(point.last30Days.every((day) => day === 0)).toBe(true);
      if (point.status === "onboarding") expect(point.last30Days[0]).toBeNull();
    }
  });

  it("bills 72 invoices: 48 paid, 12 open, 6 overdue and 6 credited", () => {
    const states = INVOICES.map((invoice) => invoice.state._tag);
    expect(INVOICES).toHaveLength(72);
    expect(states.filter((state) => state === "Paid")).toHaveLength(48);
    expect(states.filter((state) => state === "Open")).toHaveLength(12);
    expect(states.filter((state) => state === "Overdue")).toHaveLength(6);
    expect(states.filter((state) => state === "Credited")).toHaveLength(6);
  });

  it("charges 25 % VAT outside NO4 and none in it, rounded to the øre", () => {
    // Half an øre, plus float noise: the furthest a rounding to whole øre can move an amount.
    const HALF_ORE = 0.005 + 1e-9;
    for (const invoice of INVOICES) {
      const lines = invoice.lines.reduce((total, line) => total + line.amount, 0);
      const rate = invoice.priceArea === "NO4" ? 0 : 0.25;
      expect(Math.abs(invoice.vat - lines * rate), invoice.number).toBeLessThanOrEqual(HALF_ORE);
      expect(Math.abs(invoice.total - (lines + invoice.vat)), invoice.number).toBeLessThanOrEqual(HALF_ORE);
    }
    expect(INVOICES.some((invoice) => invoice.priceArea === "NO4" && invoice.vat === 0)).toBe(true);
  });
});

describe("the preview's viewports", () => {
  it.each([
    ["desktop", 1200, { width: 1200, scale: 1 }],
    ["desktop", 896, { width: 1024, scale: 0.875 }],
    ["tablet", 1200, { width: 768, scale: 1 }],
    ["tablet", 384, { width: 768, scale: 0.5 }],
    ["phone", 1200, { width: 390, scale: 1 }],
  ] as const)("fits %s into a %ipx window", (viewport, available, fit) => {
    expect(fitViewport(viewport, available)).toEqual(fit);
  });
});

describe("the preview's messages", () => {
  it("carries a theme as plain data and reads it back", () => {
    const theme = { variant: "external", brand: "elma", segment: "private" } as const;
    const wire = encodeBlockPreviewMessage({ _tag: "Theme", theme });
    expect(wire).toEqual({ source: "fuse-block-preview", _tag: "Theme", theme: "external-elma-private" });
    expect(parseBlockPreviewMessage(structuredClone(wire))).toEqual({ _tag: "Theme", theme });
  });

  it.each([
    ["another sender's data", { source: "other", _tag: "Ready" }],
    [
      "a theme Fuse does not know",
      { source: "fuse-block-preview", _tag: "Theme", theme: "external-acme-private" },
    ],
    ["a path to another host", { source: "fuse-block-preview", _tag: "Location", path: "//evil.example/x" }],
    ["a script URL", { source: "fuse-block-preview", _tag: "Location", path: "javascript:alert(1)" }],
    ["an unknown tag", { source: "fuse-block-preview", _tag: "Navigate" }],
    ["a string", "fuse-block-preview"],
  ])("ignores %s", (_case, data) => {
    expect(parseBlockPreviewMessage(data)).toBeUndefined();
  });

  it("carries a location as its path and search, and reads it back", () => {
    const wire = encodeBlockPreviewMessage({
      _tag: "Location",
      path: "/blocks/app-shell/preview/invoices?page=2",
    });
    expect(wire).toEqual({
      source: "fuse-block-preview",
      _tag: "Location",
      path: "/blocks/app-shell/preview/invoices?page=2",
    });
    expect(parseBlockPreviewMessage(structuredClone(wire))).toEqual({
      _tag: "Location",
      path: "/blocks/app-shell/preview/invoices?page=2",
    });
  });
});
