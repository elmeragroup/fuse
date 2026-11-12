import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { expectTargetBoxes } from "../../../test/target-size";
import {
  fieldBoxOf,
  fieldRootFrom,
  formNamed,
  inputNamed,
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

/** The clear button, found inside its own field so several fields can share a page. */
function clearIn(name: string): HTMLButtonElement {
  const button = fieldBoxOf(inputNamed(name, "searchbox")).querySelector("button");
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
  it("renders a search input named by its label", () => {
    render(<SearchField label="Meter search" />);
    expect(inputNamed("Meter search", "searchbox").type).toBe("search");
  });

  it("keeps an uncontrolled value, reports it as a string, and marks the root and hides the clear button while empty", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<SearchField label="Meter search" onChange={onChange} />);
    const input = inputNamed("Meter search", "searchbox");
    expect(fieldRootFrom("Meter search", "searchbox").hasAttribute("data-empty")).toBe(true);
    expect(isShown(clearIn("Meter search"))).toBe(false);

    await userEvent.type(input, "735");
    expect(input.value).toBe("735");
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(["7", "73", "735"]);
    expect(fieldRootFrom("Meter search", "searchbox").hasAttribute("data-empty")).toBe(false);
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
    const input = inputNamed("Meter search", "searchbox");
    expect(input.value).toBe("73");
    await userEvent.type(input, "5");
    expect(input.value).toBe("735");
    expect(roleNamed("status", "Echo").textContent).toBe("735");
  });

  it("keeps a controlled value the parent does not accept", async () => {
    render(<SearchField label="Meter search" value="735" onChange={() => undefined} />);
    await userEvent.type(inputNamed("Meter search", "searchbox"), "9");
    expect(inputNamed("Meter search", "searchbox").value).toBe("735");
  });

  it("calls onSubmit with the value on Enter instead of submitting the form", async () => {
    const onSubmit = vi.fn();
    const onFormSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form aria-label="Meters" onSubmit={(event) => onFormSubmit(event.nativeEvent)}>
        <SearchField label="Meter search" defaultValue="735" onSubmit={onSubmit} />
      </form>
    );
    await userEvent.click(inputNamed("Meter search", "searchbox"));
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
    await userEvent.click(inputNamed("Meter search", "searchbox"));
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
    await userEvent.click(inputNamed("Meter search", "searchbox"));

    await userEvent.keyboard("{Escape}");
    expect(inputNamed("Meter search", "searchbox").value).toBe("");
    expect(onChange.mock.calls).toEqual([[""]]);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await userEvent.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
  });

  // Oracle: React Aria's useSearchField handles Enter and Escape through useKeyboard, which skips
  // a repeat (`allowRepeats` false), and createKeyboardShortcutHandler matches a shortcut only with
  // its exact modifiers, so `Enter` and `Escape` match only without Alt, Control, Meta or Shift.
  // The PR contract adds that with onSubmit set, no Enter submits the form natively.
  it.each([
    ["a held Enter's repeat", { key: "Enter", repeat: true }, true],
    ["Meta+Enter", { key: "Enter", metaKey: true }, true],
    ["Shift+Enter", { key: "Enter", shiftKey: true }, true],
    ["a held Escape's repeat", { key: "Escape", repeat: true }, false],
    ["Alt+Escape", { key: "Escape", altKey: true }, false],
    ["Control+Escape", { key: "Escape", ctrlKey: true }, false],
  ] as const)(
    "neither submits nor clears on %s, and blocks the native form submit only for Enter",
    (_name, init, blocksSubmit) => {
      const onSubmit = vi.fn();
      const onClear = vi.fn();
      render(<SearchField label="Meter search" defaultValue="735" onSubmit={onSubmit} onClear={onClear} />);
      const input = inputNamed("Meter search", "searchbox");

      const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(blocksSubmit);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
      expect(input.value).toBe("735");
    }
  );

  it("never lets a held or modified Enter submit the form natively while onSubmit is set", async () => {
    const onSubmit = vi.fn();
    const onFormSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form aria-label="Meters" onSubmit={(event) => onFormSubmit(event.nativeEvent)}>
        <SearchField label="Meter search" defaultValue="735" onSubmit={onSubmit} />
      </form>
    );
    await userEvent.click(inputNamed("Meter search", "searchbox"));
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    // Held for three keydowns: the first submits through onSubmit, the repeats do nothing.
    await userEvent.keyboard("{Enter>3}{/Enter}");
    expect(onSubmit.mock.calls).toEqual([["735"]]);
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it("clears on Escape when a script set the input's value directly, and clears its Form error", async () => {
    const onClear = vi.fn();
    render(
      <Form aria-label="Meters" errors={{ q: "No meter matches." }}>
        <SearchField label="Meter search" name="q" onClear={onClear} />
      </Form>
    );
    expect(alertTexts()).toEqual(["No meter matches."]);
    const input = inputNamed("Meter search", "searchbox");
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
    const input = inputNamed("Meter search", "searchbox");
    await userEvent.click(input);
    await userEvent.click(roleNamed("button", "Clear search"));

    expect(input.value).toBe("");
    expect(onChange.mock.calls).toEqual([[""]]);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
    expect(onBlur).not.toHaveBeenCalled();
    expect(fieldRootFrom("Meter search", "searchbox").hasAttribute("data-empty")).toBe(true);
    expect(isShown(clearIn("Meter search"))).toBe(false);

    await userEvent.type(input, "7");
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });

  it("leaves Base UI's field state as an edit would after a clear", async () => {
    render(<SearchField label="Meter search" defaultValue="735" />);
    const root = fieldRootFrom("Meter search", "searchbox");
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
    expect(inputNamed("Meter search", "searchbox").value).toBe("");
    formNamed("Meters").reset();
    await expect.poll(() => inputNamed("Meter search", "searchbox").value).toBe("735");
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
    const input = inputNamed("Meter search", "searchbox");
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
      expect(inputNamed(name, "searchbox").disabled, name).toBe(true);
      expect(clearIn(name).disabled, name).toBe(true);
      expect(fieldRootFrom(name, "searchbox").hasAttribute("data-disabled"), name).toBe(true);
    }
  });

  it("shows errorMessage only while invalid, marks the input invalid, and forwards required", () => {
    render(
      <>
        <SearchField label="Valid" description="By meter number." errorMessage="Enter a query." />
        <SearchField label="Invalid" isInvalid isRequired errorMessage="Enter a query." />
      </>
    );
    expect(inputNamed("Valid", "searchbox").getAttribute("aria-invalid")).toBeNull();
    expect(inputNamed("Invalid", "searchbox").getAttribute("aria-invalid")).toBe("true");
    expect(inputNamed("Invalid", "searchbox").required).toBe(true);
    expect(alertTexts()).toEqual(["Enter a query."]);
    expect(fieldRootFrom("Invalid", "searchbox").contains(page.getByRole("alert").element())).toBe(true);
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
      const small = fieldBoxOf(inputNamed("Small", "searchbox")).getBoundingClientRect();
      const regular = fieldBoxOf(inputNamed("Default", "searchbox")).getBoundingClientRect();
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
    await userEvent.fill(inputNamed("Meter search", "searchbox"), "735");
    await userEvent.click(roleNamed("button", "Find"));

    expect(submitted).toHaveBeenCalledWith({ q: "735" });
    await expect.element(page.getByText("No meter matches.", { exact: true })).toBeVisible();
    await expect.element(inputNamed("Meter search", "searchbox")).toHaveFocus();
    expect(inputNamed("Meter search", "searchbox").getAttribute("aria-invalid")).toBe("true");
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

    await userEvent.type(inputNamed("Meter search", "searchbox"), "9");
    expect(alertTexts()).toEqual([]);
    expect(inputNamed("Meter search", "searchbox").getAttribute("aria-invalid")).toBeNull();

    // A second response is a new object, as a server action returns.
    rerender(withLocale("en-US", <Fixture errors={{ q: "No meter matches." }} />));
    await expect.element(page.getByText("No meter matches.", { exact: true })).toBeVisible();
    await userEvent.click(clearIn("Meter search"));
    expect(alertTexts()).toEqual([]);
  });
});
