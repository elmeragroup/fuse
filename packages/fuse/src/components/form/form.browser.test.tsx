import { createRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { formNamed, inputNamed, renderThemed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { Field } from "../field";
import { Input } from "../input/input";
import { TextField } from "../text-field/text-field";
import { Form } from "./form";
import type { FormProps } from "./form";

function errorTexts(): string[] {
  return page
    .getByRole("alert")
    .elements()
    .map((element) => element.textContent);
}

function SignupFields() {
  return (
    <>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Input name="email" />
        <Field.Error />
      </Field.Root>
      <TextField label="Phone" name="phone" />
    </>
  );
}

describe("Form", () => {
  it("renders a native form with the form slot and forwards its ref", () => {
    const ref = createRef<HTMLFormElement>();
    renderThemed(<Form aria-label="Signup" ref={ref} />);
    const form = formNamed("Signup");
    expect(form.getAttribute("data-slot")).toBe("form");
    // The fields show constraint messages themselves, so the browser's own bubbles stay off.
    expect(form.noValidate).toBe(true);
    expect(ref.current).toBe(form);
  });

  it("shows each error under its control's name, through Field.Error and TextField", () => {
    renderThemed(
      <Form
        aria-label="Signup"
        errors={{ email: "Already registered.", phone: ["Too short.", "Digits only."] }}>
        <SignupFields />
      </Form>
    );

    const email = inputNamed("Email");
    const phone = inputNamed("Phone");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(errorTexts()).toEqual(["Already registered.", "Too short.Digits only."]);
    // Several messages under one name render as a list.
    const phoneErrors = page
      .getByRole("alert")
      .nth(1)
      .getByRole("listitem")
      .elements()
      .map((item) => item.textContent);
    expect(phoneErrors).toEqual(["Too short.", "Digits only."]);
  });

  it("clears a field's error when the user edits it, and shows the errors again for a new errors object", async () => {
    function Fixture({ errors }: Pick<FormProps, "errors">) {
      return (
        <Form aria-label="Signup" errors={errors}>
          <SignupFields />
        </Form>
      );
    }
    const { rerender } = renderThemed(
      <Fixture errors={{ email: "Already registered.", phone: "Too short." }} />
    );

    await userEvent.type(page.getByRole("textbox", { name: "Email", exact: true }), "a");
    expect(inputNamed("Email").getAttribute("aria-invalid")).toBeNull();
    expect(errorTexts()).toEqual(["Too short."]);

    // A second response with the same messages is a new object, as a server action returns.
    rerender(<Fixture errors={{ email: "Already registered.", phone: "Too short." }} />);
    await expect.element(page.getByText("Already registered.", { exact: true })).toBeVisible();
    expect(errorTexts()).toEqual(["Already registered.", "Too short."]);
  });

  it("passes the field values to onFormSubmit and focuses the first field the returned errors mark", async () => {
    const submitted = vi.fn();
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>({});
      return (
        <Form
          aria-label="Signup"
          errors={errors}
          onFormSubmit={(values) => {
            submitted(values);
            setErrors({ phone: "Too short." });
          }}>
          <SignupFields />
          <Button type="submit">Sign up</Button>
        </Form>
      );
    }
    renderThemed(<Fixture />);

    await userEvent.fill(page.getByRole("textbox", { name: "Email", exact: true }), "ada@example.com");
    await userEvent.fill(page.getByRole("textbox", { name: "Phone", exact: true }), "12");
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));

    expect(submitted).toHaveBeenCalledWith({ email: "ada@example.com", phone: "12" });
    await expect.element(page.getByText("Too short.", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: "Phone", exact: true })).toHaveFocus();
  });
});

describe("Form submit check", () => {
  it("calls no submit handler while an error sits on a field the user has not edited", async () => {
    const submitted = vi.fn();
    renderThemed(
      <Form aria-label="Signup" errors={{ email: "Already registered." }} onFormSubmit={submitted}>
        <SignupFields />
        <Button type="submit">Sign up</Button>
      </Form>
    );

    // Editing another field leaves the error in place, so the submit stops on its field.
    await userEvent.fill(page.getByRole("textbox", { name: "Phone", exact: true }), "12345678");
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));
    expect(submitted).not.toHaveBeenCalled();
    await expect.element(page.getByRole("textbox", { name: "Email", exact: true })).toHaveFocus();

    // Only an edit of the field that holds the error clears it.
    await userEvent.type(page.getByRole("textbox", { name: "Email", exact: true }), "a");
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));
    expect(submitted).toHaveBeenCalledOnce();
  });

  it("calls no submit handler for as long as a Field inside it is passed invalid", async () => {
    const submitted = vi.fn();
    function Fixture({ isInvalid }: { isInvalid: boolean }) {
      return (
        <Form aria-label="Signup" onFormSubmit={submitted}>
          <TextField
            label="Email"
            name="email"
            isInvalid={isInvalid}
            errorMessage="Enter your work address."
          />
          <Button type="submit">Sign up</Button>
        </Form>
      );
    }
    const { rerender } = renderThemed(<Fixture isInvalid />);

    await userEvent.type(page.getByRole("textbox", { name: "Email", exact: true }), "ada@example.com");
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));
    expect(submitted).not.toHaveBeenCalled();

    rerender(<Fixture isInvalid={false} />);
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));
    expect(submitted).toHaveBeenCalledOnce();
  });

  it("leaves a plain form's submit to its own handler when a field is passed invalid", async () => {
    const submitted = vi.fn();
    renderThemed(
      <form
        aria-label="Signup"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submitted();
        }}>
        <TextField label="Email" name="email" isInvalid errorMessage="Enter your work address." />
        <Button type="submit">Sign up</Button>
      </form>
    );

    expect(inputNamed("Email").getAttribute("aria-invalid")).toBe("true");
    await expect.element(inputNamed("Email")).toHaveAccessibleDescription("Enter your work address.");
    // `invalid` marks the field without setting a custom validity, so nothing native blocks.
    expect(inputNamed("Email").validity.valid).toBe(true);
    await userEvent.click(page.getByRole("button", { name: "Sign up", exact: true }));
    expect(submitted).toHaveBeenCalledOnce();
  });
});
