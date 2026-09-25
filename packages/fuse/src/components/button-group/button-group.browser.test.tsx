import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { ButtonGroup } from "./index";

/** Browser suites load styles.css only; radius collapsing reads `--radius`. */
const radiusToken = { "--radius": "8px" };

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a group named ${name}`);
  }
  return element;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a button named ${name}`);
  }
  return element;
}

function separator(): HTMLElement {
  const element = page.getByRole("separator").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a separator");
  }
  return element;
}

function radius(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    topLeft: parseFloat(style.borderTopLeftRadius),
    topRight: parseFloat(style.borderTopRightRadius),
    bottomLeft: parseFloat(style.borderBottomLeftRadius),
    bottomRight: parseFloat(style.borderBottomRightRadius),
    borderLeft: style.borderLeftWidth,
    borderTop: style.borderTopWidth,
  };
}

describe("ButtonGroup", () => {
  it("renders role=group with data-slot and data-orientation=horizontal by default", () => {
    renderThemed(
      <ButtonGroup.Root aria-label="Actions">
        <Button>Save</Button>
        <Button>Cancel</Button>
      </ButtonGroup.Root>
    );
    const root = groupNamed("Actions");
    expect(root.tagName).toBe("DIV");
    expect(root.getAttribute("data-slot")).toBe("button-group");
    expect(root.getAttribute("data-orientation")).toBe("horizontal");
    expect(getComputedStyle(root).flexDirection).toBe("row");
  });

  it("flips data-orientation and flex-col when orientation is vertical", () => {
    renderThemed(
      <ButtonGroup.Root orientation="vertical" aria-label="Stack">
        <Button>Archive</Button>
        <Button>Report</Button>
      </ButtonGroup.Root>
    );
    const root = groupNamed("Stack");
    expect(root.getAttribute("data-orientation")).toBe("vertical");
    expect(getComputedStyle(root).flexDirection).toBe("column");
  });

  it("tabs between child buttons and does not rove on arrow keys", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <ButtonGroup.Root aria-label="Actions">
          <Button>Save</Button>
          <Button>Cancel</Button>
        </ButtonGroup.Root>
      </>
    );
    buttonNamed("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("Save"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("Cancel"));

    buttonNamed("Save").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(buttonNamed("Save"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(buttonNamed("Save"));
  });

  it("lets Enter and Space activate the focused child button", async () => {
    const onClick = vi.fn();
    renderThemed(
      <ButtonGroup.Root aria-label="Actions">
        <Button onClick={onClick}>Save</Button>
        <Button>Cancel</Button>
      </ButtonGroup.Root>
    );
    buttonNamed("Save").focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("renders the group Separator with a vertical hairline by default", () => {
    renderThemed(
      <ButtonGroup.Root aria-label="Split">
        <Button>Save</Button>
        <ButtonGroup.Separator />
        <Button aria-label="More">More</Button>
      </ButtonGroup.Root>
    );
    const rule = separator();
    expect(rule.getAttribute("data-slot")).toBe("button-group-separator");
    expect(rule.getAttribute("aria-orientation")).toBe("vertical");
    expect(rule.getAttribute("data-orientation")).toBe("vertical");
  });

  it("renders Text as a div with data-slot and swaps the tag through render", () => {
    renderThemed(
      <ButtonGroup.Root aria-label="Prefixed">
        <ButtonGroup.Text>https://</ButtonGroup.Text>
        <ButtonGroup.Text render={<label htmlFor="amount" />} className="uppercase">
          NOK
        </ButtonGroup.Text>
        <Button>Copy</Button>
      </ButtonGroup.Root>
    );
    const plain = page.getByText("https://", { exact: true }).element();
    const labeled = page.getByText("NOK", { exact: true }).element();
    if (!(plain instanceof HTMLElement) || !(labeled instanceof HTMLElement)) {
      throw new Error("expected two button-group-text parts");
    }
    expect(plain.tagName).toBe("DIV");
    expect(plain.getAttribute("data-slot")).toBe("button-group-text");
    expect(labeled.tagName).toBe("LABEL");
    expect(labeled.getAttribute("for")).toBe("amount");
    expect(labeled.getAttribute("data-slot")).toBe("button-group-text");
    expect(getComputedStyle(plain).backgroundColor).toBe(cssVarColor(plain, "--muted"));
    expect(getComputedStyle(labeled).backgroundColor).toBe(cssVarColor(labeled, "--muted"));
    expect(getComputedStyle(plain).textTransform).not.toBe("uppercase");
    expect(getComputedStyle(labeled).textTransform).toBe("uppercase");
  });

  it("collapses inner corners of data-slot children and keeps the trailing rounded edge", () => {
    renderThemed(
      <ButtonGroup.Root aria-label="Attached" style={radiusToken}>
        <Button>One</Button>
        <Button>Two</Button>
        <Button>Three</Button>
      </ButtonGroup.Root>
    );
    const first = radius(buttonNamed("One"));
    const middle = radius(buttonNamed("Two"));
    const last = radius(buttonNamed("Three"));

    expect(first.topLeft).toBeGreaterThan(0);
    expect(first.bottomLeft).toBeGreaterThan(0);
    expect(first.topRight).toBe(0);
    expect(first.bottomRight).toBe(0);

    expect(middle.topLeft).toBe(0);
    expect(middle.topRight).toBe(0);
    expect(middle.bottomLeft).toBe(0);
    expect(middle.bottomRight).toBe(0);
    expect(middle.borderLeft).toBe("0px");

    expect(last.topLeft).toBe(0);
    expect(last.bottomLeft).toBe(0);
    expect(last.topRight).toBeGreaterThan(0);
    expect(last.bottomRight).toBeGreaterThan(0);
  });

  it("collapses block-axis corners when orientation is vertical", () => {
    renderThemed(
      <ButtonGroup.Root orientation="vertical" aria-label="Stack" style={radiusToken}>
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonGroup.Root>
    );
    const first = radius(buttonNamed("One"));
    const last = radius(buttonNamed("Two"));

    expect(first.topLeft).toBeGreaterThan(0);
    expect(first.topRight).toBeGreaterThan(0);
    expect(first.bottomLeft).toBe(0);
    expect(first.bottomRight).toBe(0);

    expect(last.topLeft).toBe(0);
    expect(last.topRight).toBe(0);
    expect(last.bottomLeft).toBeGreaterThan(0);
    expect(last.bottomRight).toBeGreaterThan(0);
    expect(last.borderTop).toBe("0px");
  });

  it("spaces nested button-groups with gap-2", () => {
    renderThemed(
      <ButtonGroup.Root aria-label="Pager">
        <ButtonGroup.Root aria-label="Pages">
          <Button>1</Button>
          <Button>2</Button>
        </ButtonGroup.Root>
        <ButtonGroup.Root aria-label="Step">
          <Button>Next</Button>
        </ButtonGroup.Root>
      </ButtonGroup.Root>
    );
    expect(getComputedStyle(groupNamed("Pager")).gap).toBe("8px");
    expect(getComputedStyle(groupNamed("Pages")).gap).toBe("normal");
  });
});
