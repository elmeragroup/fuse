import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { ROW, px, renderThemed, stampDensity, textboxNamed } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { VerticalTable } from "./table";
import type { VerticalTableItem } from "./table";

function htmlTable(name?: string): HTMLTableElement {
  const element =
    name === undefined ? page.getByRole("table").element() : page.getByRole("table", { name }).element();
  if (!(element instanceof HTMLTableElement)) {
    throw new Error(`expected a table${name === undefined ? "" : ` named ${name}`}`);
  }
  return element;
}

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

  it("starts a row-header key at the inline start and closes the last row with the box's own border", () => {
    renderThemed(
      <VerticalTable.Body tableProps={{ "aria-label": "Meter facts" }}>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
          <VerticalTable.Value>Smart meter</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Grid area</VerticalTable.Key>
          <VerticalTable.Value>NO1</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    );
    const key = page.getByRole("rowheader", { name: "Meter type" }).element();
    expect(key.tagName).toBe("TH");
    expect(getComputedStyle(key).textAlign).toBe("start");
    const [first, last] = page.getByRole("row").elements();
    if (first === undefined || last === undefined) {
      throw new Error("expected two rows");
    }
    expect(getComputedStyle(first).borderBottomWidth).toBe("1px");
    expect(getComputedStyle(last).borderBottomWidth).toBe("0px");
  });

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
    expect(getComputedStyle(hidden).display).toBe("none");

    const loadingRow = page
      .getByRole("row")
      .elements()
      .find((row) => row.textContent.trim() === "");
    if (!(loadingRow instanceof HTMLElement)) {
      throw new Error("expected a loading row");
    }
    expect(loadingRow.textContent.trim()).toBe("");
    // IsLoading cells contain the skeleton node (no role; locate by the mandated slot).
    expect(loadingRow.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(page.getByRole("cell", { name: "Name" }).elements()).toHaveLength(0);
  });

  it("keeps a row's stateful value with its own item when an item before it is removed", async () => {
    const items: VerticalTableItem[] = [
      { id: "plan", label: "Plan", value: <input aria-label="Plan note" defaultValue="" /> },
      { id: "meter", label: "Meter", value: <input aria-label="Meter note" defaultValue="" /> },
    ];
    const { rerender } = renderThemed(<VerticalTable.Body data={items} />);
    await userEvent.fill(textboxNamed("Meter note"), "Reading due");

    rerender(<VerticalTable.Body data={items.slice(1)} />);
    expect(textboxNamed("Meter note")).toHaveProperty("value", "Reading due");
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
    // Wrapper id and tableProps id are distinct, each unique; ids have no role.
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
