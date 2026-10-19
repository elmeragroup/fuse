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
 * label type is 14/20 dense and 16/24 comfortable, rows are spaced by the small surface gap, 8px
 * dense and 12px comfortable, and consecutive lists by the large surface gap, 16px and 24px.
 */
const INLINE = {
  dense: { text: 14, leading: 20, rowGap: 8, listGap: 16 },
  comfortable: { text: 16, leading: 24, rowGap: 12, listGap: 24 },
} as const satisfies Record<
  Density,
  { readonly text: number; readonly leading: number; readonly rowGap: number; readonly listGap: number }
>;

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

function renderBasicList() {
  renderThemed(
    <DescriptionList.Root>
      <DescriptionList.Heading>Customer</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        <DescriptionList.Term>Meter point</DescriptionList.Term>
        <DescriptionList.Details>7070575000</DescriptionList.Details>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}

describe("DescriptionList", () => {
  it("renders a heading, a dl, and alternating terms and details in DOM order", () => {
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
    const terms = [...content.querySelectorAll("dt")];
    const details = [...content.querySelectorAll("dd")];
    expect(terms.map((term) => term.textContent)).toEqual(["Name", "Meter point"]);
    expect(details.map((item) => item.textContent)).toEqual(["Kari Nordmann", "7070575000"]);
    expect(content.children[0]).toBe(terms[0]);
    expect(content.children[1]).toBe(details[0]);
    expect(content.children[2]).toBe(terms[1]);
    expect(content.children[3]).toBe(details[1]);
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

  it("forms two columns at sm with the term column capped at min(50%, 20rem)", async () => {
    await page.viewport(1280, 720);
    renderThemed(
      <DescriptionList.Content style={{ width: 800 }}>
        <DescriptionList.Term>Name</DescriptionList.Term>
        <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        <DescriptionList.Term>Address</DescriptionList.Term>
        <DescriptionList.Details>Storgata 1, 3611 Kongsberg</DescriptionList.Details>
      </DescriptionList.Content>
    );
    const content = textNamed("Name").closest("dl");
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the description list");
    }
    const terms = [...content.querySelectorAll("dt")].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const details = [...content.querySelectorAll("dd")].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const [firstTerm, secondTerm] = terms;
    const [firstDetails, secondDetails] = details;
    if (
      firstTerm === undefined ||
      secondTerm === undefined ||
      firstDetails === undefined ||
      secondDetails === undefined
    ) {
      throw new Error("expected two terms and two details");
    }

    expect(getComputedStyle(content).display).toBe("grid");
    const firstTermBox = firstTerm.getBoundingClientRect();
    const firstDetailsBox = firstDetails.getBoundingClientRect();
    expect(firstDetailsBox.left).toBeGreaterThan(firstTermBox.right - 1);
    expect(Math.abs(firstTermBox.top - firstDetailsBox.top)).toBeLessThan(2);
    expect(firstTermBox.width).toBeLessThanOrEqual(320);
    expect(firstTermBox.width).toBeGreaterThan(300);

    expect(getComputedStyle(firstTerm).borderTopWidth).toBe("0px");
    expect(getComputedStyle(firstDetails).borderTopWidth).toBe("0px");
    expect(getComputedStyle(secondTerm).borderTopWidth).not.toBe("0px");
    expect(getComputedStyle(secondDetails).borderTopWidth).not.toBe("0px");
  });

  describe("inline layout", () => {
    it.each(DENSITIES)(
      "keeps each term and its details on one row at 320px, with the details at the end (%s)",
      (density) => {
        stampDensity(density);
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: 320 }}>
            <DescriptionList.Term>Start date</DescriptionList.Term>
            <DescriptionList.Details>1 November 2026</DescriptionList.Details>
            <DescriptionList.Term>Monthly amount</DescriptionList.Term>
            <DescriptionList.Details>399 kr/month</DescriptionList.Details>
          </DescriptionList.Content>
        );
        const list = listOf(textNamed("Start date")).getBoundingClientRect();
        for (const [term, details] of [
          ["Start date", "1 November 2026"],
          ["Monthly amount", "399 kr/month"],
        ] as const) {
          expect(Math.abs(boxOf(term).top - boxOf(details).top), term).toBeLessThan(2);
          expect(boxOf(details).right, details).toBeCloseTo(list.right, 0);
          // A short details takes one line of the label leading.
          expect(boxOf(details).height, details).toBeCloseTo(INLINE[density].leading, 0);
        }
        expect(getComputedStyle(textNamed("1 November 2026")).textAlign).toBe("end");
      }
    );

    it("wraps a long details within 60% of the row, end-aligned and inside the list", () => {
      stampDensity("comfortable");
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 320 }}>
          <DescriptionList.Term>Address</DescriptionList.Term>
          <DescriptionList.Details>Storgata 1, entrance B, 3611 Kongsberg</DescriptionList.Details>
          <DescriptionList.Term>Meter</DescriptionList.Term>
          <DescriptionList.Details>707057500012345678901234567890</DescriptionList.Details>
        </DescriptionList.Content>
      );
      const element = listOf(textNamed("Address"));
      const list = element.getBoundingClientRect();
      for (const [term, details] of [
        ["Address", "Storgata 1, entrance B, 3611 Kongsberg"],
        ["Meter", "707057500012345678901234567890"],
      ] as const) {
        const box = boxOf(details);
        expect(box.width, details).toBeLessThanOrEqual(0.6 * list.width + 0.5);
        expect(box.right, details).toBeCloseTo(list.right, 0);
        expect(box.height, details).toBeGreaterThan(INLINE.comfortable.leading * 1.5);
        expect(Math.abs(boxOf(term).top - box.top), term).toBeLessThan(2);
      }
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
    });

    it("draws no rule between rows at a wide viewport", async () => {
      await page.viewport(1280, 720);
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 800 }}>
          <DescriptionList.Term>Start date</DescriptionList.Term>
          <DescriptionList.Details>1 November 2026</DescriptionList.Details>
          <DescriptionList.Term>Monthly amount</DescriptionList.Term>
          <DescriptionList.Details>399 kr/month</DescriptionList.Details>
        </DescriptionList.Content>
      );
      for (const name of ["Start date", "1 November 2026", "Monthly amount", "399 kr/month"]) {
        const style = getComputedStyle(textNamed(name));
        expect(style.borderTopStyle === "none" || style.borderTopWidth === "0px", name).toBe(true);
      }
    });

    it.each(DENSITIES)("sets the label type and spaces rows by the small surface gap (%s)", (density) => {
      stampDensity(density);
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 320 }}>
          <DescriptionList.Term>Start date</DescriptionList.Term>
          <DescriptionList.Details>1 November 2026</DescriptionList.Details>
          <DescriptionList.Term>Monthly amount</DescriptionList.Term>
          <DescriptionList.Details>399 kr/month</DescriptionList.Details>
        </DescriptionList.Content>
      );
      const expected = INLINE[density];
      for (const name of ["Start date", "1 November 2026"]) {
        const style = getComputedStyle(textNamed(name));
        expect(px(style.fontSize), name).toBe(expected.text);
        expect(px(style.lineHeight), name).toBe(expected.leading);
        expect(px(style.paddingTop), name).toBe(0);
      }
      expect(boxOf("Monthly amount").top - boxOf("Start date").bottom).toBeCloseTo(expected.rowGap, 0);
    });

    it.each(DENSITIES)("spaces consecutive inline lists by the large surface gap (%s)", (density) => {
      stampDensity(density);
      renderThemed(
        <div style={{ width: 320 }}>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Term>Electricity</DescriptionList.Term>
            <DescriptionList.Details>1 840 kr</DescriptionList.Details>
          </DescriptionList.Content>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Term>Total</DescriptionList.Term>
            <DescriptionList.Details>2 252 kr</DescriptionList.Details>
          </DescriptionList.Content>
        </div>
      );
      const first = listOf(textNamed("Electricity")).getBoundingClientRect();
      const second = listOf(textNamed("Total")).getBoundingClientRect();
      expect(second.top - first.bottom).toBeCloseTo(INLINE[density].listGap, 0);
    });

    it("puts a second details under the first, in the details column", () => {
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 320 }}>
          <DescriptionList.Term>Products</DescriptionList.Term>
          <DescriptionList.Details>Spot</DescriptionList.Details>
          <DescriptionList.Details>Insurance</DescriptionList.Details>
        </DescriptionList.Content>
      );
      const first = boxOf("Spot");
      const second = boxOf("Insurance");
      const list = listOf(textNamed("Products")).getBoundingClientRect();
      expect(second.top).toBeGreaterThan(first.bottom);
      expect(second.right).toBeCloseTo(list.right, 0);
      expect(second.left).toBeGreaterThan(boxOf("Products").right);
    });

    it("sets several terms of one details in the term column, with the details on the last term's row", () => {
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 320 }}>
          <DescriptionList.Term>Owner</DescriptionList.Term>
          <DescriptionList.Term>Payer</DescriptionList.Term>
          <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
        </DescriptionList.Content>
      );
      const owner = boxOf("Owner");
      const payer = boxOf("Payer");
      expect(payer.left).toBeCloseTo(owner.left, 0);
      expect(payer.top).toBeGreaterThan(owner.bottom);
      expect(Math.abs(boxOf("Kari Nordmann").top - payer.top)).toBeLessThan(2);
    });

    it("leaves the term unmuted, mutes the responsive term, and lets a consumer colour win in both", () => {
      renderThemed(
        <>
          <DescriptionList.Content layout="inline">
            <DescriptionList.Term>Inline term</DescriptionList.Term>
            <DescriptionList.Details>Value</DescriptionList.Details>
            <DescriptionList.Term className="text-muted-foreground">Muted inline term</DescriptionList.Term>
            <DescriptionList.Details>Value</DescriptionList.Details>
          </DescriptionList.Content>
          <DescriptionList.Content>
            <DescriptionList.Term>Responsive term</DescriptionList.Term>
            <DescriptionList.Details>Value</DescriptionList.Details>
            <DescriptionList.Term className="text-primary">Primary term</DescriptionList.Term>
            <DescriptionList.Details>Value</DescriptionList.Details>
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
            <DescriptionList.Term>Start date</DescriptionList.Term>
            <DescriptionList.Details>Inline value</DescriptionList.Details>
            <DescriptionList.Term>Total</DescriptionList.Term>
            <DescriptionList.Details className="text-primary">Primary value</DescriptionList.Details>
          </DescriptionList.Content>
          <DescriptionList.Content>
            <DescriptionList.Term>Name</DescriptionList.Term>
            <DescriptionList.Details>Responsive value</DescriptionList.Details>
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
      "keeps a responsive list nested in an inline list stacked and padded as its own at phone width (%s)",
      async (density) => {
        stampDensity(density);
        await page.viewport(390, 800);
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: 360 }}>
            <DescriptionList.Term>Outer</DescriptionList.Term>
            <DescriptionList.Details>
              <DescriptionList.Content>
                <DescriptionList.Term>Nested term</DescriptionList.Term>
                <DescriptionList.Details>Nested value</DescriptionList.Details>
              </DescriptionList.Content>
            </DescriptionList.Details>
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
      }
    );

    it.each(DENSITIES)(
      "breaks a long one-word term inside its column instead of under its value (%s)",
      (density) => {
        stampDensity(density);
        renderThemed(
          <DescriptionList.Content layout="inline" style={{ width: 320 }}>
            <DescriptionList.Term>Installasjonsadresseopplysninger</DescriptionList.Term>
            <DescriptionList.Details>Storgata 1, inngang B, 3611 Kongsberg</DescriptionList.Details>
          </DescriptionList.Content>
        );
        const term = boxOf("Installasjonsadresseopplysninger");
        const details = boxOf("Storgata 1, inngang B, 3611 Kongsberg");
        expect(term.right).toBeLessThanOrEqual(details.left);
        expect(term.top, "one row").toBeCloseTo(details.top, 0);
      }
    );

    it("mutes a responsive list's terms inside an inline list", () => {
      renderThemed(
        <DescriptionList.Content layout="inline" style={{ width: 400 }}>
          <DescriptionList.Term>Outer</DescriptionList.Term>
          <DescriptionList.Details>
            <DescriptionList.Content>
              <DescriptionList.Term>Nested term</DescriptionList.Term>
              <DescriptionList.Details>Value</DescriptionList.Details>
            </DescriptionList.Content>
          </DescriptionList.Details>
        </DescriptionList.Content>
      );
      const nested = textNamed("Nested term");
      expect(getComputedStyle(nested).color).toBe(cssVarColor(nested, "--muted-foreground"));
    });
  });
});
