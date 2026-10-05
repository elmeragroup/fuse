// The root entry, which the browser projects pre-bundle; a new subpath would load a second React.
import { Form } from "@base-ui/react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, textboxNamed, textNamed } from "../../../test/themed-browser-render";
import { Field } from "../field";
import { TextField } from "./text-field";

describe("TextField Field wiring", () => {
  it("keeps the Field label when a wrapper forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextField label="Email" id={undefined} aria-labelledby={undefined} />);
    const input = textboxNamed("Email");
    const labelId = textNamed("Email").id;
    expect(labelId).not.toBe("");
    expect(input.getAttribute("aria-labelledby")).toBe(labelId);
  });

  it("disables the input inside a disabled Field.Set", () => {
    renderThemed(
      <Field.Set disabled>
        <TextField label="Email" />
      </Field.Set>
    );
    expect(textboxNamed("Email")).toHaveProperty("disabled", true);
  });

  it("shows the Form error under its name without errorMessage, and errorMessage wins", async () => {
    const { rerender } = renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Already registered.");
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBe("true");
    await expect.element(textboxNamed("Email")).toHaveAccessibleDescription("Already registered.");

    rerender(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" errorMessage="Ask your administrator." />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Ask your administrator.");
  });

  it("drops the Form error once the value changes", async () => {
    renderThemed(
      <Form errors={{ email: "Already registered." }}>
        <TextField label="Email" name="email" />
      </Form>
    );
    expect(page.getByRole("alert").element().textContent).toBe("Already registered.");

    await userEvent.type(textboxNamed("Email"), "a");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    expect(textboxNamed("Email").getAttribute("aria-invalid")).toBeNull();
  });
});
