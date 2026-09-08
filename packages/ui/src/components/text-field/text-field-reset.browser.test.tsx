import { createRef, useState } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed as render } from "../../../test/themed-browser-render";
import { TextField } from "./text-field";

for (const defaultValue of ["123", "", undefined, null] as const) {
  for (const resetMethod of ["button", "programmatic"] as const) {
    it(`restores ${resetMethod} reset for numeric default ${JSON.stringify(defaultValue)}`, async () => {
      const onChange = vi.fn();
      const { host } = render(
        <form>
          <TextField
            label="Digits"
            name="digits"
            filter="numeric"
            defaultValue={defaultValue}
            onChange={onChange}
          />
          <button type="reset">Reset</button>
        </form>
      );
      const textbox = page.getByRole("textbox", { name: "Digits" });
      await userEvent.fill(textbox, "456");
      await expect.element(textbox).toHaveValue("456");
      const edits = onChange.mock.calls.length;
      if (resetMethod === "button") await userEvent.click(page.getByRole("button", { name: "Reset" }));
      else host.querySelector("form")?.reset();
      const expected = defaultValue ?? "";
      await expect.element(textbox).toHaveValue(expected);
      const form = host.querySelector("form");
      if (!form) throw new Error("Expected form");
      expect(new FormData(form).get("digits")).toBe(expected);
      expect(onChange).toHaveBeenCalledTimes(edits);
    });
  }
}

it("resets a nonnumeric TextField to its defaultValue", async () => {
  const { host } = render(
    <form>
      <TextField label="Plain" name="plain" defaultValue="abc" />
      <button type="reset">Reset</button>
    </form>
  );
  const textbox = page.getByRole("textbox", { name: "Plain" });
  await userEvent.fill(textbox, "xyz");
  await expect.element(textbox).toHaveValue("xyz");
  await userEvent.click(page.getByRole("button", { name: "Reset" }));
  await expect.element(textbox).toHaveValue("abc");
  const form = host.querySelector("form");
  if (!form) throw new Error("Expected form");
  expect(new FormData(form).get("plain")).toBe("abc");
});

it("preserves a canceled reset and removes the form subscription on unmount", async () => {
  const { host, unmount } = render(
    <form onReset={(event) => event.preventDefault()}>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" />
    </form>
  );
  const form = host.querySelector("form");
  if (!form) throw new Error("Expected form");
  const remove = vi.spyOn(form, "removeEventListener");
  await userEvent.fill(page.getByRole("textbox", { name: "Digits" }), "456");
  form.reset();
  await expect.element(page.getByRole("textbox", { name: "Digits" })).toHaveValue("456");
  unmount();
  expect(remove.mock.calls.some(([type]) => type === "reset")).toBe(true);
  remove.mockRestore();
});

it("keeps controlled digits and callbacks owned by the parent after reset", async () => {
  const onChange = vi.fn();
  function Fixture() {
    const [value, setValue] = useState("123");
    return (
      <form>
        <TextField
          label="Digits"
          name="digits"
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
  const { host } = render(<Fixture />);
  await userEvent.fill(page.getByRole("textbox", { name: "Digits" }), "456");
  const edits = onChange.mock.calls.length;
  host.querySelector("form")?.reset();
  await expect.element(page.getByRole("textbox", { name: "Digits" })).toHaveValue("456");
  expect(onChange).toHaveBeenCalledTimes(edits);
});

it("restores defaultValue when associated with an external form", async () => {
  render(
    <>
      <form id="outer">
        <button type="reset">Reset</button>
      </form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" form="outer" />
    </>
  );
  const textbox = page.getByRole("textbox", { name: "Digits" });
  await userEvent.fill(textbox, "456");
  await expect.element(textbox).toHaveValue("456");
  await userEvent.click(page.getByRole("button", { name: "Reset" }));
  await expect.element(textbox).toHaveValue("123");
});

it("re-subscribes when the form attribute changes", async () => {
  const { rerender } = render(
    <>
      <form id="a">
        <button type="reset">Reset A</button>
      </form>
      <form id="b">
        <button type="reset">Reset B</button>
      </form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" form="a" />
    </>
  );
  const textbox = page.getByRole("textbox", { name: "Digits" });
  await userEvent.fill(textbox, "456");
  await expect.element(textbox).toHaveValue("456");
  rerender(
    <>
      <form id="a">
        <button type="reset">Reset A</button>
      </form>
      <form id="b">
        <button type="reset">Reset B</button>
      </form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" form="b" />
    </>
  );
  await userEvent.click(page.getByRole("button", { name: "Reset B" }));
  await expect.element(textbox).toHaveValue("123");
  await userEvent.fill(textbox, "456");
  await expect.element(textbox).toHaveValue("456");
  await userEvent.click(page.getByRole("button", { name: "Reset A" }));
  await expect.element(textbox).toHaveValue("456");
});

it("does not warn when unmounted before the deferred reset write", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { host, unmount } = render(
    <form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" />
    </form>
  );
  const form = host.querySelector("form");
  if (!form) throw new Error("Expected form");
  await userEvent.fill(page.getByRole("textbox", { name: "Digits" }), "456");
  vi.useFakeTimers();
  try {
    form.reset();
    unmount();
    await vi.runOnlyPendingTimersAsync();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    error.mockRestore();
  }
});

it("restores the latest defaultValue after reset, not a stale one", async () => {
  const { rerender } = render(
    <form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" />
      <button type="reset">Reset</button>
    </form>
  );
  const textbox = page.getByRole("textbox", { name: "Digits" });
  await userEvent.fill(textbox, "456");
  await expect.element(textbox).toHaveValue("456");
  rerender(
    <form>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="789" />
      <button type="reset">Reset</button>
    </form>
  );
  await expect.element(textbox).toHaveValue("456");
  await userEvent.click(page.getByRole("button", { name: "Reset" }));
  await expect.element(textbox).toHaveValue("789");
});

it("forwards object and callback refs to the inner input", () => {
  const objectRef = createRef<HTMLInputElement>();
  const callbackRef = vi.fn();
  const { unmount } = render(
    <>
      <TextField label="Object" filter="numeric" defaultValue="123" ref={objectRef} />
      <TextField label="Callback" filter="numeric" defaultValue="123" ref={callbackRef} />
    </>
  );
  expect(objectRef.current).toBeInstanceOf(HTMLInputElement);
  expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  unmount();
  expect(objectRef.current).toBeNull();
  expect(callbackRef).toHaveBeenCalledWith(null);
});
