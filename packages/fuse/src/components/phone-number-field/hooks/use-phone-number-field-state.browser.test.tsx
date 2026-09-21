import { useRef, useState } from "react";
import type { ReactElement } from "react";

import { AsYouType } from "libphonenumber-js/core";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderThemed } from "../../../../test/themed-browser-render";
import { usePhoneNumberFieldState } from "./use-phone-number-field-state";
import type { UsePhoneNumberFieldStateOptions } from "./use-phone-number-field-state";

/**
 * `AsYouType#input` runs exactly once per libphonenumber parse: the private engine builds
 * one `AsYouType` per `parsePhoneNumber` call, feeds it the number, and nothing else in
 * the hook touches the parser. Patching the shared prototype counts real parses without
 * mocking the module.
 *
 * The budget is per-path, not one number: a keystroke costs
 * one parse, a paste that carries an international prefix costs three (two in the
 * detection pass, one for the emitted output), and a country change costs one. The figures
 * below are the whole claim; before this ticket the same paths cost six, and between four
 * and thirty-two for eight keystrokes depending on `outputFormat`/`international`.
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

type ProbeOptions = Omit<UsePhoneNumberFieldStateOptions, "locale" | "value" | "onChange">;

/** The controlled wiring PhoneNumberField itself uses: the emitted value comes straight back in. */
function ControlledProbe({
  options = {},
  onSelectSweden,
}: {
  options?: ProbeOptions;
  onSelectSweden?: (select: (code: "SE") => void) => void;
}): ReactElement {
  const [value, setValue] = useState("");
  const phone = usePhoneNumberFieldState({
    ...options,
    value,
    onChange: setValue,
    locale: "en-US",
  });
  onSelectSweden?.(phone.selectCountry);
  return (
    <input
      aria-label="Number"
      value={phone.displayValue}
      onChange={(event) => phone.handleInputChange(event.currentTarget.value)}
      onPaste={phone.handlePaste}
    />
  );
}

function numberInput(): HTMLInputElement {
  const element = page.getByRole("textbox", { name: "Number", exact: true }).element();
  if (!(element instanceof HTMLInputElement)) {
    throw new Error("expected the probe input");
  }
  return element;
}

/**
 * Parent can clear `value` and later restore the string the hook itself last emitted —
 * the form-reset / undo / navigate-back sequence the echo guard must still converge on.
 */
function RestoreProbe(): ReactElement {
  const [value, setValue] = useState("");
  const emittedRef = useRef("");
  const phone = usePhoneNumberFieldState({
    value,
    onChange: (next) => {
      emittedRef.current = next;
      setValue(next);
    },
    locale: "en-US",
  });
  return (
    <>
      <input
        aria-label="Number"
        value={phone.displayValue}
        onChange={(event) => phone.handleInputChange(event.currentTarget.value)}
      />
      <button type="button" onClick={() => setValue("")}>
        Clear
      </button>
      <button type="button" onClick={() => setValue(emittedRef.current)}>
        Restore
      </button>
    </>
  );
}

describe("usePhoneNumberFieldState parse budget", () => {
  it.each([
    ["default e164", {}],
    ["outputFormat national", { outputFormat: "national" } as const],
    ["international", { international: true } as const],
    ["formatOnType", { formatOnType: true } as const],
  ])("parses once per keystroke in %s, while the controlled value echoes back", async (_name, options) => {
    renderThemed(<ControlledProbe options={options} />);
    const input = page.getByRole("textbox", { name: "Number", exact: true });
    expect(parses, "mount must not parse an empty value").toBe(0);

    const digits = "41234567";
    for (const [index, digit] of digits.split("").entries()) {
      await userEvent.type(input, digit);
      expect(parses, `after ${index + 1} keystroke(s)`).toBe(index + 1);
    }
  });

  it("costs three parses for a paste that carries an international prefix", async () => {
    renderThemed(<ControlledProbe />);
    const input = numberInput();
    input.focus();

    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "+46701234567");
    input.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard })
    );

    await expect.poll(() => numberInput().value).toBe("701234567");
    // Two in the detection pass — the country probe and the national-number extraction —
    // and one for the emitted output, which the render then reads from the same cache.
    expect(parses).toBe(3);
  });

  it("costs one parse for a country change", async () => {
    let selectCountry: ((code: "SE") => void) | undefined;
    renderThemed(
      <ControlledProbe
        options={{ preserveOnCountryChange: true }}
        onSelectSweden={(select) => {
          selectCountry = select;
        }}
      />
    );
    await userEvent.type(page.getByRole("textbox", { name: "Number", exact: true }), "41234567");
    parses = 0;
    selectCountry?.("SE");
    await expect.poll(() => parses).toBe(1);
  });
});

describe("usePhoneNumberFieldState controlled restore", () => {
  it("shows the digits again when the parent clears then restores the emitted value", async () => {
    renderThemed(<RestoreProbe />);
    const input = page.getByRole("textbox", { name: "Number", exact: true });
    const digits = "41234567";
    for (const [index, digit] of digits.split("").entries()) {
      await userEvent.type(input, digit);
      expect(parses, `after ${index + 1} keystroke(s)`).toBe(index + 1);
    }
    await expect.poll(() => numberInput().value).toBe(digits);

    await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
    await expect.poll(() => numberInput().value).toBe("");

    await userEvent.click(page.getByRole("button", { name: "Restore", exact: true }));
    await expect.poll(() => numberInput().value).toBe(digits);
  });
});

describe("usePhoneNumberFieldState reset ownership", () => {
  it.each([undefined, "+4741234567"] as const)(
    "exposes onReset only when the value is uncontrolled: %s",
    (value) => {
      let phone: ReturnType<typeof usePhoneNumberFieldState> | undefined;

      function Probe() {
        // oxlint-disable-next-line react/globals -- test probe reads the capture synchronously after render()
        phone = usePhoneNumberFieldState({ locale: "en-US", value });
        return <input value={phone.displayValue} readOnly />;
      }

      renderThemed(<Probe />);
      if (value === undefined) {
        expect(phone?.onReset).toBeTypeOf("function");
      } else {
        expect(phone?.onReset).toBeNull();
      }
    }
  );
});

it.each([false, true])(
  "keeps accepted national digits when detection changes, same commit: %s",
  (sameCommit) => {
    let state: ReturnType<typeof usePhoneNumberFieldState> | undefined;
    function Host({ autoDetectCountry = true }: { autoDetectCountry?: boolean }) {
      const [value, setValue] = useState("");
      const [detect, setDetect] = useState(true);
      // oxlint-disable-next-line react/globals -- test probe reads the capture synchronously after render()
      state = usePhoneNumberFieldState({
        value,
        onChange(next) {
          setValue(next);
          if (sameCommit) setDetect(false);
        },
        international: true,
        locale: "en-US",
        autoDetectCountry: autoDetectCountry && detect,
      });
      return <input aria-label="Draft" readOnly value={state.displayValue} />;
    }
    const { host, rerender } = renderThemed(<Host />);
    flushSync(() => state?.handleInputChange("41234567"));
    if (!sameCommit) rerender(<Host autoDetectCountry={false} />);
    expect(host.querySelector("input")?.value).toBe("41234567");
    expect(state?.outputValue).toBe("+4741234567");
  }
);
