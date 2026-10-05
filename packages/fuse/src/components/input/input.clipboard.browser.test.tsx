import { createRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { formNamed, inputNamed, renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { Input } from "./input";

describe("Input numeric filter", () => {
  it("strips non-digits before onChange and Field validation read them, and sets inputMode", async () => {
    const changes = vi.fn<(value: string) => void>();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderThemed(
      <>
        <Field.Root validationMode="onChange" validate={(value) => `Saw ${String(value)}`}>
          <Field.Label>Pin</Field.Label>
          <Input
            filter="numeric"
            onChange={(event) => {
              changes(event.currentTarget.value);
            }}
          />
          <Field.Error />
        </Field.Root>
        <Input aria-label="Phone" filter="numeric" inputMode="tel" />
        <Input aria-label="Bad" filter="numeric" value="12a" readOnly />
      </>
    );

    const pin = inputNamed("Pin");
    expect(pin).toHaveProperty("inputMode", "numeric");
    expect(textboxNamed("Phone")).toHaveProperty("inputMode", "tel");

    const pinBox = page.getByRole("textbox", { name: "Pin", exact: true });
    await userEvent.type(pinBox, "ab");
    expect(changes).toHaveBeenLastCalledWith("");
    expect(pin).toHaveProperty("value", "");

    // A typed letter carries no digit, so the beforeinput listener leaves it to the change
    // handler. Validation reading `1` rather than `1a` shows that handler strips it first.
    await userEvent.type(pinBox, "1a");
    expect(changes).toHaveBeenLastCalledWith("1");
    await expect.element(page.getByText("Saw 1", { exact: true })).toBeVisible();

    await userEvent.fill(pinBox, "12a3");
    expect(changes).toHaveBeenLastCalledWith("123");
    expect(pin).toHaveProperty("value", "123");
    await expect.element(page.getByText("Saw 123", { exact: true })).toBeVisible();

    expect(warn).toHaveBeenCalledWith("Input: value is not a number");
    warn.mockRestore();
  });

  it("strips a pasted mixed run and accepts a digit run", async () => {
    const changes = vi.fn<(value: string) => void>();
    renderThemed(
      <>
        <Input aria-label="Clipboard source" defaultValue="12a3" />
        <Input
          aria-label="Pin"
          filter="numeric"
          onChange={(event) => {
            changes(event.currentTarget.value);
          }}
        />
      </>
    );
    const source = inputNamed("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();

    const pin = inputNamed("Pin");
    pin.focus();
    await userEvent.paste();
    expect(pin).toHaveProperty("value", "123");
    expect(changes).toHaveBeenLastCalledWith("123");

    source.value = "456";
    source.focus();
    source.select();
    await userEvent.copy();
    pin.focus();
    pin.select();
    await userEvent.paste();
    expect(pin).toHaveProperty("value", "456");
    expect(changes).toHaveBeenLastCalledWith("456");
  });

  it("counts maxLength in digits, so a pasted run with separators keeps its digits", async () => {
    const changes = vi.fn<(value: string) => void>();
    function ControlledPhone() {
      const [value, setValue] = useState("");
      return (
        <Input
          aria-label="Controlled phone"
          filter="numeric"
          maxLength={8}
          value={value}
          onChange={(event) => {
            setValue(event.currentTarget.value);
          }}
        />
      );
    }
    renderThemed(
      <>
        <Input aria-label="Clipboard source" />
        <Input
          aria-label="Phone"
          filter="numeric"
          maxLength={8}
          onChange={(event) => {
            changes(event.currentTarget.value);
          }}
        />
        <ControlledPhone />
      </>
    );
    const source = inputNamed("Clipboard source");
    const phone = inputNamed("Phone");
    async function pasteInto(
      target: HTMLInputElement,
      text: string,
      selection: [number, number]
    ): Promise<void> {
      source.value = text;
      source.focus();
      source.select();
      await userEvent.copy();
      target.focus();
      target.setSelectionRange(...selection);
      await userEvent.paste();
    }
    async function pasteIntoPhone(text: string, selection: [number, number]): Promise<void> {
      await pasteInto(phone, text, selection);
    }

    await pasteIntoPhone("912 34 567", [0, 0]);
    expect(phone).toHaveProperty("value", "91234567");
    expect(changes).toHaveBeenLastCalledWith("91234567");

    // An over-long run keeps its leading digits, as the native limit keeps leading characters.
    await pasteIntoPhone("1234 5678 9", [0, 8]);
    expect(phone).toHaveProperty("value", "12345678");

    // Into the middle: the digits land at the caret, and the caret ends after them.
    await pasteIntoPhone("12", [0, 8]);
    await pasteIntoPhone("3 4", [1, 1]);
    expect(phone).toHaveProperty("value", "1342");
    expect(phone.selectionStart).toBe(3);

    // A partial selection frees only its own length: 8 - 8 + 3 leaves room for three digits.
    await pasteIntoPhone("12345678", [0, 8]);
    await pasteIntoPhone("9 9 9 9", [2, 5]);
    expect(phone).toHaveProperty("value", "12999678");
    expect(phone.selectionStart).toBe(5);

    // A full field takes nothing more, and reports no change.
    await pasteIntoPhone("12345678", [0, 8]);
    const calls = changes.mock.calls.length;
    await pasteIntoPhone("9 9", [8, 8]);
    expect(phone).toHaveProperty("value", "12345678");
    expect(changes).toHaveBeenCalledTimes(calls);

    // A controlled input takes the digits through its own onChange.
    const controlled = inputNamed("Controlled phone");
    await pasteInto(controlled, "912 34 567", [0, 0]);
    expect(controlled).toHaveProperty("value", "91234567");
  });

  it("leaves a read-only numeric input and an input without a selection to the browser", async () => {
    const changes = vi.fn<(value: string) => void>();
    renderThemed(
      <>
        <Input aria-label="Clipboard source" defaultValue="912 34 567" />
        <Input
          aria-label="Locked"
          filter="numeric"
          maxLength={8}
          defaultValue="12"
          readOnly
          onChange={(event) => {
            changes(event.currentTarget.value);
          }}
        />
        <Input aria-label="Email digits" type="email" filter="numeric" maxLength={8} />
      </>
    );
    // An IME commit or dictation reaches a read-only input as a cancelable `beforeinput`
    // carrying the whole run. Real keys never carry mixed text and Playwright's fill refuses a
    // read-only field, so the event is dispatched rather than typed.
    const locked = inputNamed("Locked");
    locked.dispatchEvent(
      new InputEvent("beforeinput", { inputType: "insertText", data: "3 4", bubbles: true, cancelable: true })
    );
    expect(locked).toHaveProperty("value", "12");
    expect(changes).not.toHaveBeenCalled();

    // `type="email"` has no selection API: the paste keeps the native path, so the browser
    // cuts to maxlength first and the change handler strips what is left.
    const source = inputNamed("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();
    const email = page.getByRole("textbox", { name: "Email digits", exact: true });
    await email.click();
    await userEvent.paste();
    await expect.element(email).toHaveValue("912345");
  });

  it("leaves an insertion another listener cancelled alone", () => {
    const changes = vi.fn<(value: string) => void>();
    renderThemed(
      <Input
        aria-label="Pin"
        filter="numeric"
        defaultValue="12"
        onChange={(event) => {
          changes(event.currentTarget.value);
        }}
      />
    );
    const pin = inputNamed("Pin");
    pin.focus();
    pin.setSelectionRange(2, 2);
    const mixedRun = () =>
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: "3 4",
        bubbles: true,
        cancelable: true,
      });

    // A host veto, as an earlier listener would leave it.
    const vetoed = mixedRun();
    vetoed.preventDefault();
    pin.dispatchEvent(vetoed);
    expect(pin).toHaveProperty("value", "12");
    expect(changes).not.toHaveBeenCalled();

    // The same run, not cancelled, takes the filtered path.
    pin.dispatchEvent(mixedRun());
    expect(pin).toHaveProperty("value", "1234");
    expect(changes).toHaveBeenLastCalledWith("1234");
  });

  it("removes the numeric insertion listener when the filter goes away", async () => {
    const { rerender } = renderThemed(
      <>
        <Input aria-label="Clipboard source" defaultValue="912 34 567" />
        <Input aria-label="Phone" filter="numeric" maxLength={8} />
      </>
    );
    rerender(
      <>
        <Input aria-label="Clipboard source" defaultValue="912 34 567" />
        <Input aria-label="Phone" maxLength={8} />
      </>
    );
    const source = inputNamed("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();
    const phone = inputNamed("Phone");
    phone.focus();
    await userEvent.paste();
    // Unfiltered, the native limit keeps the first 8 characters, separators included.
    expect(phone).toHaveProperty("value", "912 34 5");
  });

  it("restores an uncontrolled numeric defaultValue on native reset without calling onChange", async () => {
    // The filter is a change handler on a plain uncontrolled input: a native reset restores
    // the default on its own.
    const changes = vi.fn<(value: string) => void>();
    renderThemed(
      <form aria-label="Pin form">
        <Input
          aria-label="Pin"
          name="pin"
          filter="numeric"
          defaultValue="123"
          onChange={(event) => {
            changes(event.currentTarget.value);
          }}
        />
      </form>
    );
    const pin = page.getByRole("textbox", { name: "Pin", exact: true });
    await userEvent.fill(pin, "456");
    await expect.element(pin).toHaveValue("456");
    const edits = changes.mock.calls.length;

    formNamed("Pin form").reset();

    await expect.element(pin).toHaveValue("123");
    expect(new FormData(formNamed("Pin form")).get("pin")).toBe("123");
    expect(changes, "native reset does not call onChange").toHaveBeenCalledTimes(edits);
  });

  it("merges the filter's listener with object and callback refs", () => {
    const objectRef = createRef<HTMLInputElement>();
    const callbackRef = vi.fn();
    const { unmount } = renderThemed(
      <>
        <Input aria-label="Object" filter="numeric" defaultValue="123" ref={objectRef} />
        <Input aria-label="Callback" filter="numeric" defaultValue="123" ref={callbackRef} />
      </>
    );
    expect(objectRef.current).toBe(inputNamed("Object"));
    expect(callbackRef).toHaveBeenCalledWith(inputNamed("Callback"));
    unmount();
    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenCalledWith(null);
  });
});
