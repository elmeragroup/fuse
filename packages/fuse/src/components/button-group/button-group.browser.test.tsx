import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { fkasBranded } from "../../../test/theme-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Button } from "../button/button";
import { Input } from "../input/input";
import { ButtonGroup } from "./index";

/**
 * A host's own field corner under the branded step: fields round with a 4px `--radius-field`,
 * inside the group's 10px `rounded-md`.
 */
const hostFieldCorner = { "--radius-field": "4px" };

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
  it.each([
    [undefined, "horizontal", "row"],
    ["vertical", "vertical", "column"],
  ] as const)(
    "renders role=group with data-slot and reflects orientation %s as data-orientation and flex direction",
    (orientation, dataOrientation, flexDirection) => {
      renderThemed(
        <ButtonGroup.Root orientation={orientation} aria-label="Actions">
          <Button>Save</Button>
          <Button>Cancel</Button>
        </ButtonGroup.Root>
      );
      const root = groupNamed("Actions");
      expect(root.tagName).toBe("DIV");
      expect(root.getAttribute("data-slot")).toBe("button-group");
      expect(root.getAttribute("data-orientation")).toBe(dataOrientation);
      expect(getComputedStyle(root).flexDirection).toBe(flexDirection);
    }
  );

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

  // fkas external: a 12px --radius and a 2px step, so rounded-md is 10px. A field alone rounds
  // with the brand's 12px, or with a host's own --radius-field; the group ends override both.
  describe.each([
    ["the brand field corner", undefined, 12],
    ["a host field corner", hostFieldCorner, 4],
  ] as const)("over %s", (_, style, aloneCorner) => {
    it.each([
      ["horizontal", "Search", "topLeft", "bottomLeft", "topRight"],
      ["vertical", "Stacked search", "topLeft", "topRight", "bottomLeft"],
    ] as const)(
      "rounds a leading field like the trailing button when the group is %s",
      (orientation, name, fieldCornerA, fieldCornerB, buttonCorner) => {
        render(
          <ThemeScope theme={fkasBranded} style={style}>
            <Input aria-label={`${name} alone`} />
            <ButtonGroup.Root orientation={orientation} aria-label={name}>
              <Input aria-label={`${name} query`} />
              <Button>{`${name} go`}</Button>
            </ButtonGroup.Root>
          </ThemeScope>
        );
        const fieldBox = page.getByRole("textbox", { name: `${name} query` }).element();
        const aloneBox = page.getByRole("textbox", { name: `${name} alone` }).element();
        if (!(fieldBox instanceof HTMLElement) || !(aloneBox instanceof HTMLElement)) {
          throw new Error("expected the grouped and the lone field");
        }
        expect(radius(aloneBox).topLeft).toBe(aloneCorner);
        const field = radius(fieldBox);
        const button = radius(buttonNamed(`${name} go`));
        expect(field[fieldCornerA]).toBe(10);
        expect(field[fieldCornerB]).toBe(10);
        expect(button[buttonCorner]).toBe(10);
      }
    );
  });
});
