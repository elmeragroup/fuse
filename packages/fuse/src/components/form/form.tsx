"use client";

import type { ReactElement } from "react";

import { Form as FormPrimitive } from "@base-ui/react/form";

/** The props of `Form`, typed over the values `onFormSubmit` receives. */
export type FormProps<FormValues extends object = FormPrimitive.Values> = Omit<
  FormPrimitive.Props<FormValues>,
  "errors" | "onFormSubmit"
> & {
  /**
   * Error messages by field name, such as a server's response to a submit. Each key is the `name`
   * on a `Field.Root` or on the control inside it, and each value is one message or several. A
   * `Field.Error` without children shows them, and so do `TextField`, `PhoneNumberField`,
   * `SearchField`, `DateField`, `DatePickerField` and `DateRangePickerField` when they get no
   * `errorMessage`. A `DateRangePickerField` shows the errors under its `startName` and its
   * `endName`. After a submit, the form focuses the first field the new errors mark.
   *
   * Editing a field clears its error, and a new `errors` object shows the messages again. Until
   * then an error blocks every submit, so when a change in another field makes a field valid,
   * pass a new `errors` object without its message.
   */
  errors?: FormPrimitive.Props<FormValues>["errors"];
  /**
   * Called on submit with the values of the controls inside each `Field.Root`, keyed by `name`.
   * A `PhoneNumberField` gives its number in its `outputFormat`. It prevents the native submit;
   * leave it out to submit natively or to a form action.
   *
   * The form checks every enabled field first. While one is invalid, it calls neither this nor
   * `onSubmit`, runs no native submit or form action, and focuses the first invalid field. A
   * field passed `invalid`, or `isInvalid` on `TextField`, stays invalid for as long as you
   * pass it.
   */
  onFormSubmit?: FormPrimitive.Props<FormValues>["onFormSubmit"];
};

/** A native form whose `errors` reach the Fields inside it. */
export function Form<FormValues extends object = FormPrimitive.Values>(
  props: FormProps<FormValues>
): ReactElement {
  return <FormPrimitive<FormValues> data-slot="form" {...props} />;
}

Form.displayName = "Form";
