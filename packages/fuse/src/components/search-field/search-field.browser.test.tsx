import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { expectTargetBoxes } from "../../../test/target-size";
import {
  fieldBoxOf,
  formNamed,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Button } from "../button/button";
import { Dialog } from "../dialog";
import { Field } from "../field";
import { Form } from "../form/form";
import type { FormProps } from "../form/form";
import { SearchField } from "./search-field";

function render(node: ReactNode) {
  return renderThemed(withLocale("en-US", node));
}

function searchboxNamed(name: string): HTMLInputElement {
  const input = roleNamed("searchbox", name);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> named ${name}`);
  }
  return input;
}

/** The field's root, the `Field.Root` every labeled composite renders around its control. */
function rootOf(name: string): HTMLElement {
  const root = searchboxNamed(name).closest("[data-orientation]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected the root around ${name}`);
  }
  return root;
}

/** The clear button, found inside its own field so several fields can share a page. */
function clearIn(name: string): HTMLButtonElement {
  const button = fieldBoxOf(searchboxNamed(name)).querySelector("button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`expected a clear button in ${name}`);
  }
  return button;
}

function isShown(element: Element): boolean {
  return getComputedStyle(element).visibility === "visible";
}

function alertTexts(): string[] {
  return page
    .getByRole("alert")
    .elements()
    .map((element) => element.textContent);
}

describe("SearchField", () => {
  it("renders a search input named by its label under its own slot", () => {
    render(<SearchField label="Meter search" />);
    const input = searchboxNamed("Meter search");
    expect(input.type).toBe("search");
    expect(rootOf("Meter search").getAttribute("data-slot")).toBe("search-field");
  });

  it("keeps an uncontrolled value, reports it as a string, and marks the root and hides the clear button while empty", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<SearchField label="Meter search" onChange={onChange} />);
    const input = searchboxNamed("Meter search");
    expect(rootOf("Meter search").hasAttribute("data-empty")).toBe(true);
    expect(isShown(clearIn("Meter search"))).toBe(false);

    await userEvent.type(input, "735");
    expect(input.value).toBe("735");
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(["7", "73", "735"]);
    expect(rootOf("Meter search").hasAttribute("data-empty")).toBe(false);
    expect(isShown(clearIn("Meter search"))).toBe(true);
  });

  it("shows a controlled value and proposes edits through onChange", async () => {
    function Controlled() {
      const [value, setValue] = useState("73");
      return (
        <>
          <SearchField label="Meter search" value={value} onChange={setValue} />
          <output aria-label="Echo">{value}</output>
        </>
      );
    }
    render(<Controlled />);
    const input = searchboxNamed("Meter search");
    expect(input.value).toBe("73");
    await userEvent.type(input, "5");
    expect(input.value).toBe("735");
    expect(roleNamed("status", "Echo").textContent).toBe("735");
  });

  it("keeps a controlled value the parent does not accept", async () => {
    render(<SearchField label="Meter search" value="735" onChange={() => undefined} />);
    await userEvent.type(searchboxNamed("Meter search"), "9");
    expect(searchboxNamed("Meter search").value).toBe("735");
  });

  it("calls onSubmit with the value on Enter instead of submitting the form", async () => {
    const onSubmit = vi.fn();
    const onFormSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form aria-label="Meters" onSubmit={(event) => onFormSubmit(event.nativeEvent)}>
        <SearchField label="Meter search" defaultValue="735" onSubmit={onSubmit} />
      </form>
    );
    await userEvent.click(searchboxNamed("Meter search"));
    await userEvent.keyboard("{Enter}");
    expect(onSubmit.mock.calls).toEqual([["735"]]);
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it("submits the form on Enter when no onSubmit is given", async () => {
    const onFormSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form aria-label="Meters" onSubmit={(event) => onFormSubmit(event.nativeEvent)}>
        <SearchField label="Meter search" name="q" defaultValue="735" />
      </form>
    );
    await userEvent.click(searchboxNamed("Meter search"));
    await userEvent.keyboard("{Enter}");
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears on Escape inside a Dialog and keeps it open, and lets the next Escape close it", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    renderThemed(
      withLocale(
        "en-US",
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Find a meter</Dialog.Title>
            <SearchField label="Meter search" defaultValue="735" onChange={onChange} onClear={onClear} />
          </Dialog.Content>
        </Dialog.Root>
      )
    );
    const trigger = roleNamed("button", "Open");
    await userEvent.click(trigger);
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(searchboxNamed("Meter search"));

    await userEvent.keyboard("{Escape}");
    expect(searchboxNamed("Meter search").value).toBe("");
    expect(onChange.mock.calls).toEqual([[""]]);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await userEvent.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
  });

  it("clears on Escape when a script set the input's value directly, and clears its Form error", async () => {
    const onClear = vi.fn();
    render(
      <Form aria-label="Meters" errors={{ q: "No meter matches." }}>
        <SearchField label="Meter search" name="q" onClear={onClear} />
      </Form>
    );
    expect(alertTexts()).toEqual(["No meter matches."]);
    const input = searchboxNamed("Meter search");
    await userEvent.click(input);
    input.value = "735";
    await userEvent.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
    expect(alertTexts()).toEqual([]);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("clears from the clear button without taking focus off the input, and leaves the button out of the tab order", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    const onBlur = vi.fn();
    render(
      <>
        <SearchField
          label="Meter search"
          defaultValue="735"
          onChange={onChange}
          onClear={onClear}
          onBlur={onBlur}
        />
        <button type="button">After</button>
      </>
    );
    const input = searchboxNamed("Meter search");
    await userEvent.click(input);
    await userEvent.click(roleNamed("button", "Clear search"));

    expect(input.value).toBe("");
    expect(onChange.mock.calls).toEqual([[""]]);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
    expect(onBlur).not.toHaveBeenCalled();
    expect(rootOf("Meter search").hasAttribute("data-empty")).toBe(true);
    expect(isShown(clearIn("Meter search"))).toBe(false);

    await userEvent.type(input, "7");
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });

  it("leaves Base UI's field state as an edit would after a clear", async () => {
    render(<SearchField label="Meter search" defaultValue="735" />);
    const root = rootOf("Meter search");
    // Oracle: Base UI Field marks a root filled while its control holds text and dirty while
    // the value differs from the initial one.
    expect(root.hasAttribute("data-filled")).toBe(true);
    expect(root.hasAttribute("data-dirty")).toBe(false);

    await userEvent.click(clearIn("Meter search"));
    expect(root.hasAttribute("data-filled")).toBe(false);
    expect(root.hasAttribute("data-dirty")).toBe(true);
  });

  it("restores an uncontrolled default value on native form reset", async () => {
    render(
      <form aria-label="Meters">
        <SearchField label="Meter search" defaultValue="735" />
      </form>
    );
    await userEvent.click(clearIn("Meter search"));
    expect(searchboxNamed("Meter search").value).toBe("");
    formNamed("Meters").reset();
    await expect.poll(() => searchboxNamed("Meter search").value).toBe("735");
  });

  it("names the clear button from the locale dictionary, below an explicit clearLabel", () => {
    // The dictionary's own test pins every locale's row; one non-default locale proves the button reads it.
    const { unmount } = renderThemed(
      withLocale("nb-NO", <SearchField label="Meter search" defaultValue="735" />)
    );
    expect(roleNamed("button", "Tøm søket")).toBe(clearIn("Meter search"));
    unmount();

    renderThemed(
      withLocale("nb-NO", <SearchField label="Meter search" defaultValue="735" clearLabel="Tøm feltet" />)
    );
    expect(roleNamed("button", "Tøm feltet")).toBe(clearIn("Meter search"));
  });

  it("disables the clear button and ignores Enter and Escape while read-only", async () => {
    const onSubmit = vi.fn();
    const onClear = vi.fn();
    render(
      <SearchField label="Meter search" defaultValue="735" isReadOnly onSubmit={onSubmit} onClear={onClear} />
    );
    const input = searchboxNamed("Meter search");
    expect(input.readOnly).toBe(true);
    expect(clearIn("Meter search").disabled).toBe(true);

    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");
    expect(input.value).toBe("735");
    expect(onClear).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the input and the clear button through isDisabled or a disabled Field.Set", () => {
    render(
      <>
        <SearchField label="Disabled" defaultValue="735" isDisabled />
        <Field.Set disabled>
          <SearchField label="In a set" defaultValue="735" />
        </Field.Set>
      </>
    );
    for (const name of ["Disabled", "In a set"]) {
      expect(searchboxNamed(name).disabled, name).toBe(true);
      expect(clearIn(name).disabled, name).toBe(true);
      expect(rootOf(name).hasAttribute("data-disabled"), name).toBe(true);
    }
  });

  it("shows errorMessage only while invalid, marks the input invalid, and forwards required", () => {
    render(
      <>
        <SearchField label="Valid" description="By meter number." errorMessage="Enter a query." />
        <SearchField label="Invalid" isInvalid isRequired errorMessage="Enter a query." />
      </>
    );
    expect(searchboxNamed("Valid").getAttribute("aria-invalid")).toBeNull();
    expect(searchboxNamed("Invalid").getAttribute("aria-invalid")).toBe("true");
    expect(searchboxNamed("Invalid").required).toBe(true);
    expect(alertTexts()).toEqual(["Enter a query."]);
    expect(rootOf("Invalid").contains(page.getByRole("alert").element())).toBe(true);
  });

  it("follows the field size and keeps the clear button a 24px target at both sizes and densities", () => {
    render(
      <>
        <SearchField label="Small" size="sm" defaultValue="735" />
        <SearchField label="Default" defaultValue="735" />
      </>
    );
    for (const density of DENSITIES) {
      stampDensity(density);
      const small = fieldBoxOf(searchboxNamed("Small")).getBoundingClientRect();
      const regular = fieldBoxOf(searchboxNamed("Default")).getBoundingClientRect();
      expect(small.height, density).toBeLessThan(regular.height);
      const smallClear = clearIn("Small").getBoundingClientRect();
      const regularClear = clearIn("Default").getBoundingClientRect();
      expect(smallClear.height, density).toBeLessThan(regularClear.height);
      expect(smallClear.width, density).toBe(smallClear.height);
      expectTargetBoxes([clearIn("Small"), clearIn("Default")], density);
    }
  });
});

describe("SearchField in a Form", () => {
  it("submits its value under its name and focuses the field the returned error marks", async () => {
    const submitted = vi.fn();
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>({});
      return (
        <Form
          aria-label="Meters"
          errors={errors}
          onFormSubmit={(values) => {
            submitted(values);
            setErrors({ q: "No meter matches." });
          }}>
          <SearchField label="Meter search" name="q" />
          <Button type="submit">Find</Button>
        </Form>
      );
    }
    render(<Fixture />);
    await userEvent.fill(searchboxNamed("Meter search"), "735");
    await userEvent.click(roleNamed("button", "Find"));

    expect(submitted).toHaveBeenCalledWith({ q: "735" });
    await expect.element(page.getByText("No meter matches.", { exact: true })).toBeVisible();
    await expect.element(searchboxNamed("Meter search")).toHaveFocus();
    expect(searchboxNamed("Meter search").getAttribute("aria-invalid")).toBe("true");
  });

  it("clears the Form error under its name on an edit and on a clear", async () => {
    function Fixture({ errors }: Pick<FormProps, "errors">) {
      return (
        <Form aria-label="Meters" errors={errors}>
          <SearchField label="Meter search" name="q" defaultValue="735" />
        </Form>
      );
    }
    const { rerender } = render(<Fixture errors={{ q: "No meter matches." }} />);
    expect(alertTexts()).toEqual(["No meter matches."]);

    await userEvent.type(searchboxNamed("Meter search"), "9");
    expect(alertTexts()).toEqual([]);
    expect(searchboxNamed("Meter search").getAttribute("aria-invalid")).toBeNull();

    // A second response is a new object, as a server action returns.
    rerender(withLocale("en-US", <Fixture errors={{ q: "No meter matches." }} />));
    await expect.element(page.getByText("No meter matches.", { exact: true })).toBeVisible();
    await userEvent.click(clearIn("Meter search"));
    expect(alertTexts()).toEqual([]);
  });
});
