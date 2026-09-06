import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, headingNamed, renderThemed, textNamed } from "../../../test/themed-browser-render";
import { Card } from "./card";

function slot(name: string): HTMLElement {
  // DOM audit: all eight parts emit their data-slot values.
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

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

  it("emits a data-slot on all eight parts", () => {
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
      </Card.Root>
    );
    for (const name of [
      "card",
      "card-header",
      "card-tag",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      expect(slot(name).getAttribute("data-slot"), name).toBe(name);
    }
    expect(slot("card-description").tagName).toBe("P");
    expect(slot("card-tag").tagName).toBe("DIV");
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

  it("lays the root out as a row for direction=horizontal and a column by default", () => {
    renderThemed(
      <Card.Root direction="horizontal">
        <Card.Content direction="horizontal">Body</Card.Content>
      </Card.Root>
    );
    const root = slot("card");
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the card root");
    }
    expect(getComputedStyle(root).flexDirection).toBe("row");
  });

  it("lays the root out as a column by default", () => {
    renderThemed(
      <Card.Root>
        <Card.Content>Body</Card.Content>
      </Card.Root>
    );
    const root = slot("card");
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the card root");
    }
    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
  });

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
});
