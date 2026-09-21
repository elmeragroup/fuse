import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneForm, phoneInput, phoneSubmission, selectCountry } from "../../../test/phone-browser-queries";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

function snapshot(formName = "Phone form") {
  const submission = phoneSubmission(formName);
  return {
    display: phoneInput().value,
    submitted: submission.get("phone"),
    submittedDisplay: submission.get("phone-display-value"),
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
    </form>
  );
}

/**
 * The reset listener's plumbing (button vs programmatic path, cancel, unmount) is proved in
 * `use-form-reset.browser.test.tsx`; this case proves the phone composite's own state follows
 * the native control and the field stays editable afterwards.
 */
it("clears an uncontrolled number on reset without notifying", async () => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(withLocale("en-US", <PhoneForm onChange={change} onCountryChange={countryChange} />));
  await userEvent.fill(phoneInput(), "41234567");
  expect(snapshot()).toEqual(populatedSnapshot);
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;

  phoneForm().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
  expect(roleNamed("button", "Select country").textContent).toContain("+47");

  // The reset must leave the field editable, and the next edit still flows through.
  await userEvent.fill(phoneInput(), "99887766");
  expect(snapshot()).toEqual({
    display: "99887766",
    submitted: "+4799887766",
    submittedDisplay: "99887766",
  });
  expect(change).toHaveBeenCalledTimes(changeCalls + 1);
  expect(change).toHaveBeenLastCalledWith("+4799887766");
});

it.each([
  [
    "manually selected",
    async () => {
      await selectCountry("Sweden");
      await userEvent.fill(phoneInput(), "701234567");
    },
  ],
  ["auto-detected", async () => userEvent.fill(phoneInput(), "+46701234567")],
])("preserves a %s country on programmatic reset", async (_label, arrange) => {
  const change = vi.fn();
  const countryChange = vi.fn();
  render(withLocale("en-US", <PhoneForm onChange={change} onCountryChange={countryChange} />));
  await arrange();
  expect(roleNamed("button", "Select country").textContent).toContain("+46");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;

  phoneForm().reset();

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
  await userEvent.fill(phoneInput(), "41234567");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;
  rerender(field(true));

  phoneForm().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
});

it("clears a disabled uncontrolled field on programmatic reset", async () => {
  const { change, countryChange, field } = lockedField({ isDisabled: true });
  const { rerender } = render(field(false));
  await userEvent.fill(phoneInput(), "41234567");
  const changeCalls = change.mock.calls.length;
  const countryCalls = countryChange.mock.calls.length;
  rerender(field(true));

  phoneForm().reset();

  await expect.poll(() => phoneInput().value).toBe("");
  // The reset task has landed; the counts now prove it stayed silent.
  expect(change).toHaveBeenCalledTimes(changeCalls);
  expect(countryChange).toHaveBeenCalledTimes(countryCalls);
  // A disabled field owns no submittable value until it is enabled again.
  expect(phoneSubmission().has("phone")).toBe(false);
  rerender(field(false));
  expect(phoneSubmission().get("phone")).toBe("");
});

it.each([
  { international: true },
  { formatOnType: true },
  { outputFormat: "national" as const },
  { outputFormat: "raw" as const },
])("clears uncontrolled values for %o on programmatic reset", async (fieldProps) => {
  render(withLocale("en-US", <PhoneForm {...fieldProps} />));
  await userEvent.fill(phoneInput(), "41234567");

  phoneForm().reset();

  await expect.poll(() => snapshot()).toEqual(emptySnapshot);
});
