import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { Table, VerticalTable } from "./table";

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

function verticalTable() {
  return createElement(
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
  );
}

describe("Table server boundary", () => {
  it("imports and renders Table and VerticalTable without a use client directive on the compound", () => {
    const tableHtml = renderToStaticMarkup(ordersTable());
    expect(tableHtml).toContain('data-slot="table-container"');
    expect(tableHtml).toContain("<table");
    expect(tableHtml).toContain("Recent orders");
    const verticalHtml = renderToStaticMarkup(verticalTable());
    expect(verticalHtml).toContain("<h2");
    expect(verticalHtml).toContain("Customer");
    expect(verticalHtml).toContain("Kari Nordmann");
    expect(verticalHtml).not.toContain("render=");
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
    const html = renderToStaticMarkup(verticalTable());
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
        "aria-labelledby": "wrapper-only",
        tableProps: { id: "facts-table", className: "w-full", title: "grid" },
      })
    );
    expect(html.match(/id="facts"/g)).toEqual(['id="facts"']);
    expect(html.match(/id="facts-table"/g)).toEqual(['id="facts-table"']);
    expect(html.match(/title="profile"/g)).toEqual(['title="profile"']);
    expect(html.match(/title="grid"/g)).toEqual(['title="grid"']);
    const wrapperEnd = html.indexOf(">", html.indexOf('data-slot="vertical-table"'));
    const wrapper = html.slice(0, wrapperEnd);
    expect(wrapper).toContain('id="facts"');
    expect(wrapper).toContain("max-w-md");
    expect(wrapper).toContain('aria-labelledby="wrapper-only"');
    expect(wrapper).not.toContain("facts-table");
    const tableStart = html.indexOf('data-slot="table"');
    const table = html.slice(tableStart, html.indexOf(">", tableStart));
    expect(table).not.toContain('id="facts"');
    expect(table).not.toContain("max-w-md");
    expect(table).not.toContain("wrapper-only");
    expect(table).toContain('id="facts-table"');
    expect(table).toContain("table-fixed");
    expect(table).toContain("w-full");
    expect(table).toContain('title="grid"');
  });

  it("names the inner table through tableProps, not Body aria attributes", () => {
    const html = renderToStaticMarkup(
      createElement(
        VerticalTable.Root,
        null,
        createElement(VerticalTable.Header, { id: "customer" }, "Customer"),
        createElement(VerticalTable.Body, {
          tableProps: { "aria-labelledby": "customer" },
        })
      )
    );
    const wrapperEnd = html.indexOf(">", html.indexOf('data-slot="vertical-table"'));
    const wrapper = html.slice(0, wrapperEnd);
    const tableStart = html.indexOf('data-slot="table"');
    const table = html.slice(tableStart, html.indexOf(">", tableStart));
    expect(wrapper).not.toContain("aria-labelledby");
    expect(table).toContain('aria-labelledby="customer"');
    expect(html).toContain('id="customer"');
  });

  it("keeps Table.Cell layout classes on the default Key td", () => {
    const html = renderToStaticMarkup(
      createElement(
        VerticalTable.Row,
        null,
        createElement(VerticalTable.Key, null, "Name"),
        createElement(VerticalTable.Value, null, "Kari Nordmann")
      )
    );
    const host = html.slice(html.indexOf("<td"), html.indexOf(">", html.indexOf("<td")) + 1);
    expect(host).toContain("<td");
    expect(host).toContain("bg-muted/50");
    expect(host).toContain("p-2");
    expect(host).toContain("align-middle");
    expect(host).toContain("in-data-[slot=frame]:first:p-[calc(--spacing(2.5)-1px)]");
  });

  it("lets Key render a row header without dropping Key classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        VerticalTable.Row,
        null,
        createElement(VerticalTable.Key, { render: createElement("th", { scope: "row" }) }, "Name"),
        createElement(VerticalTable.Value, null, "Kari Nordmann")
      )
    );
    const host = html.slice(html.indexOf("<th"), html.indexOf(">", html.indexOf("<th")) + 1);
    expect(host).toContain("<th");
    expect(host).toContain('scope="row"');
    expect(html).toContain("Name");
    expect(host).toContain("bg-muted/50");
    expect(host).toContain("p-2");
    expect(host).toContain("align-middle");
    expect(host).toContain("in-data-[slot=frame]:first:p-[calc(--spacing(2.5)-1px)]");
    expect(html).not.toMatch(/<td[^>]*>Name/);
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
