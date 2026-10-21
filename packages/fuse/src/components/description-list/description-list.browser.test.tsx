import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  headingNamed,
  px,
  renderThemed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import type { Density } from "../../theme/density";
import { DescriptionList } from "./description-list";

/**
 * The inline layout's metrics in px, written out by hand rather than read from the library: the
 * label type is 14/20 dense and 16/24 comfortable, Items are spaced by the small surface gap, 8px
 * dense and 12px comfortable, a term and its details by the medium surface gap, 12px and 16px,
 * and consecutive lists by the large surface gap, 16px and 24px.
 */
const INLINE = {
  dense: { text: 14, leading: 20, rowGap: 8, columnGap: 12, listGap: 16 },
  comfortable: { text: 16, leading: 24, rowGap: 12, columnGap: 16, listGap: 24 },
} as const satisfies Record<
  Density,
  {
    readonly text: number;
    readonly leading: number;
    readonly rowGap: number;
    readonly columnGap: number;
    readonly listGap: number;
  }
>;

/** The inline list's content width in the row-sizing tests: a phone card's. */
const ROW_WIDTH = 320;

/** The `<dl>` around a cell. */
function listOf(cell: HTMLElement): HTMLElement {
  const list = cell.closest("dl");
  if (!(list instanceof HTMLElement)) {
    throw new Error(`expected a description list around ${cell.textContent}`);
  }
  return list;
}

/** The Item around a cell: the cell's parent, which has no role or text of its own. */
function itemOf(cell: HTMLElement): HTMLElement {
  const item = cell.parentElement;
  if (item?.tagName !== "DIV") {
    throw new Error(`expected an Item around ${cell.textContent}`);
  }
  return item;
}

/** The box of the cell whose text is `name`. */
function boxOf(name: string): DOMRect {
  return textNamed(name).getBoundingClientRect();
}

/**
 * The width `text` takes on one line in `cell`'s font, measured in a probe outside any list, so
 * the oracle is the text and the font, not the layout under test.
 */
function naturalWidth(text: string, cell: HTMLElement): number {
  const style = getComputedStyle(cell);
  const probe = document.createElement("span");
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontSize = style.fontSize;
  probe.style.fontWeight = style.fontWeight;
  probe.style.whiteSpace = "nowrap";
  probe.textContent = text;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/** The width of the widest space-separated word of `text` in `cell`'s font. */
function widestWord(text: string, cell: HTMLElement): number {
  return Math.max(...text.split(" ").map((word) => naturalWidth(word, cell)));
}

/** The lines a cell's text renders on, as one box per line read through a `Range`. */
function textLines(cell: HTMLElement): DOMRect[] {
  const range = document.createRange();
  range.selectNodeContents(cell);
  const lines: DOMRect[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.width > 0 && !lines.some((line) => Math.abs(line.top - rect.top) < 1)) {
      lines.push(rect);
    }
  }
  return lines;
}

/** The words of a one-text-node cell that render across more than one line. */
function wordsSplitAcrossLines(cell: HTMLElement): string[] {
  const text = cell.firstChild;
  if (!(text instanceof Text)) {
    throw new Error(`expected one text node in ${cell.textContent}`);
  }
  const split: string[] = [];
  let start = 0;
  for (const word of text.data.split(" ")) {
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + word.length);
    const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
    if (tops.size > 1) {
      split.push(word);
    }
    start += word.length + 1;
  }
  return split;
}

/** An inline list `ROW_WIDTH` wide in a padded box, one Item per term and details pair. */
function renderInlineRows(rows: readonly (readonly [string, string])[]) {
  renderThemed(
    <div style={{ padding: 24 }}>
      <DescriptionList.Content layout="inline" style={{ width: ROW_WIDTH }}>
        {rows.map(([term, details]) => (
          <DescriptionList.Item key={term}>
            <DescriptionList.Term>{term}</DescriptionList.Term>
            <DescriptionList.Details>{details}</DescriptionList.Details>
          </DescriptionList.Item>
        ))}
      </DescriptionList.Content>
    </div>
  );
}

/** Nothing in the list paints past its own box or any Item's. */
function expectNoOverflow(list: HTMLElement): void {
  expect(list.scrollWidth, "list overflow").toBeLessThanOrEqual(list.clientWidth);
  for (const item of list.children) {
    expect(item.scrollWidth, `${item.textContent} overflow`).toBeLessThanOrEqual(item.clientWidth);
  }
}

function renderBasicList() {
  renderThemed(
    <DescriptionList.Root>
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Item>
          <DescriptionList.Term>Name</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Meter point</DescriptionList.Term>
          <DescriptionList.Details>7070575000</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}

describe("DescriptionList", () => {
  it("renders a heading, a dl, and one div per group holding its term and details in DOM order", () => {
    renderBasicList();
    const heading = headingNamed("Customer", 2);
    expect(heading.tagName).toBe("H2");
    expect(heading.getAttribute("data-slot")).toBe("description-list-heading");
    expect(heading.getAttribute("data-slot")).not.toBe("heading");

    const content = heading.nextElementSibling;
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the description list content");
    }
    expect(content.tagName).toBe("DL");
    expect([...content.children].map((item) => item.tagName)).toEqual(["DIV", "DIV"]);
    expect(
      [...content.children].map((item) => [...item.children].map((cell) => [cell.tagName, cell.textContent]))
    ).toEqual([
      [
        ["DT", "Name"],
        ["DD", "Kari Nordmann"],
      ],
      [
        ["DT", "Meter point"],
        ["DD", "7070575000"],
      ],
    ]);
  });

  it("lets a render override change the heading level without losing classes or data-slot", () => {
    renderThemed(
      <DescriptionList.Root>
        <DescriptionList.Heading>Customer</DescriptionList.Heading>
        <DescriptionList.Heading render={<h3 />}>Section</DescriptionList.Heading>
      </DescriptionList.Root>
    );
    const defaultHeading = headingNamed("Customer", 2);
    expect(defaultHeading.tagName).toBe("H2");
    expect(defaultHeading.getAttribute("data-slot")).toBe("description-list-heading");
    const override = headingNamed("Section", 3);
    expect(override.tagName).toBe("H3");
    expect(override.getAttribute("data-slot")).toBe("description-list-heading");
    expect(getComputedStyle(defaultHeading).fontFamily).toBe(getComputedStyle(override).fontFamily);
    expect(getComputedStyle(defaultHeading).fontSize).toBe(getComputedStyle(override).fontSize);
  });

  it("passes Root attributes through and adds no classes of its own", () => {
    renderThemed(
      <DescriptionList.Root id="customer" data-track="profile">
        <DescriptionList.Heading>Customer</DescriptionList.Heading>
      </DescriptionList.Root>
    );
    const root = document.getElementById("customer");
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the description-list root");
    }
    expect(root.tagName).toBe("DIV");
    expect(root.getAttribute("data-track")).toBe("profile");
    expect(root.className).toBe("");
  });

  it("lets a test id on an Item find its row", async () => {
    renderThemed(
      <DescriptionList.Content layout="inline">
        <DescriptionList.Item data-testid="order-created">
          <DescriptionList.Term>Created</DescriptionList.Term>
          <DescriptionList.Details>21 October 2026 at 12:31:32</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    );
    await expect
      .element(page.getByTestId("order-created"))
      .toHaveTextContent("Created21 October 2026 at 12:31:32");
  });

  describe("responsive layout", () => {
    it("forms two columns at sm with the term column capped at min(50%, 20rem) and a rule above every Item but the first", async () => {
      await page.viewport(1280, 720);
      renderThemed(
        <DescriptionList.Content style={{ width: 800 }}>
          <DescriptionList.Item>
            <DescriptionList.Term>Name</DescriptionList.Term>
            <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Address</DescriptionList.Term>
            <DescriptionList.Details>Storgata 1, 3611 Kongsberg</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      const list = listOf(textNamed("Name")).getBoundingClientRect();
      const nameBox = boxOf("Name");
      const nameDetails = boxOf("Kari Nordmann");
      expect(nameDetails.left).toBeGreaterThan(nameBox.right - 1);
      expect(Math.abs(nameBox.top - nameDetails.top)).toBeLessThan(2);
      expect(nameBox.width).toBeLessThanOrEqual(320);
      expect(nameBox.width).toBeGreaterThan(300);
      // Every Item's term column is the same width, so the details line up.
      expect(boxOf("Storgata 1, 3611 Kongsberg").left).toBeCloseTo(nameDetails.left, 0);

      const first = itemOf(textNamed("Name"));
      const second = itemOf(textNamed("Address"));
      expect(px(getComputedStyle(first).borderTopWidth)).toBe(0);
      expect(px(getComputedStyle(second).borderTopWidth)).toBeGreaterThan(0);
      expect(second.getBoundingClientRect().width).toBeCloseTo(list.width, 0);
      for (const name of ["Name", "Kari Nordmann", "Address", "Storgata 1, 3611 Kongsberg"]) {
        expect(px(getComputedStyle(textNamed(name)).borderTopWidth), name).toBe(0);
      }
    });

    it("sizes a shrink-wrapped list's columns to its widest term and widest details across Items", async () => {
      await page.viewport(1280, 720);
      const widestTerm = "Customer number";
      const widestDetails = "Storgata 1, 3611 Kongsberg";
      renderThemed(
        <div style={{ width: "fit-content" }}>
          <DescriptionList.Content>
            <DescriptionList.Item>
              <DescriptionList.Term>{widestTerm}</DescriptionList.Term>
              <DescriptionList.Details>1</DescriptionList.Details>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Name</DescriptionList.Term>
              <DescriptionList.Details>{widestDetails}</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        </div>
      );
      const term = textNamed(widestTerm);
      const details = textNamed(widestDetails);
      // One grid's max-content: the widest term with its end padding beside the widest details.
      const expected =
        naturalWidth(widestTerm, term) +
        px(getComputedStyle(term).paddingRight) +
        naturalWidth(widestDetails, details);
      expect(listOf(term).getBoundingClientRect().width).toBeCloseTo(expected, 0);
      expect(boxOf("1").left).toBeCloseTo(details.getBoundingClientRect().left, 0);
    });

    it("puts several terms in the term column with the details on the last one's row, a later details under the first, and no rule inside an Item", async () => {
      await page.viewport(1280, 720);
      renderThemed(
        <DescriptionList.Content style={{ width: 800 }}>
          <DescriptionList.Item>
            <DescriptionList.Term>Phone</DescriptionList.Term>
            <DescriptionList.Term>Mobile</DescriptionList.Term>
            <DescriptionList.Details>+47 900 12 345</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Name</DescriptionList.Term>
            <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
            <DescriptionList.Details>Also billed as Nordmann Drift AS</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      expect(boxOf("Mobile").top).toBeGreaterThanOrEqual(boxOf("Phone").bottom - 1);
      expect(Math.abs(boxOf("+47 900 12 345").top - boxOf("Mobile").top)).toBeLessThan(2);

      const later = boxOf("Also billed as Nordmann Drift AS");
      expect(later.top).toBeGreaterThanOrEqual(boxOf("Kari Nordmann").bottom - 1);
      expect(later.left).toBeCloseTo(boxOf("Kari Nordmann").left, 0);
      for (const name of [
        "Phone",
        "Mobile",
        "+47 900 12 345",
        "Kari Nordmann",
        "Also billed as Nordmann Drift AS",
      ]) {
        expect(px(getComputedStyle(textNamed(name)).borderTopWidth), name).toBe(0);
      }
      expect(px(getComputedStyle(itemOf(textNamed("Name"))).borderTopWidth)).toBeGreaterThan(0);
    });

    it("stacks each details under its term below sm", async () => {
      await page.viewport(390, 800);
      renderBasicList();
      for (const [term, details] of [
        ["Name", "Kari Nordmann"],
        ["Meter point", "7070575000"],
      ] as const) {
        expect(boxOf(details).top, details).toBeGreaterThanOrEqual(boxOf(term).bottom - 1);
        expect(boxOf(details).left, details).toBeCloseTo(boxOf(term).left, 0);
      }
    });
  });

  describe("inline layout", () => {
    it.each(DENSITIES)(
      "sizes each Item's row on its own, so a pair that fits stays on one line whatever the other rows hold (%s)",
      (density) => {
        stampDensity(density);
        const rows = [
          ["Email", "kari.nordmann@elmera-example.com"],
          ["Chosen delivery start date", "28 Oct 2026"],
        ] as const;
        renderInlineRows(rows);
        const list = listOf(textNamed("Email"));
        const right = list.getBoundingClientRect().right;
        const { columnGap, leading } = INLINE[density];
        for (const [term, details] of rows) {
          const termCell = textNamed(term);
          const detailsCell = textNamed(details);
          expect(
            naturalWidth(term, termCell) + columnGap + naturalWidth(details, detailsCell),
            `precondition: ${term} and its details fit on one row`
          ).toBeLessThanOrEqual(ROW_WIDTH);
          const [termLine, ...termRest] = textLines(termCell);
          const [detailsLine, ...detailsRest] = textLines(detailsCell);
          expect(termRest, `${term} on one line`).toEqual([]);
          expect(detailsRest, `${details} on one line`).toEqual([]);
          expect(Math.abs((termLine?.top ?? 0) - (detailsLine?.top ?? Infinity)), term).toBeLessThan(1);
          expect(detailsLine?.right, details).toBeCloseTo(right, 0);
          expect(detailsCell.getBoundingClientRect().height, details).toBeCloseTo(leading, 0);
        }
        expect(getComputedStyle(textNamed("28 Oct 2026")).textAlign).toBe("end");
        expectNoOverflow(list);
      }
    );

    it.each(DENSITIES)(
      "wraps a long term beside a short details, level with the term's first line (%s)",
      (density) => {
        stampDensity(density);
        const term = "Keep the existing phone number on the new plan";
        const details = "+47 912 34 567";
        renderInlineRows([[term, details]]);
        const termCell = textNamed(term);
        const detailsCell = textNamed(details);
        const { columnGap } = INLINE[density];
        expect(
          naturalWidth(term, termCell) + columnGap + naturalWidth(details, detailsCell),
          "precondition: the pair does not fit on one line"
        ).toBeGreaterThan(ROW_WIDTH);

        const termLines = textLines(termCell);
        const detailsLines = textLines(detailsCell);
        expect(termLines.length).toBeGreaterThan(1);
        expect(detailsLines).toHaveLength(1);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(detailsLines[0]?.right).toBeCloseTo(listOf(termCell).getBoundingClientRect().right, 0);
        expect(detailsLines[0]?.left ?? 0).toBeGreaterThanOrEqual(
          Math.max(...termLines.map((line) => line.right)) + columnGap - 1
        );
      }
    );

    it.each(DENSITIES)(
      "keeps a details too wide for the term's line beside the term, wrapping it there between words (%s)",
      (density) => {
        stampDensity(density);
        const rows = [
          ["Created", "21 October 2026 at 12:31:32, confirmed by SMS"],
          ["Address", "Storgata 1, inngang B, 4. etasje, 3611 Kongsberg, Buskerud"],
        ] as const;
        renderInlineRows(rows);
        const list = listOf(textNamed("Created"));
        const right = list.getBoundingClientRect().right;
        for (const [term, details] of rows) {
          const termCell = textNamed(term);
          const detailsCell = textNamed(details);
          expect(
            naturalWidth(term, termCell) + INLINE[density].columnGap + naturalWidth(details, detailsCell),
            `precondition: ${term} and its details don't fit on one line`
          ).toBeGreaterThan(ROW_WIDTH);
          const termLines = textLines(termCell);
          const detailsLines = textLines(detailsCell);
          expect(termLines, `${term} on one line`).toHaveLength(1);
          expect(detailsLines.length, details).toBeGreaterThan(1);
          expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity)), term).toBeLessThan(
            1
          );
          expect(wordsSplitAcrossLines(detailsCell), details).toEqual([]);
          for (const line of detailsLines) {
            expect(line.right, details).toBeCloseTo(right, 0);
            expect(line.left, details).toBeGreaterThanOrEqual(
              (termLines[0]?.right ?? Infinity) + INLINE[density].columnGap - 1
            );
          }
        }
        expectNoOverflow(list);
      }
    );

    it.each(DENSITIES)(
      "keeps an unbroken details whole beside its term by wrapping the term down to its widest word (%s)",
      (density) => {
        stampDensity(density);
        const term = "E-mail address for invoices";
        const details = "kari.nordmann@elmeramail.com";
        renderInlineRows([[term, details]]);
        const termCell = textNamed(term);
        const detailsCell = textNamed(details);
        const { columnGap } = INLINE[density];
        const valueWidth = naturalWidth(details, detailsCell);
        expect(
          naturalWidth(term, termCell) + columnGap + valueWidth,
          "precondition: the pair does not fit on one line"
        ).toBeGreaterThan(ROW_WIDTH);
        expect(
          widestWord(term, termCell) + columnGap + valueWidth,
          "precondition: the details fits whole beside the term's widest word"
        ).toBeLessThanOrEqual(ROW_WIDTH);

        const termLines = textLines(termCell);
        const detailsLines = textLines(detailsCell);
        expect(termLines.length).toBeGreaterThan(1);
        expect(wordsSplitAcrossLines(termCell)).toEqual([]);
        expect(detailsLines).toHaveLength(1);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(detailsLines[0]?.right).toBeCloseTo(listOf(termCell).getBoundingClientRect().right, 0);
        expectNoOverflow(listOf(termCell));
      }
    );

    it.each(DENSITIES)(
      "shares a row between a long term and a long details, wrapping both rather than squeezing one (%s)",
      (density) => {
        stampDensity(density);
        const term = "Keep your existing phone number";
        const details = "Delivered as eFaktura in your online bank";
        renderInlineRows([[term, details]]);
        const termCell = textNamed(term);
        const detailsCell = textNamed(details);
        const half = (ROW_WIDTH - INLINE[density].columnGap) / 2;
        expect(
          naturalWidth(term, termCell),
          "precondition: the term is wider than half the row"
        ).toBeGreaterThan(half);
        expect(
          naturalWidth(details, detailsCell),
          "precondition: the details is wider than half the row"
        ).toBeGreaterThan(half);

        const termLines = textLines(termCell);
        const detailsLines = textLines(detailsCell);
        expect(termLines.length, "term wraps").toBeGreaterThan(1);
        expect(detailsLines.length, "details wraps").toBeGreaterThan(1);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(wordsSplitAcrossLines(termCell)).toEqual([]);
        expect(wordsSplitAcrossLines(detailsCell)).toEqual([]);
        expectNoOverflow(listOf(termCell));
      }
    );

    it.each(DENSITIES)(
      "breaks an unbroken details wider than the row beside its term without overflow (%s)",
      (density) => {
        stampDensity(density);
        const details = "707057500012345678901234567890123456789012345678901234567890";
        renderInlineRows([["Meter", details]]);
        const detailsCell = textNamed(details);
        expect(
          naturalWidth(details, detailsCell),
          "precondition: the details is wider than the row"
        ).toBeGreaterThan(ROW_WIDTH);
        const termLines = textLines(textNamed("Meter"));
        const detailsLines = textLines(detailsCell);
        expect(termLines).toHaveLength(1);
        expect(detailsLines.length).toBeGreaterThan(1);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(detailsCell.scrollWidth).toBeLessThanOrEqual(detailsCell.clientWidth);
        expectNoOverflow(listOf(detailsCell));
      }
    );

    it("puts an Item's earlier terms and later details on lines of their own, pairing its last term with its first details", () => {
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: ROW_WIDTH }}>
          <DescriptionList.Item>
            <DescriptionList.Term>Owner</DescriptionList.Term>
            <DescriptionList.Term>Payer</DescriptionList.Term>
            <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Products</DescriptionList.Term>
            <DescriptionList.Details>Spot</DescriptionList.Details>
            <DescriptionList.Details>Insurance</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      const right = listOf(textNamed("Owner")).getBoundingClientRect().right;
      const owner = boxOf("Owner");
      const payer = boxOf("Payer");
      expect(payer.left).toBeCloseTo(owner.left, 0);
      expect(payer.top).toBeGreaterThanOrEqual(owner.bottom - 1);
      expect(Math.abs(boxOf("Kari Nordmann").top - payer.top)).toBeLessThan(1);
      expect(boxOf("Kari Nordmann").right).toBeCloseTo(right, 0);

      const products = boxOf("Products");
      expect(Math.abs(boxOf("Spot").top - products.top)).toBeLessThan(1);
      const insurance = textLines(textNamed("Insurance"));
      expect(insurance).toHaveLength(1);
      expect(insurance[0]?.top ?? 0).toBeGreaterThanOrEqual(boxOf("Spot").bottom - 1);
      expect(insurance[0]?.right).toBeCloseTo(right, 0);
    });

    it.each(DENSITIES)(
      "keeps the first details beside its term in an Item with several details, even when it must break (%s)",
      (density) => {
        stampDensity(density);
        const details = "707057500012345678901234567890123456789012345678901234567890";
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: ROW_WIDTH }}>
            <DescriptionList.Item>
              <DescriptionList.Term>Meter</DescriptionList.Term>
              <DescriptionList.Details>{details}</DescriptionList.Details>
              <DescriptionList.Details>Smart meter</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        );
        const detailsCell = textNamed(details);
        expect(
          naturalWidth(details, detailsCell),
          "precondition: the details is wider than the row"
        ).toBeGreaterThan(ROW_WIDTH);
        const termLines = textLines(textNamed("Meter"));
        const detailsLines = textLines(detailsCell);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(detailsCell.scrollWidth).toBeLessThanOrEqual(detailsCell.clientWidth);
        const later = textLines(textNamed("Smart meter"));
        expect(later).toHaveLength(1);
        expect(later[0]?.top ?? 0).toBeGreaterThanOrEqual(detailsCell.getBoundingClientRect().bottom - 1);
        expect(later[0]?.right).toBeCloseTo(listOf(detailsCell).getBoundingClientRect().right, 0);
        expectNoOverflow(listOf(detailsCell));
      }
    );

    it.each(DENSITIES)(
      "keeps an unbroken first details whole beside its term in an Item with several details (%s)",
      (density) => {
        stampDensity(density);
        const term = "E-mail address for invoices";
        const details = "kari.nordmann@elmeramail.com";
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: ROW_WIDTH }}>
            <DescriptionList.Item>
              <DescriptionList.Term>{term}</DescriptionList.Term>
              <DescriptionList.Details>{details}</DescriptionList.Details>
              <DescriptionList.Details>Billing</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        );
        const termCell = textNamed(term);
        const detailsCell = textNamed(details);
        expect(
          widestWord(term, termCell) + INLINE[density].columnGap + naturalWidth(details, detailsCell),
          "precondition: the details fits whole beside the term's widest word"
        ).toBeLessThanOrEqual(ROW_WIDTH);
        const termLines = textLines(termCell);
        const detailsLines = textLines(detailsCell);
        expect(detailsLines).toHaveLength(1);
        expect(Math.abs((termLines[0]?.top ?? 0) - (detailsLines[0]?.top ?? Infinity))).toBeLessThan(1);
        expect(wordsSplitAcrossLines(termCell)).toEqual([]);
        expectNoOverflow(listOf(termCell));
      }
    );

    it("draws no rule on Items or cells at a wide viewport", async () => {
      await page.viewport(1280, 720);
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 800 }}>
          <DescriptionList.Item>
            <DescriptionList.Term>Start date</DescriptionList.Term>
            <DescriptionList.Details>1 November 2026</DescriptionList.Details>
          </DescriptionList.Item>
          <DescriptionList.Item>
            <DescriptionList.Term>Monthly amount</DescriptionList.Term>
            <DescriptionList.Details>399 kr/month</DescriptionList.Details>
            <DescriptionList.Details>Billed monthly</DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      const names = ["Start date", "1 November 2026", "Monthly amount", "399 kr/month", "Billed monthly"];
      for (const element of [...names.map(textNamed), itemOf(textNamed("Monthly amount"))]) {
        const style = getComputedStyle(element);
        expect(style.borderTopStyle === "none" || style.borderTopWidth === "0px", element.textContent).toBe(
          true
        );
      }
    });

    it.each(DENSITIES)(
      "sets the label type, spaces Items by the small surface gap and a term from its details by the medium one (%s)",
      (density) => {
        stampDensity(density);
        const longTerm = "Keep your existing phone number";
        const longDetails = "Delivered as eFaktura in your online bank";
        renderInlineRows([
          ["Start date", "1 November 2026"],
          ["Monthly amount", "399 kr/month"],
          [longTerm, longDetails],
        ]);
        const expected = INLINE[density];
        for (const name of ["Start date", "1 November 2026"]) {
          const style = getComputedStyle(textNamed(name));
          expect(px(style.fontSize), name).toBe(expected.text);
          expect(px(style.lineHeight), name).toBe(expected.leading);
          expect(px(style.paddingTop), name).toBe(0);
          expect(px(style.paddingRight), name).toBe(0);
        }
        expect(boxOf("Monthly amount").top - boxOf("Start date").bottom).toBeCloseTo(expected.rowGap, 0);
        // When both cells wrap they fill the row, so their boxes sit one column gap apart.
        expect(textLines(textNamed(longTerm)).length, "precondition: the term wraps").toBeGreaterThan(1);
        expect(boxOf(longDetails).left - boxOf(longTerm).right).toBeCloseTo(expected.columnGap, 0);
      }
    );

    it.each(DENSITIES)("spaces consecutive inline lists by the large surface gap (%s)", (density) => {
      stampDensity(density);
      renderThemed(
        <div style={{ width: 320 }}>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Item>
              <DescriptionList.Term>Electricity</DescriptionList.Term>
              <DescriptionList.Details>1 840 kr</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Item>
              <DescriptionList.Term>Total</DescriptionList.Term>
              <DescriptionList.Details>2 252 kr</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        </div>
      );
      const first = listOf(textNamed("Electricity")).getBoundingClientRect();
      const second = listOf(textNamed("Total")).getBoundingClientRect();
      expect(second.top - first.bottom).toBeCloseTo(INLINE[density].listGap, 0);
    });

    it("leaves the term unmuted, mutes the responsive term, and lets a consumer colour win in both", () => {
      renderThemed(
        <>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Item>
              <DescriptionList.Term>Inline term</DescriptionList.Term>
              <DescriptionList.Details>Value</DescriptionList.Details>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term className="text-muted-foreground">Muted inline term</DescriptionList.Term>
              <DescriptionList.Details>Value</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
          <DescriptionList.Content>
            <DescriptionList.Item>
              <DescriptionList.Term>Responsive term</DescriptionList.Term>
              <DescriptionList.Details>Value</DescriptionList.Details>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term className="text-primary">Primary term</DescriptionList.Term>
              <DescriptionList.Details>Value</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        </>
      );
      const inline = textNamed("Inline term");
      const muted = cssVarColor(inline, "--muted-foreground");
      expect(muted, "precondition: muted differs from the list colour").not.toBe(
        getComputedStyle(listOf(inline)).color
      );
      expect(getComputedStyle(inline).color).toBe(getComputedStyle(listOf(inline)).color);
      expect(getComputedStyle(textNamed("Muted inline term")).color).toBe(muted);
      expect(getComputedStyle(textNamed("Responsive term")).color).toBe(muted);
      const primary = textNamed("Primary term");
      expect(getComputedStyle(primary).color).toBe(cssVarColor(primary, "--primary"));
    });

    it("gives inline details the surrounding text colour, keeps responsive details on --foreground, and lets a consumer colour win", () => {
      renderThemed(
        <div style={{ color: "rgb(1, 2, 3)" }}>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Item>
              <DescriptionList.Term>Start date</DescriptionList.Term>
              <DescriptionList.Details>Inline value</DescriptionList.Details>
            </DescriptionList.Item>
            <DescriptionList.Item>
              <DescriptionList.Term>Total</DescriptionList.Term>
              <DescriptionList.Details className="text-primary">Primary value</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
          <DescriptionList.Content>
            <DescriptionList.Item>
              <DescriptionList.Term>Name</DescriptionList.Term>
              <DescriptionList.Details>Responsive value</DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        </div>
      );
      expect(getComputedStyle(textNamed("Inline value")).color).toBe("rgb(1, 2, 3)");
      const responsive = textNamed("Responsive value");
      expect(getComputedStyle(responsive).color).toBe(cssVarColor(responsive, "--foreground"));
      const primary = textNamed("Primary value");
      expect(getComputedStyle(primary).color).toBe(cssVarColor(primary, "--primary"));
    });

    it.each(DENSITIES)(
      "keeps a responsive list nested in an inline list stacked, padded and ruled as its own at phone width (%s)",
      async (density) => {
        stampDensity(density);
        await page.viewport(390, 800);
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: 360 }}>
            <DescriptionList.Item>
              <DescriptionList.Term>Outer</DescriptionList.Term>
              <DescriptionList.Details>
                <DescriptionList.Content>
                  <DescriptionList.Item>
                    <DescriptionList.Term>Nested term</DescriptionList.Term>
                    <DescriptionList.Details>Nested value</DescriptionList.Details>
                  </DescriptionList.Item>
                  <DescriptionList.Item>
                    <DescriptionList.Term>Second nested term</DescriptionList.Term>
                    <DescriptionList.Details>Second nested value</DescriptionList.Details>
                  </DescriptionList.Item>
                </DescriptionList.Content>
              </DescriptionList.Details>
            </DescriptionList.Item>
          </DescriptionList.Content>
        );
        // --row-py written out by hand: 6px dense, 8px comfortable.
        const rowPy = { dense: 6, comfortable: 8 }[density];
        const term = textNamed("Nested term");
        const details = textNamed("Nested value");
        expect(px(getComputedStyle(term).paddingTop), "term padding").toBe(rowPy);
        expect(px(getComputedStyle(details).paddingTop), "details padding").toBe(rowPy);
        // Below `sm` the responsive list is one column: the details sits under its term.
        expect(details.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          term.getBoundingClientRect().bottom - 1
        );
        expect(getComputedStyle(itemOf(textNamed("Nested term"))).display).toBe("grid");
        expect(px(getComputedStyle(itemOf(textNamed("Second nested term"))).borderTopWidth)).toBeGreaterThan(
          0
        );
      }
    );

    it("colours responsive cells from their own theme scope", () => {
      renderThemed(
        <DescriptionList.Content>
          <DescriptionList.Item>
            <DescriptionList.Term style={{ "--muted-foreground": "rgb(4, 5, 6)" }}>
              Scoped term
            </DescriptionList.Term>
            <DescriptionList.Details style={{ "--foreground": "rgb(7, 8, 9)" }}>
              Scoped value
            </DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      expect(getComputedStyle(textNamed("Scoped term")).color).toBe("rgb(4, 5, 6)");
      expect(getComputedStyle(textNamed("Scoped value")).color).toBe("rgb(7, 8, 9)");
    });

    it("mutes a responsive list's terms inside an inline list", () => {
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 400 }}>
          <DescriptionList.Item>
            <DescriptionList.Term>Outer</DescriptionList.Term>
            <DescriptionList.Details>
              <DescriptionList.Content>
                <DescriptionList.Item>
                  <DescriptionList.Term>Nested term</DescriptionList.Term>
                  <DescriptionList.Details>Value</DescriptionList.Details>
                </DescriptionList.Item>
              </DescriptionList.Content>
            </DescriptionList.Details>
          </DescriptionList.Item>
        </DescriptionList.Content>
      );
      const nested = textNamed("Nested term");
      expect(getComputedStyle(nested).color).toBe(cssVarColor(nested, "--muted-foreground"));
    });
  });
});
