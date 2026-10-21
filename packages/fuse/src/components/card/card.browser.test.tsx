import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  headingNamed,
  metricPx,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { CheckboxCard } from "../checkbox-card/checkbox-card";
import { CheckboxGroup } from "../checkbox/checkbox";
import { Card } from "./card";

function slot(name: string): HTMLElement {
  // DOM audit: all eleven parts emit their data-slot values.
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

/** Tailwind's `leading-snug`, written out by hand: a line 1.375 times the font size. */
const SNUG = 1.375;

/** Every `Card.Title` size. */
const TITLE_SIZES = ["default", "sm", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"] as const;

describe("Card", () => {
  it("renders the title as a level-3 heading by default and honours level", () => {
    renderThemed(
      <>
        <Card.Root>
          <Card.Header>
            <Card.Title>March usage</Card.Title>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title level={2}>April usage</Card.Title>
          </Card.Header>
        </Card.Root>
      </>
    );
    const defaultTitle = headingNamed("March usage", 3);
    expect(defaultTitle.tagName).toBe("H3");
    const levelTwo = headingNamed("April usage", 2);
    expect(levelTwo.tagName).toBe("H2");
  });

  it("emits a data-slot on all eleven parts", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Tag>Invoice</Card.Tag>
          <Card.Title>March usage</Card.Title>
          <Card.Description>Estimated consumption.</Card.Description>
          <Card.Action>
            <button type="button">Export</button>
          </Card.Action>
        </Card.Header>
        <Card.Content>Body</Card.Content>
        <Card.Footer>Footer</Card.Footer>
        <Card.Section>
          <Card.SectionMedia>
            <svg aria-hidden />
          </Card.SectionMedia>
          <p>Section</p>
        </Card.Section>
        <Card.SectionButton>Section button</Card.SectionButton>
      </Card.Root>
    );
    // DOM audit: enumerate the emitted slot contract independently of each slot lookup.
    expect(
      [...document.querySelectorAll("[data-slot]")]
        .map((element) => element.getAttribute("data-slot"))
        .filter((name) => name?.startsWith("card"))
    ).toEqual([
      "card",
      "card-header",
      "card-tag",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
      "card-section",
      "card-section-media",
      "card-section-button",
    ]);
    expect(slot("card-description").tagName).toBe("P");
    expect(slot("card-tag").tagName).toBe("DIV");
    expect(slot("card-section").tagName).toBe("DIV");
    expect(slot("card-section-media").tagName).toBe("SPAN");
    expect(slot("card-section-button").tagName).toBe("BUTTON");
  });

  it("renders default title type larger than the description", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Title>March usage</Card.Title>
          <Card.Description>Estimated consumption.</Card.Description>
        </Card.Header>
      </Card.Root>
    );
    const title = headingNamed("March usage", 3);
    const description = textNamed("Estimated consumption.");
    expect(Number.parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(description).fontSize)
    );
  });

  it("switches the header to two grid columns only when an action child exists", () => {
    renderThemed(
      <>
        <Card.Root>
          <Card.Header>
            <Card.Title>With action</Card.Title>
            <Card.Action>
              <button type="button">Export</button>
            </Card.Action>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title>Without action</Card.Title>
          </Card.Header>
        </Card.Root>
      </>
    );
    const withAction = headingNamed("With action", 3).parentElement;
    const withoutAction = headingNamed("Without action", 3).parentElement;
    if (!(withAction instanceof HTMLElement) || !(withoutAction instanceof HTMLElement)) {
      throw new Error("expected two headers");
    }
    expect(getComputedStyle(withAction).gridTemplateColumns.split(/\s+/)).toHaveLength(2);
    expect(getComputedStyle(withoutAction).gridTemplateColumns.split(/\s+/)).toHaveLength(1);
  });

  it.each([
    ["horizontal", "row"],
    [undefined, "column"],
  ] as const)(
    "lays the root out as a flex box for direction=%s in the %s direction",
    (direction, flexDirection) => {
      renderThemed(
        <Card.Root direction={direction}>
          <Card.Content direction={direction}>Body</Card.Content>
        </Card.Root>
      );
      const root = slot("card");
      expect(getComputedStyle(root).display).toBe("flex");
      expect(getComputedStyle(root).flexDirection).toBe(flexDirection);
    }
  );

  it.each([
    [undefined, "default"],
    ["lg", "lg"],
  ] as const)("writes size=%s on the root as data-size=%s", (size, written) => {
    renderThemed(
      <Card.Root size={size}>
        <Card.Content>Body</Card.Content>
      </Card.Root>
    );
    expect(slot("card").dataset.size).toBe(written);
  });
  it("spaces the lines of a title that wraps at a snug leading", () => {
    renderThemed(
      <div style={{ width: 240 }}>
        <Card.Root>
          <Card.Header>
            <Card.Title>12 Long Example Street, entrance B, 1234 Sampletown</Card.Title>
          </Card.Header>
        </Card.Root>
      </div>
    );
    const title = headingNamed("12 Long Example Street, entrance B, 1234 Sampletown", 3);
    const style = getComputedStyle(title);
    const line = px(style.lineHeight);
    expect(line).toBeCloseTo(px(style.fontSize) * SNUG, 1);
    const lines = title.getBoundingClientRect().height / line;
    expect(lines, "the title wraps").toBeGreaterThan(1.5);
    expect(lines - Math.round(lines), "the height is whole lines").toBeCloseTo(0, 1);
  });

  it.each(["vertical", "horizontal"] as const)(
    "gives a %s title a snug leading at every size",
    (direction) => {
      renderThemed(
        <>
          {TITLE_SIZES.map((size) => (
            <Card.Root key={size} direction={direction}>
              <Card.Header direction={direction}>
                <Card.Title direction={direction} size={size}>
                  {`Title ${size}`}
                </Card.Title>
              </Card.Header>
            </Card.Root>
          ))}
        </>
      );
      for (const size of TITLE_SIZES) {
        const style = getComputedStyle(headingNamed(`Title ${size}`, 3));
        expect(px(style.lineHeight), size).toBeCloseTo(px(style.fontSize) * SNUG, 1);
      }
    }
  );

  it("renders the title icon before the text with the icon gap", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Title icon={<svg data-testid="bolt" aria-hidden />}>March usage</Card.Title>
        </Card.Header>
      </Card.Root>
    );
    const title = headingNamed("March usage", 3);
    expect(title.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(getComputedStyle(title).display).toBe("flex");
    expect(getComputedStyle(title).alignItems).toBe("center");
  });

  it("paints the card surface from tokens without a transparent fill", () => {
    renderThemed(
      <Card.Root>
        <Card.Content>Body</Card.Content>
      </Card.Root>
    );
    const root = slot("card");
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the card root");
    }
    const styles = getComputedStyle(root);
    expect(styles.backgroundColor).toBe(cssVarColor(root, "--card"));
    expect(styles.borderTopWidth).toBe("1px");
  });

  it("keeps the four horizontal sections inside the card without overlaps in a narrow container", () => {
    renderThemed(
      <div style={{ width: 320 }}>
        <Card.Root direction="horizontal">
          <Card.Header direction="horizontal">
            <Card.Title direction="horizontal">Meter 707057500012345678</Card.Title>
            <Card.Description direction="horizontal">Storgata 1, 0155 Oslo.</Card.Description>
          </Card.Header>
          <Card.Content direction="horizontal">
            <p>Active since 1 January.</p>
          </Card.Content>
          <Card.Footer direction="horizontal">
            <p>Spot price</p>
          </Card.Footer>
        </Card.Root>
      </div>
    );
    const card = slot("card");
    const bounds = card.getBoundingClientRect();
    const parts = [...card.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      const rect = part.getBoundingClientRect();
      expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
    }
    for (const [index, part] of parts.entries()) {
      const rect = part.getBoundingClientRect();
      for (const other of parts.slice(index + 1)) {
        const otherRect = other.getBoundingClientRect();
        expect(
          rect.right <= otherRect.left ||
            otherRect.right <= rect.left ||
            rect.bottom <= otherRect.top ||
            otherRect.bottom <= rect.top
        ).toBe(true);
      }
    }
  });
  describe.each(DENSITIES)("section top padding at %s density", (density) => {
    /** A part's top padding in px. */
    function paddingTop(element: HTMLElement): number {
      return px(getComputedStyle(element).paddingTop);
    }

    it("pads a Content or Footer that opens the card on all four sides with the tier", () => {
      stampDensity(density);
      renderThemed(
        <>
          <Card.Root>
            <Card.Content role="group" aria-label="Lone content">
              Saved.
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Footer role="group" aria-label="Lone footer">
              Settled.
            </Card.Footer>
          </Card.Root>
        </>
      );
      const tier = metricPx("surface-pad-md", density);
      for (const name of ["Lone content", "Lone footer"]) {
        const style = getComputedStyle(roleNamed("group", name));
        expect(
          [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px),
          name
        ).toEqual([tier, tier, tier, tier]);
      }
    });

    it("drops the top padding of a Content and a Footer below a Header", () => {
      stampDensity(density);
      renderThemed(
        <Card.Root>
          <Card.Header>
            <Card.Title>March usage</Card.Title>
          </Card.Header>
          <Card.Content role="group" aria-label="Body">
            Body
          </Card.Content>
          <Card.Footer role="group" aria-label="Footer">
            Footer
          </Card.Footer>
        </Card.Root>
      );
      expect(paddingTop(roleNamed("group", "Body")), "content").toBe(0);
      expect(paddingTop(roleNamed("group", "Footer")), "footer").toBe(0);
    });

    it("keeps CheckboxCard's 12px block padding on its opening content", () => {
      stampDensity(density);
      renderThemed(
        <CheckboxGroup>
          <CheckboxCard value="green" title="Green power" description="Certified renewable." />
        </CheckboxGroup>
      );
      // DOM audit: the CheckboxCard content is a Card section with no role of its own.
      const content = document.querySelector('[data-slot="card-content"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error("expected the CheckboxCard content");
      }
      expect(paddingTop(content)).toBe(12);
      expect(px(getComputedStyle(content).paddingBottom)).toBe(12);
    });
  });
});
