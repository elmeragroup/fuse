import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { Form } from "@elmeragroup/fuse/form";
import type { FormProps } from "@elmeragroup/fuse/form";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";
import { TextField } from "@elmeragroup/fuse/text-field";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { countrySearch, openPicker, phoneInput, selectCountry } from "../../../test/phone-browser-queries";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";

type SignupValues = { email: string; phone: string };

/** The issue's fixture: an email TextField and the phone field in one Form. */
function Signup({
  errors,
  onFormSubmit,
  phone = {},
}: {
  errors?: FormProps["errors"];
  onFormSubmit?: (values: SignupValues) => void;
  phone?: Partial<PhoneNumberFieldProps>;
}) {
  return (
    <Form<SignupValues> aria-label="Signup" errors={errors} onFormSubmit={(values) => onFormSubmit?.(values)}>
      <TextField name="email" label="Email" />
      <PhoneNumberField name="phone" label="Mobile" {...phone} />
      <Button type="submit">Save</Button>
    </Form>
  );
}

function render(node: ReturnType<typeof Signup>) {
  return renderThemed(withLocale("en-US", node));
}

function alertTexts(): string[] {
  return page
    .getByRole("alert")
    .elements()
    .map((element) => element.textContent);
}

describe("PhoneNumberField in a Form", () => {
  it("shows the error under its name, clears it on an edit, and submits its number under that name", async () => {
    const submitted = vi.fn();
    render(
      <Signup errors={{ email: "Enter an email", phone: "Enter a phone number" }} onFormSubmit={submitted} />
    );
    expect(alertTexts()).toEqual(["Enter an email", "Enter a phone number"]);
    expect(phoneInput().getAttribute("aria-invalid")).toBe("true");

    await userEvent.fill(page.getByRole("textbox", { name: "Email", exact: true }), "kari@example.com");
    await userEvent.fill(phoneInput(), "91234567");
    await expect.poll(alertTexts).toEqual([]);
    expect(phoneInput().getAttribute("aria-invalid")).toBeNull();

    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toHaveBeenCalledExactlyOnceWith({ email: "kari@example.com", phone: "+4791234567" });
    const data = new FormData(formNamed("Signup"));
    expect(data.getAll("phone")).toEqual(["+4791234567"]);
    expect(data.getAll("phone-display-value")).toEqual(["91234567"]);
  });

  it("clears the error for a country that changes the number, not for a search in the picker", async () => {
    render(<Signup errors={{ phone: "Enter a Swedish number" }} phone={{ defaultValue: "+4741234567" }} />);
    await openPicker();
    await userEvent.fill(countrySearch(), "swe");
    expect(alertTexts()).toEqual(["Enter a Swedish number"]);
    await userEvent.keyboard("{Escape}");
    await selectCountry("Sweden");
    await expect.poll(alertTexts).toEqual([]);
  });

  it("keeps the phone's registration through the picker, in the configured output format", async () => {
    const submitted = vi.fn();
    render(<Signup onFormSubmit={submitted} phone={{ outputFormat: "national" }} />);
    await userEvent.fill(phoneInput(), "41234567");
    await openPicker();
    await userEvent.fill(countrySearch(), "fin");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toHaveBeenCalledExactlyOnceWith({ email: "", phone: "41 23 45 67" });
  });

  it("focuses the number input for an error the submit returns", async () => {
    function Fixture() {
      const [errors, setErrors] = useState<FormProps["errors"]>({});
      return <Signup errors={errors} onFormSubmit={() => setErrors({ phone: "Not a mobile number" })} />;
    }
    render(<Fixture />);
    await userEvent.fill(phoneInput(), "21234567");
    await userEvent.click(roleNamed("button", "Save"));
    await expect.element(page.getByText("Not a mobile number", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: "Mobile", exact: true })).toHaveFocus();
  });

  it("blocks an empty required submit and focuses the number input", async () => {
    const submitted = vi.fn();
    render(<Signup onFormSubmit={submitted} phone={{ isRequired: true }} />);
    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).not.toHaveBeenCalled();
    await expect.element(page.getByRole("textbox", { name: "Mobile", exact: true })).toHaveFocus();
    expect(phoneInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps the error while the number it submits stays the same", async () => {
    // A country picked for an empty field submits nothing either way.
    const { unmount } = render(<Signup errors={{ phone: "Enter a phone number" }} />);
    await selectCountry("Sweden");
    expect(alertTexts()).toEqual(["Enter a phone number"]);
    unmount();

    // A parent that rejects the edit keeps the number it holds.
    render(
      <Signup
        errors={{ phone: "Server says no" }}
        phone={{ value: "+4741234567", onChange: () => undefined }}
      />
    );
    await userEvent.fill(phoneInput(), "99887766");
    expect(phoneInput().value).toBe("41234567");
    expect(alertTexts()).toEqual(["Server says no"]);
    expect(phoneInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps an error passed with a new value in the same render", async () => {
    function Fixture() {
      const [state, setState] = useState<{ value: string; errors: FormProps["errors"] }>({
        value: "",
        errors: {},
      });
      return (
        <>
          <Signup errors={state.errors} phone={{ value: state.value, onChange: () => undefined }} />
          <button
            type="button"
            onClick={() => setState({ value: "+4799999999", errors: { phone: "Number taken" } })}>
            Reject
          </button>
        </>
      );
    }
    render(<Fixture />);
    await userEvent.click(roleNamed("button", "Reject"));
    expect(phoneInput().value).toBe("99999999");
    expect(alertTexts()).toEqual(["Number taken"]);
    expect(phoneInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("leaves a surrounding Field's name and control alone", async () => {
    const submitted = vi.fn<(values: { phone: string }) => void>();
    renderThemed(
      withLocale(
        "en-US",
        <Form<{ phone: string }>
          aria-label="Signup"
          onFormSubmit={(values) => {
            submitted(values);
          }}>
          <Field.Root name="contact">
            <PhoneNumberField name="phone" label="Mobile" />
          </Field.Root>
          <Button type="submit">Save</Button>
        </Form>
      )
    );
    await userEvent.fill(phoneInput(), "41234567");
    await userEvent.click(roleNamed("button", "Save"));
    expect(submitted).toHaveBeenCalledExactlyOnceWith({ phone: "+4741234567" });
  });

  it("disables the picker with a disabled Field.Set around the field", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Field.Set disabled>
          <PhoneNumberField label="Mobile" />
        </Field.Set>
      )
    );
    expect(phoneInput()).toHaveProperty("disabled", true);
    expect(roleNamed("button", "Select country")).toHaveProperty("disabled", true);
  });
});
