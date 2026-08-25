import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { px, renderThemed } from "../../../test/themed-browser-render";
import { Frame } from "../frame/frame";
import { Table, VerticalTable } from "./table";

function htmlTable(name?: string): HTMLTableElement {
  const element =
    name === undefined ? page.getByRole("table").element() : page.getByRole("table", { name }).element();
  if (!(element instanceof HTMLTableElement)) {
    throw new Error(`expected a table${name === undefined ? "" : ` named ${name}`}`);
  }
  return element;
}

function ordersMarkup({
  selected,
  caption,
}: {
  selected?: boolean;
  caption?: string;
} = {}) {
  return (
    <Table.Root>
      {caption === undefined ? null : <Table.Caption>{caption}</Table.Caption>}
      <Table.Header>
        <Table.Row>
          <Table.Head>Order</Table.Head>
          <Table.Head>Status</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row data-state={selected ? "selected" : undefined}>
          <Table.Cell>#1042</Table.Cell>
          <Table.Cell>Active</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>#1043</Table.Cell>
          <Table.Cell>Pending</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell>Total</Table.Cell>
          <Table.Cell>2</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  );
}

describe("Table", () => {
  it("exposes native table roles and lets a caption name the table", () => {
    renderThemed(ordersMarkup({ caption: "Recent orders" }));
    const table = htmlTable("Recent orders");
    expect(table).toBeTruthy();
    expect(page.getByRole("columnheader", { name: "Order", exact: true }).element().tagName).toBe("TH");
    expect(page.getByRole("columnheader", { name: "Status", exact: true }).element().tagName).toBe("TH");
    expect(page.getByRole("cell", { name: "#1042", exact: true }).element().tagName).toBe("TD");
    expect(page.getByRole("cell", { name: "Active", exact: true }).element().tagName).toBe("TD");
    expect(page.getByRole("row").elements().length).toBe(4);
  });

  it("puts header, body, and footer rows in the matching rowgroup", () => {
    renderThemed(ordersMarkup({ caption: "Recent orders" }));
    const groups = page.getByRole("rowgroup").elements();
    expect(groups).toHaveLength(3);
    const [header, body, footer] = groups;
    if (header === undefined || body === undefined || footer === undefined) {
      throw new Error("expected header, body, and footer rowgroups");
    }
    expect(header.tagName).toBe("THEAD");
    expect(body.tagName).toBe("TBODY");
    expect(footer.tagName).toBe("TFOOT");
    expect(header.querySelectorAll('[role="row"], tr')).toHaveLength(1);
    expect(body.querySelectorAll('[role="row"], tr')).toHaveLength(2);
    expect(footer.querySelectorAll('[role="row"], tr')).toHaveLength(1);
    expect(header.textContent).toContain("Order");
    expect(body.textContent).toContain("#1042");
    expect(footer.textContent).toContain("Total");
  });

  it("keeps a consumer data-state=selected on the row", () => {
    renderThemed(ordersMarkup({ selected: true, caption: "Recent orders" }));
    const selected = page
      .getByRole("row")
      .elements()
      .find((row) => row.textContent.includes("#1042"));
    if (!(selected instanceof HTMLElement)) {
      throw new Error("expected the selected order row");
    }
    expect(selected.getAttribute("data-state")).toBe("selected");
  });
});

describe("Table in-frame visual contract", () => {
  it("reshapes inside Frame.Root and hides the hairline outside a frame", () => {
    renderThemed(
      <div>
        <div data-outside="true">{ordersMarkup({ caption: "Loose orders" })}</div>
        <Frame.Root>
          <Frame.Panel>Account</Frame.Panel>
          {ordersMarkup({ caption: "Framed orders" })}
          <Frame.Panel>Notes</Frame.Panel>
        </Frame.Root>
      </div>
    );

    const loose = htmlTable("Loose orders");
    const framed = htmlTable("Framed orders");
    const looseBody = loose.querySelector("tbody");
    const framedBody = framed.querySelector("tbody");
    if (!(looseBody instanceof HTMLElement) || !(framedBody instanceof HTMLElement)) {
      throw new Error("expected both tables to have a body");
    }

    expect(getComputedStyle(framed).borderCollapse).toBe("separate");
    expect(getComputedStyle(framed).borderSpacing).toBe("0px");

    const framedRows = [...framed.querySelectorAll("tbody tr")].filter(
      (element): element is HTMLTableRowElement => element instanceof HTMLTableRowElement
    );
    const firstRow = framedRows[0];
    const lastRow = framedRows[framedRows.length - 1];
    const firstCell = firstRow?.cells[0];
    const firstRowLast = firstRow?.cells[firstRow.cells.length - 1];
    const lastRowFirst = lastRow?.cells[0];
    const lastCell = lastRow?.cells[lastRow.cells.length - 1];
    if (
      firstCell === undefined ||
      firstRowLast === undefined ||
      lastRowFirst === undefined ||
      lastCell === undefined
    ) {
      throw new Error("expected framed corner cells");
    }

    expect(px(getComputedStyle(firstCell).borderTopLeftRadius)).toBeGreaterThan(0);
    expect(px(getComputedStyle(firstRowLast).borderTopRightRadius)).toBeGreaterThan(0);
    expect(px(getComputedStyle(lastRowFirst).borderBottomLeftRadius)).toBeGreaterThan(0);
    expect(px(getComputedStyle(lastCell).borderBottomRightRadius)).toBeGreaterThan(0);

    const probe = document.createElement("div");
    probe.className = "bg-background";
    framed.append(probe);
    expect(getComputedStyle(firstCell).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();

    expect(getComputedStyle(framedBody, "::before").display).not.toBe("none");
    expect(getComputedStyle(framedBody, "::before").pointerEvents).toBe("none");
    expect(getComputedStyle(looseBody, "::before").display).toBe("none");
  });
});

describe("VerticalTable", () => {
  it("renders a level-2 heading and N data rows of two cells, with data before children", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header>Customer</VerticalTable.Header>
        <VerticalTable.Body
          data={[
            { label: "Name", value: "Kari Nordmann" },
            { label: "Meter point", value: "7070575000" },
          ]}>
          <VerticalTable.Row>
            <VerticalTable.Key>Grid company</VerticalTable.Key>
            <VerticalTable.Value>Skagerak Nett</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    const heading = page.getByRole("heading", { name: "Customer", exact: true, level: 2 }).element();
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("vertical-table-header");

    const table = htmlTable();
    const rows = page.getByRole("row").elements();
    expect(rows).toHaveLength(3);
    expect(page.getByRole("cell").elements()).toHaveLength(6);
    expect(rows[0]?.textContent).toContain("Name");
    expect(rows[0]?.textContent).toContain("Kari Nordmann");
    expect(rows[1]?.textContent).toContain("Meter point");
    expect(rows[2]?.textContent).toContain("Grid company");
    expect(table.querySelectorAll("td")).toHaveLength(6);
  });

  it("hides isHidden rows and swaps loading cells for a skeleton", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header>Customer</VerticalTable.Header>
        <VerticalTable.Body>
          <VerticalTable.Row isHidden>
            <VerticalTable.Key>Hidden</VerticalTable.Key>
            <VerticalTable.Value>Secret</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key isLoading>Name</VerticalTable.Key>
            <VerticalTable.Value isLoading>Kari Nordmann</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    const hidden = page
      .getByRole("row", { includeHidden: true })
      .elements()
      .find((row) => row.textContent.includes("Hidden"));
    if (!(hidden instanceof HTMLElement)) {
      throw new Error("expected the hidden row");
    }
    expect(hidden.classList.contains("hidden")).toBe(true);
    expect(getComputedStyle(hidden).display).toBe("none");

    const loadingRow = page
      .getByRole("row")
      .elements()
      .find((row) => row.querySelector('[data-slot="skeleton"]'));
    if (!(loadingRow instanceof HTMLElement)) {
      throw new Error("expected a loading row");
    }
    expect(loadingRow.textContent.trim()).toBe("");
    expect(loadingRow.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(page.getByRole("cell", { name: "Name" }).elements()).toHaveLength(0);
  });

  it("does not copy Body ids onto the inner table", () => {
    renderThemed(
      <VerticalTable.Body id="facts" className="max-w-md">
        <VerticalTable.Row>
          <VerticalTable.Key>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    );
    expect(document.querySelectorAll("#facts")).toHaveLength(1);
    const wrapper = document.getElementById("facts");
    expect(wrapper?.getAttribute("data-slot")).toBe("vertical-table");
    expect(wrapper?.className.split(/\s+/)).toContain("max-w-md");
    const table = htmlTable();
    expect(table.id).toBe("");
    expect(table.className.split(/\s+/)).toContain("table-fixed");
    expect(table.className.split(/\s+/)).not.toContain("max-w-md");
  });

  it("names the table from Header via tableProps and exposes a Key row header", () => {
    renderThemed(
      <VerticalTable.Root>
        <VerticalTable.Header id="customer">Customer</VerticalTable.Header>
        <VerticalTable.Body
          id="facts"
          aria-labelledby="wrapper-only"
          tableProps={{ "aria-labelledby": "customer", id: "facts-table" }}>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
            <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </VerticalTable.Root>
    );

    expect(htmlTable("Customer")).toBeTruthy();
    expect(document.querySelectorAll("#facts")).toHaveLength(1);
    expect(document.querySelectorAll("#facts-table")).toHaveLength(1);
    expect(document.getElementById("facts")?.getAttribute("aria-labelledby")).toBe("wrapper-only");
    expect(htmlTable("Customer").id).toBe("facts-table");

    const header = page.getByRole("rowheader", { name: "Name", exact: true }).element();
    expect(header.tagName).toBe("TH");
    expect(header.getAttribute("scope")).toBe("row");
    expect(page.getByRole("cell", { name: "Kari Nordmann", exact: true }).element().tagName).toBe("TD");
  });
});
