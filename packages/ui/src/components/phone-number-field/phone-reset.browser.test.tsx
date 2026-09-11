import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/ui/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { formNamed, inputNamed, searchNamed, submission } from "../../../test/phone-browser-queries";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

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

function PhoneForm(props: Partial<PhoneNumberFieldProps> = {}) {
  return (
    <form aria-label="Phone form">
      <PhoneNumberField label="Mobile" name="phone" {...props} />
      <button type="reset">Reset</button>
    </form>
  );
}

async function selectSweden() {
  roleNamed("button", "Select country").focus();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(page.getByRole("listbox").query()).not.toBeNull());
  await userEvent.fill(searchNamed(), "Sweden");
  await vi.waitFor(() => expect(page.getByRole("option", { name: /Sweden/ }).query()).not.toBeNull());
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await vi.waitFor(() => expect(page.getByRole("listbox").query()).toBeNull());
}

/**
 * The reset listener's plumbing lives in `useFormReset.browser.test.tsx`; these two cases
 * prove the phone composite reaches it from both native paths.
 */
it.each(["button", "programmatic"] as const)(
  "clears an uncontrolled number via %s reset without notifying",
  async (method) => {
    const change = vi.fn();
    const countryChange = vi.fn();
    render(withLocale("en-US", <PhoneForm onChange={change} onCountryChange={countryChange} />));
    await userEvent.fill(inputNamed(), "41234567");
    expect(snapshot()).toEqual(populatedSnapshot);
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;

    if (method === "button") await userEvent.click(roleNamed("button", "Reset"));
    else formNamed().reset();

    await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
    expect(roleNamed("button", "Select country").textContent).toContain("+47");

    // The reset must leave the field editable, and the next edit still flows through.
    await userEvent.fill(inputNamed(), "99887766");
    expect(snapshot()).toEqual({
      display: "99887766",
      submitted: "+4799887766",
      submittedDisplay: "99887766",
    });
    expect(change).toHaveBeenCalledTimes(changeCalls + 1);
    expect(change).toHaveBeenLastCalledWith("+4799887766");
  }
);

it.each([
  [
    "manually selected",
    async () => {
      await selectSweden();
      await userEvent.fill(inputNamed(), "701234567");
    },
  ],
  ["auto-detected", async () => userEvent.fill(inputNamed(), "+46701234567")],
])("preserves a %s country on programmatic reset", async (_label, arrange) => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(withLocale("en-US", <PhoneForm onChange={change} onCountryChange={countryChange} />));
  await arrange();
  expect(roleNamed("button", "Select country").textContent).toContain("+46");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;

  formNamed().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
  expect(roleNamed("button", "Select country").textContent).toContain("+46");
});

/** The shared lock/unlock harness: populate while editable, then reset while locked. */
function lockedField(props: Partial<PhoneNumberFieldProps>) {
  const change = vi.fn();
  const countryChange = vi.fn();
  const field = (locked: boolean) =>
    withLocale(
      "en-US",
      <PhoneForm onChange={change} onCountryChange={countryChange} {...(locked ? props : undefined)} />
    );
  return { change, countryChange, field };
}

it("clears a read-only uncontrolled field on programmatic reset", async () => {
  const { change, countryChange, field } = lockedField({ isReadOnly: true });
  const { rerender } = render(field(false));
  await userEvent.fill(inputNamed(), "41234567");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;
  rerender(field(true));

  formNamed().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
});

it("clears a disabled uncontrolled field on programmatic reset", async () => {
  const { change, countryChange, field } = lockedField({ isDisabled: true });
  const { rerender } = render(field(false));
  await userEvent.fill(inputNamed(), "41234567");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;
  rerender(field(true));

  formNamed().reset();

  await expect.poll(() => inputNamed().value).toBe("");
  // The reset task has landed; the counts now prove it stayed silent.
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
  // A disabled field owns no submittable value until it is enabled again.
  expect(submission().has("phone")).toBe(false);
  rerender(field(false));
  expect(submission().get("phone")).toBe("");
});

it.each([
  { international: true },
  { formatOnType: true },
  { outputFormat: "national" as const },
  { outputFormat: "raw" as const },
])("clears uncontrolled values for %o on programmatic reset", async (fieldProps) => {
  render(withLocale("en-US", <PhoneForm {...fieldProps} />));
  await userEvent.fill(inputNamed(), "41234567");

  formNamed().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
});
