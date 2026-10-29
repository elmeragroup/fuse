import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { inputNamed, renderThemed } from "../../../test/themed-browser-render";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("forwards the numeric filter to the inner input, so digits reach onChange and maxLength counts digits", async () => {
    // Input owns the filter and its own suite covers each path; this pins the forwarding.
    const onChange = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderThemed(
      <>
        <TextField aria-label="Clipboard source" defaultValue="912 34 567" />
        <TextField label="Phone" filter="numeric" maxLength={8} onChange={onChange} />
        <TextField label="Bad" filter="numeric" value="12a" isReadOnly />
      </>
    );

    const phone = inputNamed("Phone");
    expect(phone).toHaveProperty("inputMode", "numeric");

    await userEvent.type(page.getByRole("textbox", { name: "Phone", exact: true }), "ab");
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(phone).toHaveProperty("value", "");

    const source = inputNamed("Clipboard source");
    source.focus();
    source.select();
    await userEvent.copy();
    phone.focus();
    await userEvent.paste();
    expect(phone).toHaveProperty("value", "91234567");
    expect(onChange).toHaveBeenLastCalledWith("91234567");

    expect(warn).toHaveBeenCalledWith("Input: value is not a number");
    warn.mockRestore();
  });
});
