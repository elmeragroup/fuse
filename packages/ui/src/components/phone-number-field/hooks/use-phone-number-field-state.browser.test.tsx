import { useState } from "react";
import type { ReactElement } from "react";

import { AsYouType } from "libphonenumber-js/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderThemed } from "../../../../test/themed-browser-render";
import { usePhoneNumberFieldState } from "./use-phone-number-field-state";

/**
 * `AsYouType#input` runs exactly once per libphonenumber parse: the private engine builds
 * one `AsYouType` per `parsePhoneNumber` call, feeds it the number, and nothing else in
 * the hook touches the parser. Patching the shared prototype counts real parses without
 * mocking the module. The hook used to run up to three per controlled keystroke — the
 * detection pass, the emitted output, and the rendered display value — and
 * phone-number-field.md §8.16 fixes the budget at one.
 *
 * The hook needs a React renderer that runs effects, which the node `unit` project has no
 * dependency for, so this behavioural unit test on the hook alone lives in the `browser`
 * project. It renders no library component, only the shared themed harness.
 */
// SAFETY: `input` is `AsYouType`'s own prototype method, read through its descriptor so the
// reference stays unbound and `.call` below restores the instance.
const realInput = Object.getOwnPropertyDescriptor(AsYouType.prototype, "input")?.value as (
  this: AsYouType,
  text: string
) => string;
let parses = 0;

beforeEach(() => {
  parses = 0;
  AsYouType.prototype.input = function countingInput(this: AsYouType, text: string) {
    parses += 1;
    return realInput.call(this, text);
  };
});

afterEach(() => {
  AsYouType.prototype.input = realInput;
});

/** The controlled wiring PhoneNumberField itself uses: the emitted value comes straight back in. */
function ControlledProbe(): ReactElement {
  const [value, setValue] = useState("");
  const phone = usePhoneNumberFieldState({ value, onChange: setValue, locale: "en-US" });
  return (
    <input
      aria-label="Number"
      value={phone.displayValue}
      onChange={(event) => phone.handleInputChange(event.currentTarget.value)}
    />
  );
}

describe("usePhoneNumberFieldState parse budget", () => {
  it("parses once per keystroke while the controlled value echoes back", async () => {
    renderThemed(<ControlledProbe />);
    const input = page.getByRole("textbox", { name: "Number", exact: true });
    expect(parses, "mount must not parse an empty value").toBe(0);

    const digits = "41234567";
    for (const [index, digit] of digits.split("").entries()) {
      await userEvent.type(input, digit);
      expect(parses, `after ${index + 1} keystroke(s)`).toBe(index + 1);
    }

    expect(input.element()).toHaveProperty("value", digits);
  });
});
