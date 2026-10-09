import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { CONTROL_SM, ROW, px, renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Button } from "../button/button";
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

/** The rendered height of the cell `name` names, which a `td` stretches to its row. */
function cellHeight(role: "cell" | "columnheader", name: string): number {
  return page.getByRole(role, { name, exact: true }).element().getBoundingClientRect().height;
}

function densityOrders(label: string) {
  return (
    <Table.Root aria-label={label}>
      <Table.Header>
        <Table.Row>
          <Table.Head>{`${label} order`}</Table.Head>
          <Table.Head>{`${label} actions`}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>{`${label} #1042`}</Table.Cell>
          <Table.Cell>{`${label} active`}</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>{`${label} #1043`}</Table.Cell>
          <Table.Cell>
            <Button variant="ghost" size="icon-sm" aria-label={`${label} row actions`}>
              <svg aria-hidden="true" viewBox="0 0 16 16" />
            </Button>
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
}

describe("Table rows follow density", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  it.each(DENSITIES)("sizes heads and cells from the row metrics at %s", (density) => {
    stampDensity(density);
    renderThemed(
      <div>
        {densityOrders("Loose")}
        <Frame.Root>{densityOrders("Framed")}</Frame.Root>
      </div>
    );
    const row = ROW[density];
    for (const label of ["Loose", "Framed"]) {
      expect(cellHeight("columnheader", `${label} order`), `${label} head`).toBe(row.headerHeight);
      expect(cellHeight("cell", `${label} #1042`), `${label} one-line row`).toBe(row.height);
      // An icon-sm button is the sm control square, and the row pads it on the block axis. A
      // framed cell also draws its 1px bottom rule.
      const actions = page.getByRole("cell", { name: `${label} #1043`, exact: true }).element();
      expect(cellHeight("cell", `${label} #1043`), `${label} actions row`).toBe(
        CONTROL_SM[density].height + 2 * row.py + px(getComputedStyle(actions).borderBottomWidth)
      );
    }
    const loose = getComputedStyle(page.getByRole("cell", { name: "Loose active", exact: true }).element());
    expect([loose.paddingTop, loose.paddingRight, loose.paddingBottom, loose.paddingLeft].map(px)).toEqual([
      row.py,
      row.px,
      row.py,
      row.px,
    ]);
    // A framed edge cell sits 2px further in than the row inset, less its 1px edge border.
    const edge = getComputedStyle(page.getByRole("cell", { name: "Framed #1042", exact: true }).element());
    expect(px(edge.paddingLeft) + px(edge.borderLeftWidth)).toBe(row.px + 2);
  });
});

describe("VerticalTable", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  it.each(DENSITIES)(
    "pads keys and values with the row metrics, and the compact variant by its own 4px, at %s",
    (density) => {
      stampDensity(density);
      renderThemed(
        <div>
          <VerticalTable.Root>
            <VerticalTable.Body data={[{ label: "Default key", value: "Default value" }]} />
          </VerticalTable.Root>
          <VerticalTable.Root variant="non-bordered-compact">
            <VerticalTable.Body data={[{ label: "Compact key", value: "Compact value" }]} />
          </VerticalTable.Root>
        </div>
      );
      const block = (name: string) => {
        const style = getComputedStyle(page.getByRole("cell", { name, exact: true }).element());
        return [px(style.paddingTop), px(style.paddingBottom)];
      };
      const row = ROW[density];
      expect(block("Default key")).toEqual([row.py, row.py]);
      expect(block("Default value")).toEqual([row.py, row.py]);
      expect(block("Compact key")).toEqual([4, 4]);
      expect(block("Compact value")).toEqual([4, 4]);
    }
  );

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
      .find((row) => row.textContent.trim() === "");
    if (!(loadingRow instanceof HTMLElement)) {
      throw new Error("expected a loading row");
    }
    expect(loadingRow.textContent.trim()).toBe("");
    // DOM audit: isLoading cells contain the skeleton node (no role; locate by the mandated slot).
    expect(loadingRow.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(page.getByRole("cell", { name: "Name" }).elements()).toHaveLength(0);
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
    // DOM audit: wrapper id and tableProps id are distinct, each unique; ids have no role.
    expect(document.body.querySelectorAll("#facts")).toHaveLength(1);
    expect(document.body.querySelectorAll("#facts-table")).toHaveLength(1);
    expect(document.getElementById("facts")?.getAttribute("aria-labelledby")).toBe("wrapper-only");
    expect(htmlTable("Customer").id).toBe("facts-table");

    const header = page.getByRole("rowheader", { name: "Name", exact: true }).element();
    expect(header.tagName).toBe("TH");
    expect(header.getAttribute("scope")).toBe("row");
    expect(page.getByRole("cell", { name: "Kari Nordmann", exact: true }).element().tagName).toBe("TD");
  });
});
