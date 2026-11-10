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
      "moves a details whose longest word can't share the row under its term, whole and at the end (%s)",
      (density) => {
        stampDensity(density);
        const term = "Correspondence email";
        const details = "kari.nordmann.hansen@nordmannmail.no";
        renderInlineRows([[term, details]]);
        const termCell = textNamed(term);
        const detailsCell = textNamed(details);
        expect(
          widestWord(term, termCell) + INLINE[density].columnGap + naturalWidth(details, detailsCell),
          "precondition: the details can't sit beside the term's widest word"
        ).toBeGreaterThan(ROW_WIDTH);
        expect(
          naturalWidth(details, detailsCell),
          "precondition: the details fits the row"
        ).toBeLessThanOrEqual(ROW_WIDTH);

        const termLines = textLines(termCell);
        const detailsLines = textLines(detailsCell);
        expect(termLines, "the term on one line").toHaveLength(1);
        expect(detailsLines, "the details whole on one line").toHaveLength(1);
        expect(detailsLines[0]?.top ?? 0).toBeGreaterThanOrEqual((termLines[0]?.bottom ?? Infinity) - 1);
        expect(detailsLines[0]?.right).toBeCloseTo(listOf(termCell).getBoundingClientRect().right, 0);
        expectNoOverflow(listOf(termCell));
      }
    );

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
