import { useState } from "react";

import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed as render } from "../../../test/themed-browser-render";
import { TextField } from "./text-field";

for (const resetMethod of ["button", "programmatic"] as const) {
  it(`restores the numeric defaultValue on native reset from the ${resetMethod} path`, async () => {
    const onChange = vi.fn();
    const { host } = render(
      <form>
        <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" onChange={onChange} />
        <button type="reset">Reset</button>
      </form>
    );
    const textbox = page.getByRole("textbox", { name: "Digits" });
    await userEvent.fill(textbox, "456");
    await expect.element(textbox).toHaveValue("456");
    const edits = onChange.mock.calls.length;

    if (resetMethod === "button") await userEvent.click(page.getByRole("button", { name: "Reset" }));
    else host.querySelector("form")?.reset();

    await expect.element(textbox).toHaveValue("123");
    const form = host.querySelector("form");
    if (!form) throw new Error("Expected form");
    expect(new FormData(form).get("digits")).toBe("123");
    expect(onChange, "native reset does not call onChange").toHaveBeenCalledTimes(edits);
  });
}

for (const defaultValue of ["", undefined, null] as const) {
  it(`resets numeric default ${JSON.stringify(defaultValue)} to empty`, async () => {
    const { host } = render(
      <form>
        <TextField label="Digits" name="digits" filter="numeric" defaultValue={defaultValue} />
      </form>
    );
    const textbox = page.getByRole("textbox", { name: "Digits" });
    await userEvent.fill(textbox, "456");
    host.querySelector("form")?.reset();
    await expect.element(textbox).toHaveValue("");
    const form = host.querySelector("form");
    if (!form) throw new Error("Expected form");
    expect(new FormData(form).get("digits")).toBe("");
  });
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

it("preserves a canceled reset", async () => {
  const { host } = render(
    <form onReset={(event) => event.preventDefault()}>
      <TextField label="Digits" name="digits" filter="numeric" defaultValue="123" />
    </form>
  );
  const form = host.querySelector("form");
  if (!form) throw new Error("Expected form");
  await userEvent.fill(page.getByRole("textbox", { name: "Digits" }), "456");
  form.reset();
  await expect.element(page.getByRole("textbox", { name: "Digits" })).toHaveValue("456");
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
