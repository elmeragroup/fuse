import { createRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  CONTROL_MD,
  fieldRootFrom,
  fkasExternal,
  formNamed,
  inputNamed,
  px,
  renderThemed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { TextField } from "./text-field";

function fieldSvgs(name: string): SVGElement[] {
  return [...fieldRootFrom(name).querySelectorAll("svg")];
}

describe("TextField", () => {
  it("renders label, description, and error by role and accessible name", () => {
    renderThemed(
      <TextField
        label="Email"
        description="Work address preferred."
        isInvalid
        errorMessage="Enter a work email."
      />
    );

    const input = textboxNamed("Email");
    expect(input.getAttribute("data-slot")).toBe("input");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(/\s+/).filter(Boolean);
    const alert = page.getByRole("alert").element();
    expect(alert.textContent).toBe("Enter a work email.");
    expect(ids).toContain(alert.id);
    const description = ids
      .map((id) => document.getElementById(id))
      .find((node) => node?.textContent === "Work address preferred.");
    expect(description).toBeTruthy();
  });

  it("calls onChange with the string value, not the event", async () => {
    const onChange = vi.fn();
    renderThemed(<TextField label="Name" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Name", exact: true }), "Ada");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("Ada");
  });

  it("keeps a read-only input focusable without accepting typed changes", async () => {
    renderThemed(<TextField label="Locked" isReadOnly defaultValue="Stay" />);
    const input = textboxNamed("Locked");
    expect(input).toHaveProperty("readOnly", true);
    input.focus();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("x");
    expect(input).toHaveProperty("value", "Stay");
  });

  it("forwards the numeric filter to the inner input, so digits reach onChange and maxLength counts digits", async () => {
    // Input owns the filter and its own suite covers each path; this pins the forwarding.
    const onChange = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderThemed(
      <>
        <TextField aria-label="Clipboard source" defaultValue="912 34 567" />
        <TextField label="Phone" filter="numeric" maxLength={8} onChange={onChange} />
        <TextField label="Bad" filter="numeric" value="12a" isReadOnly />
      </>
    );

    const phone = inputNamed("Phone");
    expect(phone).toHaveProperty("inputMode", "numeric");

    await userEvent.type(page.getByRole("textbox", { name: "Phone", exact: true }), "ab");
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(phone).toHaveProperty("value", "");

    const source = inputNamed("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();
    phone.focus();
    await userEvent.paste();
    expect(phone).toHaveProperty("value", "91234567");
    expect(onChange).toHaveBeenLastCalledWith("91234567");

    expect(warn).toHaveBeenCalledWith("Input: value is not a number");
    warn.mockRestore();
  });

  it("keeps controlled digits and callbacks owned by the parent across native reset", async () => {
    const onChange = vi.fn();
    function Fixture() {
      const [value, setValue] = useState("123");
      return (
        <form aria-label="Pin form">
          <TextField
            label="Pin"
            name="pin"
            filter="numeric"
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
          />
        </form>
      );
    }
    renderThemed(<Fixture />);
    const pin = page.getByRole("textbox", { name: "Pin", exact: true });
    await userEvent.fill(pin, "456");
    const edits = onChange.mock.calls.length;

    formNamed("Pin form").reset();

    await expect.element(pin).toHaveValue("456");
    expect(onChange).toHaveBeenCalledTimes(edits);
  });

  it("forwards object and callback refs to the inner input", () => {
    const objectRef = createRef<HTMLInputElement>();
    const callbackRef = vi.fn();
    // The numeric filter merges its own listener ref with the consumer's.
    const numericRef = createRef<HTMLInputElement>();
    const { unmount } = renderThemed(
      <>
        <TextField label="Object" defaultValue="123" ref={objectRef} />
        <TextField label="Callback" defaultValue="123" ref={callbackRef} />
        <TextField label="Numeric" filter="numeric" defaultValue="123" ref={numericRef} />
      </>
    );
    expect(objectRef.current).toBeInstanceOf(HTMLInputElement);
    expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    expect(numericRef.current).toBe(inputNamed("Numeric"));
    unmount();
    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenCalledWith(null);
    expect(numericRef.current).toBeNull();
  });

  it("renders the pending/success indicator row without a label, and success wins", () => {
    renderThemed(
      <>
        <TextField aria-label="Pending" isPending />
        <TextField aria-label="Done" isPending isSuccess />
      </>
    );

    expect(page.getByRole("textbox", { name: "Pending", exact: true }).query()).toBeTruthy();
    expect(page.getByText("Pending", { exact: true }).query()).toBeNull();

    const pendingSvgs = fieldSvgs("Pending");
    expect(pendingSvgs).toHaveLength(2);
    const pendingShown = pendingSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(pendingShown).toHaveLength(1);
    expect(pendingShown[0]?.classList.contains("animate-spin")).toBe(true);

    const doneSvgs = fieldSvgs("Done");
    expect(doneSvgs).toHaveLength(2);
    const doneShown = doneSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown[0]?.classList.contains("animate-spin")).toBe(false);
  });

  it("moves focus from the label to the input and skips a disabled field", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextField label="Email" />
        <TextField label="Off" isDisabled />
        <button type="button">After</button>
      </>
    );

    await userEvent.click(page.getByText("Email", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Email"));

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Email"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After", exact: true }).element());
  });
});

describe("TextField inline focus chrome", () => {
  it("paints the ring-coloured border on :focus-visible only", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextField label="Inline" variant="inline" />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const input = textboxNamed("Inline");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }

    // Browser suites load styles.css without themes.css, so `--ring` is otherwise
    // unset and `border-color: var(--ring)` would be ignored as invalid.
    input.style.setProperty("--ring", "rgb(255, 0, 0)");
    expect(getComputedStyle(input).borderColor).not.toBe("rgb(255, 0, 0)");

    previous.focus();
    await userEvent.keyboard("{Tab}");
    expect(input.matches(":focus-visible")).toBe(true);
    await vi.waitFor(() => {
      expect(getComputedStyle(input).borderColor).toBe("rgb(255, 0, 0)");
    });

    await userEvent.click(previous);
    expect(input.matches(":focus-visible")).toBe(false);
    await vi.waitFor(() => {
      expect(getComputedStyle(input).borderColor).not.toBe("rgb(255, 0, 0)");
    });
  });
});

describe("TextField density metrics", () => {
  it("pins the inner input to the signed md control rung at both densities", () => {
    const { rerender } = renderThemed(<TextField label="Meter" />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const style = getComputedStyle(textboxNamed("Meter"));
      expect(px(style.height)).toBe(CONTROL_MD[density].height);
      expect(px(style.paddingInlineStart)).toBe(CONTROL_MD[density].px);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <TextField label="Meter" />
      </ThemeScope>
    );
    expect(px(getComputedStyle(textboxNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});
