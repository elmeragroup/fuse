import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/ui/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { inputNamed, searchNamed } from "../../../test/phone-browser-queries";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

function formNamed(name = "Phone form"): HTMLFormElement {
  const form = roleNamed("form", name);
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected phone form");
  return form;
}

function submission(name = "Phone form"): FormData {
  return new FormData(formNamed(name));
}

function snapshot(formName = "Phone form") {
  return {
    display: inputNamed().value,
    submitted: submission(formName).get("phone"),
    submittedDisplay: submission(formName).get("phone-display-value"),
  };
}

const emptySnapshot = { display: "", submitted: "", submittedDisplay: "" };
const populatedSnapshot = {
  display: "41234567",
  submitted: "+4741234567",
  submittedDisplay: "41234567",
};

function UncontrolledFixture({
  change,
  countryChange,
  onReset,
  fieldProps,
}: {
  change: (value: string) => void;
  countryChange: (country: { code: string; dialCode: string }) => void;
  onReset?: (event: FormEvent<HTMLFormElement>) => void;
  fieldProps?: Partial<PhoneNumberFieldProps>;
}) {
  return (
    <form aria-label="Phone form" onReset={onReset}>
      <PhoneNumberField
        label="Mobile"
        name="phone"
        onChange={change}
        onCountryChange={countryChange}
        {...fieldProps}
      />
      <button type="reset">Reset</button>
    </form>
  );
}

async function resetForm(method: "button" | "programmatic", formName = "Phone form") {
  if (method === "button") {
    await userEvent.click(roleNamed("button", "Reset"));
    return;
  }
  formNamed(formName).reset();
}

async function selectSweden() {
  roleNamed("button", "Select country").focus();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).not.toBeNull();
  });
  await userEvent.fill(searchNamed(), "Sweden");
  await vi.waitFor(() => {
    expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull();
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await vi.waitFor(() => {
    expect(page.getByRole("listbox").query()).toBeNull();
  });
}

it.each(["button", "programmatic"] as const)(
  "clears an uncontrolled number via %s reset without notifying",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    render(withLocale("en-US", <UncontrolledFixture change={change} countryChange={countryChange} />));
    expect(snapshot()).toEqual(emptySnapshot);
    await userEvent.fill(inputNamed(), "41234567");
    expect(snapshot()).toEqual(populatedSnapshot);
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;
    await resetForm(method);
    await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
    expect(roleNamed("button", "Select country").textContent).toContain("+47");
  }
);

it("keeps values when native reset is canceled", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(
    withLocale(
      "en-US",
      <UncontrolledFixture
        change={change}
        countryChange={countryChange}
        onReset={(event) => event.preventDefault()}
      />
    )
  );
  await userEvent.fill(inputNamed(), "41234567");
  expect(snapshot()).toEqual(populatedSnapshot);
  vi.useFakeTimers();
  try {
    formNamed().reset();
    await expect.poll(() => snapshot()).toEqual(populatedSnapshot);
    await vi.runOnlyPendingTimersAsync();
    expect(snapshot()).toEqual(populatedSnapshot);
  } finally {
    vi.useRealTimers();
  }
});

it("does not subscribe to form reset when the value is parent-owned", () => {
  const add = vi.spyOn(HTMLFormElement.prototype, "addEventListener");
  try {
    render(
      withLocale(
        "en-US",
        <form aria-label="Phone form">
          <PhoneNumberField label="Mobile" name="phone" value="+4741234567" />
        </form>
      )
    );
    expect(add.mock.calls.filter((call) => call[0] === "reset")).toEqual([]);
  } finally {
    add.mockRestore();
  }
});

it("keeps a controlled value parent-owned after reset", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(
    withLocale(
      "en-US",
      <form aria-label="Phone form">
        <PhoneNumberField
          label="Mobile"
          name="phone"
          value="+4741234567"
          onChange={change}
          onCountryChange={countryChange}
        />
        <button type="reset">Reset</button>
      </form>
    )
  );
  expect(snapshot()).toEqual(populatedSnapshot);
  formNamed().reset();
  await expect.poll(() => snapshot()).toEqual(populatedSnapshot);
  expect(change).not.toHaveBeenCalled();
});

it.each(["button", "programmatic"] as const)(
  "preserves a manually selected country after %s reset",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    render(withLocale("en-US", <UncontrolledFixture change={change} countryChange={countryChange} />));
    await selectSweden();
    await userEvent.fill(inputNamed(), "701234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;
    await resetForm(method);
    await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
  }
);

it.each(["button", "programmatic"] as const)(
  "preserves an auto-detected country after %s reset",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    render(withLocale("en-US", <UncontrolledFixture change={change} countryChange={countryChange} />));
    await userEvent.fill(inputNamed(), "+46701234567");
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;
    await resetForm(method);
    await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
  }
);

it.each(["button", "programmatic"] as const)("accepts a new edit after %s reset", async (method) => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(withLocale("en-US", <UncontrolledFixture change={change} countryChange={countryChange} />));
  await userEvent.fill(inputNamed(), "41234567");
  const changeCalls = change.mock.calls.length;
  await resetForm(method);
  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
  await userEvent.fill(inputNamed(), "99887766");
  expect(snapshot()).toEqual({
    display: "99887766",
    submitted: "+4799887766",
    submittedDisplay: "99887766",
  });
  expect(change).toHaveBeenCalledTimes(changeCalls + 1);
  expect(change).toHaveBeenLastCalledWith("+4799887766");
});

it.each(["button", "programmatic"] as const)(
  "clears a read-only uncontrolled field via %s reset",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    const field = (isReadOnly: boolean) =>
      withLocale(
        "en-US",
        <UncontrolledFixture change={change} countryChange={countryChange} fieldProps={{ isReadOnly }} />
      );
    const { rerender } = render(field(false));
    await userEvent.fill(inputNamed(), "41234567");
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;
    rerender(field(true));
    await resetForm(method);
    await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
  }
);

it.each(["button", "programmatic"] as const)(
  "clears a disabled uncontrolled field via %s reset",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    const field = (isDisabled: boolean) =>
      withLocale(
        "en-US",
        <UncontrolledFixture change={change} countryChange={countryChange} fieldProps={{ isDisabled }} />
      );
    const { rerender } = render(field(false));
    await userEvent.fill(inputNamed(), "41234567");
    rerender(field(true));
    await resetForm(method);
    await expect.poll(() => inputNamed().value).toBe("");
    expect(submission().has("phone")).toBe(false);
    rerender(field(false));
    expect(submission().get("phone")).toBe("");
  }
);

it.each([
  { international: true },
  { formatOnType: true },
  { outputFormat: "national" as const },
  { outputFormat: "raw" as const },
])("clears uncontrolled values for %o", async (fieldProps) => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(
    withLocale(
      "en-US",
      <UncontrolledFixture change={change} countryChange={countryChange} fieldProps={fieldProps} />
    )
  );
  await userEvent.fill(inputNamed(), "41234567");
  formNamed().reset();
  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
});

it("removes the reset listener and does not throw when unmounted before the deferred task", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  const { unmount } = render(
    withLocale("en-US", <UncontrolledFixture change={change} countryChange={countryChange} />)
  );
  const form = formNamed();
  const remove = vi.spyOn(document, "removeEventListener");
  await userEvent.fill(inputNamed(), "41234567");
  vi.useFakeTimers();
  try {
    form.reset();
    unmount();
    await vi.runOnlyPendingTimersAsync();
    expect(remove.mock.calls.some(([type]) => type === "reset")).toBe(true);
  } finally {
    vi.useRealTimers();
    remove.mockRestore();
  }
});

it("keeps a parent-owned value after reset and clears only when the parent accepts empty", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  function Parent() {
    const [value, setValue] = useState("");
    return (
      <form aria-label="Phone form">
        <PhoneNumberField
          label="Mobile"
          name="phone"
          value={value}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
          onCountryChange={countryChange}
        />
        <button type="reset">Reset</button>
        <button type="button" onClick={() => setValue("")}>
          Clear
        </button>
      </form>
    );
  }
  render(withLocale("en-US", <Parent />));
  await userEvent.fill(inputNamed(), "41234567");
  expect(snapshot()).toEqual(populatedSnapshot);
  const changeCalls = change.mock.calls.length;
  formNamed().reset();
  await expect.poll(() => snapshot()).toEqual(populatedSnapshot);
  expect(change).toHaveBeenCalledTimes(changeCalls);
  await userEvent.click(roleNamed("button", "Clear"));
  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
});

it("resubscribes when the field moves to a different form", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  const tree = (owner: "First" | "Second"): ReactNode => {
    const field = (
      <PhoneNumberField label="Mobile" name="phone" onChange={change} onCountryChange={countryChange} />
    );
    return withLocale(
      "en-US",
      <>
        <form aria-label="First">{owner === "First" ? field : null}</form>
        <form aria-label="Second">{owner === "Second" ? field : null}</form>
      </>
    );
  };
  const { rerender } = render(tree("First"));
  await userEvent.fill(inputNamed(), "41234567");
  expect(snapshot("First")).toEqual(populatedSnapshot);
  rerender(tree("Second"));
  await userEvent.fill(inputNamed(), "41234567");
  expect(snapshot("Second")).toEqual(populatedSnapshot);
  formNamed("First").reset();
  await expect.poll(() => snapshot("Second")).toEqual(populatedSnapshot);
  formNamed("Second").reset();
  await expect.poll(() => snapshot("Second")).toEqual(emptySnapshot);
});
