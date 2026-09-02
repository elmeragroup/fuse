import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { TextField } from "./text-field";

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

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

  it("omits the alert when errorMessage is absent", () => {
    renderThemed(<TextField label="Email" isInvalid />);
    expect(page.getByRole("alert").query()).toBeNull();
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
  });

  it("calls onChange with the string value, not the event", async () => {
    const onChange = vi.fn();
    renderThemed(<TextField label="Name" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Name", exact: true }), "Ada");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("Ada");
  });

  it("natively disables the input and skips it in tab order", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <TextField label="Disabled" isDisabled />
        <TextField label="Open" />
      </>
    );
    const disabled = textboxNamed("Disabled");
    expect(disabled).toHaveProperty("disabled", true);
    disabled.focus();
    expect(document.activeElement).not.toBe(disabled);

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Open"));
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

  it("rejects non-digits under filter=numeric and auto-sets inputMode", async () => {
    const onChange = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderThemed(
      <>
        <TextField label="Pin" filter="numeric" onChange={onChange} />
        <TextField label="Phone" filter="numeric" inputMode="tel" />
        <TextField label="Bad" filter="numeric" value="12a" />
      </>
    );

    const pin = textboxNamed("Pin");
    expect(pin).toHaveProperty("inputMode", "numeric");
    expect(textboxNamed("Phone")).toHaveProperty("inputMode", "tel");

    await userEvent.type(page.getByRole("textbox", { name: "Pin", exact: true }), "ab");
    expect(onChange).not.toHaveBeenCalled();
    expect(pin).toHaveProperty("value", "");

    await userEvent.fill(page.getByRole("textbox", { name: "Pin", exact: true }), "12a3");
    expect(onChange).not.toHaveBeenCalled();
    expect(pin).toHaveProperty("value", "");

    await userEvent.fill(page.getByRole("textbox", { name: "Pin", exact: true }), "123");
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("123");
    expect(pin).toHaveProperty("value", "123");

    expect(warn).toHaveBeenCalledWith("TextField: value is not a number");
    warn.mockRestore();
  });

  it("renders the pending/success indicator row without a label, and success wins", () => {
    renderThemed(
      <>
        <TextField aria-label="Pending" isPending />
        <TextField aria-label="Done" isPending isSuccess />
      </>
    );

    expect(page.getByRole("textbox", { name: "Pending", exact: true }).query()).toBeTruthy();
    expect(fieldRootFrom("Pending").querySelector("[data-slot=field-label]")).toBeNull();

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
