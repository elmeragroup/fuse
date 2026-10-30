import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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

describe("Table structure", () => {
  it("renders a scroll container around a semantic table and keeps the selected-row contract", () => {
    const html = renderToStaticMarkup(ordersTable());
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toMatch(/<th data-slot="table-head" class="[^"]*" scope="col">Order<\/th>/);
    expect(html).toMatch(/<td data-slot="table-cell" class="[^"]*">#1042<\/td>/);
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
    expect(host).toContain("px-(--row-px)");
    expect(host).toContain("align-middle");
    expect(host).toContain("framed-table:first:ps-(--frame-text-inset)");
    expect(html).not.toMatch(/<td[^>]*>Name/);
  });
});
