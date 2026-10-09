import { describe, expect, it, vi } from "vitest";
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

it.each([
  {
    lock: "read-only",
    props: { isReadOnly: true },
    settled: async () => {
      await expect.poll(() => snapshot()).toEqual(emptySnapshot);
    },
    afterUnlock: undefined,
  },
  {
    lock: "disabled",
    props: { isDisabled: true },
    settled: async () => {
      await expect.poll(() => phoneInput().value).toBe("");
    },
    // A disabled field owns no submittable value until it is enabled again.
    afterUnlock: { lockedHasPhone: false, unlockedPhone: "" },
  },
] as const)(
  "clears a $lock uncontrolled field on programmatic reset",
  async ({ props, settled, afterUnlock }) => {
    const { change, countryChange, field } = lockedField(props);
    const { rerender } = render(field(false));
    await userEvent.fill(phoneInput(), "41234567");
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;
    rerender(field(true));

    phoneForm().reset();

    await settled();
    // The reset task has landed; the counts now prove it stayed silent.
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls);
    if (afterUnlock !== undefined) {
      expect(phoneSubmission().has("phone")).toBe(afterUnlock.lockedHasPhone);
      rerender(field(false));
      expect(phoneSubmission().get("phone")).toBe(afterUnlock.unlockedPhone);
    }
  }
);

describe("defaultValue", () => {
  it("restores a default in another country and reports the country it returns to", async () => {
    const change = vi.fn();
    const countryChange = vi.fn();
    render(
      withLocale(
        "en-US",
        <PhoneForm defaultValue="+46701234567" onChange={change} onCountryChange={countryChange} />
      )
    );
    expect(snapshot()).toEqual({
      display: "701234567",
      submitted: "+46701234567",
      submittedDisplay: "701234567",
    });
    await selectCountry("Norway");
    await userEvent.fill(phoneInput(), "41234567");
    expect(countryChange).toHaveBeenLastCalledWith({ code: "NO", dialCode: "+47" });
    const changeCalls = change.mock.calls.length;
    const countryCalls = countryChange.mock.calls.length;

    phoneForm().reset();

    await expect
      .poll(() => snapshot())
      .toEqual({ display: "701234567", submitted: "+46701234567", submittedDisplay: "701234567" });
    expect(roleNamed("button", "Select country").textContent).toContain("+46");
    expect(change).toHaveBeenCalledTimes(changeCalls);
    expect(countryChange).toHaveBeenCalledTimes(countryCalls + 1);
    expect(countryChange).toHaveBeenLastCalledWith({ code: "SE", dialCode: "+46" });
  });

  it("lets a controlled value win over the default, even when empty, through reset", async () => {
    render(
      withLocale(
        "en-US",
        <form aria-label="Phone form">
          <PhoneNumberField label="Mobile" name="phone" value="" defaultValue="+4741234567" />
          <PhoneNumberField label="Witness" name="witness" defaultValue="+4799887766" />
        </form>
      )
    );
    expect(snapshot()).toEqual(emptySnapshot);
    await userEvent.fill(phoneInput("Witness"), "41234567");

    phoneForm().reset();

    // The uncontrolled witness proves the reset task has run.
    await expect.poll(() => phoneInput("Witness").value).toBe("99887766");
    expect(snapshot()).toEqual(emptySnapshot);
  });
});
