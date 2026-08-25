import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Table, VerticalTable } from "./table";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "table.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "table.ts"), "utf8");

const TABLE_SLOTS = [
  "table-container",
  "table",
  "table-header",
  "table-body",
  "table-footer",
  "table-row",
  "table-head",
  "table-cell",
  "table-caption",
] as const;

const BODY_IN_FRAME =
  "before:shadow-[0_1px_--theme(--color-black/6%)] in-data-[slot=frame]:shadow-xs/5 relative before:pointer-events-none before:absolute before:inset-px before:rounded-[calc(var(--radius-xl)-1px)] not-in-data-[slot=frame]:before:hidden in-data-[slot=frame]:rounded-xl [&_tr:last-child]:border-0 in-data-[slot=frame]:*:[tr]:border-0 in-data-[slot=frame]:*:[tr]:*:[td]:border-b in-data-[slot=frame]:*:[tr]:*:[td]:bg-background in-data-[slot=frame]:*:[tr]:*:[td]:bg-clip-padding in-data-[slot=frame]:*:[tr]:first:*:[td]:first:rounded-ss-xl in-data-[slot=frame]:*:[tr]:*:[td]:first:border-s in-data-[slot=frame]:*:[tr]:first:*:[td]:border-t in-data-[slot=frame]:*:[tr]:last:*:[td]:last:rounded-ee-xl in-data-[slot=frame]:*:[tr]:*:[td]:last:border-e in-data-[slot=frame]:*:[tr]:first:*:[td]:last:rounded-se-xl in-data-[slot=frame]:*:[tr]:last:*:[td]:first:rounded-es-xl in-data-[slot=frame]:*:[tr]:hover:*:[td]:bg-transparent in-data-[slot=frame]:*:[tr]:data-[state=selected]:*:[td]:bg-muted/72";

function ordersTable() {
  return createElement(
    Table.Root,
    null,
    createElement(Table.Caption, null, "Recent orders"),
    createElement(
      Table.Header,
      null,
      createElement(
        Table.Row,
        null,
        createElement(Table.Head, null, "Order"),
        createElement(Table.Head, null, "Status")
      )
    ),
    createElement(
      Table.Body,
      null,
      createElement(
        Table.Row,
        // SAFETY: createElement overloads omit data-* that JSX allows on Table.Row.
        { "data-state": "selected" } as Parameters<typeof Table.Row>[0],
        createElement(Table.Cell, null, "#1042"),
        createElement(Table.Cell, null, "Active")
      )
    ),
    createElement(
      Table.Footer,
      null,
      createElement(Table.Row, null, createElement(Table.Cell, { colSpan: 2 }, "1 row"))
    )
  );
}

function verticalBodySource(): string {
  const start = source.indexOf("function VerticalTableBody");
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("table source contract", () => {
  it("is a client namespace that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("not-dark:");
    expect(source).not.toContain("react-aria");
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("destructive");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Table, VerticalTable } from "./components/table/table"');
    expect(facade).not.toContain("tableVariants");
    expect(facade).not.toContain("export { TableHeader");
    expect(facade).not.toContain("TableVerticalBodyItem");
    expect(source).toContain('displayName = "Table.Root"');
    expect(source).toContain('displayName = "VerticalTable.Header"');
    for (const slot of TABLE_SLOTS) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      if (slot === "table-container") {
        continue;
      }
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
    const verticalRoot = 'data-slot="vertical-table-root"';
    expect(source.indexOf(verticalRoot)).toBeLessThan(
      source.indexOf("{...props}", source.indexOf(verticalRoot))
    );
    const verticalWrapper = 'data-slot="vertical-table"';
    expect(source.indexOf(verticalWrapper)).toBeLessThan(
      source.indexOf("{...props}", source.indexOf(verticalWrapper))
    );
  });

  it("keeps Header as a useRender island and does not double-spread Body props onto the inner table", () => {
    expect(source).toContain("useRender");
    expect(source).toContain("mergeProps");
    expect(source).toContain('"data-slot": "vertical-table-header"');
    expect(source).toContain("text-lg leading-snug font-medium font-heading text-inherit");
    const body = verticalBodySource();
    expect(body).toContain("Table.Root");
    expect(body).toContain('className="table-fixed"');
    expect(body).toContain('data-slot="vertical-table-body"');
    expect(body.match(/\{\.\.\.props\}/g)).toHaveLength(1);
    expect(body).not.toMatch(/<Table\.Root[\s\S]*\{\.\.\.props\}/);
  });

  it("keeps the in-frame Body chain, selected-row contract, and spacing/radius arithmetic", () => {
    expect(source).toContain(BODY_IN_FRAME);
    expect(source).toContain("data-[state=selected]:bg-muted/72");
    expect(source).toContain("in-data-[slot=frame]:data-[state=selected]:bg-transparent");
    expect(source).toContain("before:shadow-[0_1px_--theme(--color-black/6%)]");
    expect(source).toContain("before:rounded-[calc(var(--radius-xl)-1px)]");
    expect(source).toContain("in-data-[slot=frame]:first:p-[calc(--spacing(2.5)-1px)]");
    expect(source).toContain("in-data-[slot=frame]:last:p-[calc(--spacing(2.5)-1px)]");
    expect(source).toContain("h-10 px-2");
    expect(source).not.toContain("--control-h-md");
  });
});

describe("Table structure", () => {
  it("renders a scroll container around a semantic table and keeps the selected-row contract", () => {
    const html = renderToStaticMarkup(ordersTable());
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("<tfoot");
    expect(html).toContain("<caption");
    expect(html).toContain("Recent orders");
    expect(html).toContain('data-state="selected"');
    expect(html).toContain("#1042");
    for (const slot of TABLE_SLOTS) {
      expect(html, slot).toContain(`data-slot="${slot}"`);
    }
  });

  it("sends Root props and className to the table, not the scroll container", () => {
    const html = renderToStaticMarkup(
      createElement(Table.Root, { id: "orders", className: "min-w-xl", "aria-label": "Orders" })
    );
    const containerEnd = html.indexOf(">", html.indexOf('data-slot="table-container"'));
    const container = html.slice(0, containerEnd);
    expect(container).not.toContain('id="orders"');
    expect(container).not.toContain("min-w-xl");
    expect(html).toContain('id="orders"');
    expect(html).toContain("min-w-xl");
    expect(html).toContain('aria-label="Orders"');
    expect(html).toContain('data-slot="table"');
  });
});

describe("VerticalTable structure", () => {
  it("maps data rows first, then children, and hides isHidden rows", () => {
    const html = renderToStaticMarkup(
      createElement(
        VerticalTable.Root,
        null,
        createElement(VerticalTable.Header, null, "Customer"),
        createElement(
          VerticalTable.Body,
          {
            data: [
              { label: "Name", value: "Kari Nordmann" },
              { label: "Meter point", value: "7070575000" },
            ],
          },
          createElement(
            VerticalTable.Row,
            { isHidden: true },
            createElement(VerticalTable.Key, null, "Hidden"),
            createElement(VerticalTable.Value, null, "Secret")
          ),
          createElement(
            VerticalTable.Row,
            null,
            createElement(VerticalTable.Key, null, "Grid company"),
            createElement(VerticalTable.Value, null, "Skagerak Nett")
          )
        )
      )
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Customer");
    expect(html).toContain('data-slot="vertical-table-root"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-slot="vertical-table"');
    expect(html).toContain('data-slot="vertical-table-body"');
    expect(html.indexOf("Name")).toBeLessThan(html.indexOf("Kari Nordmann"));
    expect(html.indexOf("Kari Nordmann")).toBeLessThan(html.indexOf("Meter point"));
    expect(html.indexOf("7070575000")).toBeLessThan(html.indexOf("Grid company"));
    expect(html).toContain("hidden");
    expect(html).toContain("Secret");
  });

  it("does not duplicate ids or handlers from Body onto the inner table", () => {
    const html = renderToStaticMarkup(
      createElement(VerticalTable.Body, {
        id: "facts",
        className: "max-w-md",
        title: "profile",
      })
    );
    expect(html.match(/id="facts"/g)).toEqual(['id="facts"']);
    expect(html.match(/title="profile"/g)).toEqual(['title="profile"']);
    const wrapperEnd = html.indexOf(">", html.indexOf('data-slot="vertical-table"'));
    const wrapper = html.slice(0, wrapperEnd);
    expect(wrapper).toContain('id="facts"');
    expect(wrapper).toContain("max-w-md");
    const tableStart = html.indexOf('data-slot="table"');
    const table = html.slice(tableStart, html.indexOf(">", tableStart));
    expect(table).not.toContain('id="facts"');
    expect(table).not.toContain("max-w-md");
    expect(table).not.toContain("title=");
    expect(table).toContain("table-fixed");
  });

  it("swaps Key/Value children for a skeleton when isLoading", () => {
    const html = renderToStaticMarkup(
      createElement(
        VerticalTable.Row,
        null,
        createElement(VerticalTable.Key, { isLoading: true }, "Name"),
        createElement(VerticalTable.Value, { isLoading: true }, "Kari Nordmann")
      )
    );
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("Name");
    expect(html).not.toContain("Kari Nordmann");
    expect(html).toContain("h-4");
    expect(html).toContain("max-w-24");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });
});
