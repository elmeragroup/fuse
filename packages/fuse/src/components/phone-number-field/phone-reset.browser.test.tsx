import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";

import { withLocale } from "../../../test/locale-matrix";
import { phoneForm, phoneInput, phoneSubmission } from "../../../test/phone-browser-queries";
import { renderThemed as render } from "../../../test/themed-browser-render";

function snapshot(formName = "Phone form") {
  const submission = phoneSubmission(formName);
  return {
    display: phoneInput().value,
    submitted: submission.get("phone"),
    submittedDisplay: submission.get("phone-display-value"),
  };
}

const emptySnapshot = { display: "", submitted: "", submittedDisplay: "" };

function PhoneForm(props: Partial<PhoneNumberFieldProps> = {}) {
  return (
    <form aria-label="Phone form">
      <PhoneNumberField label="Mobile" name="phone" {...props} />
    </form>
  );
}

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
