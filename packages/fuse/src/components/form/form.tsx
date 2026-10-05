"use client";

import type { ReactElement } from "react";

import { Form as FormPrimitive } from "@base-ui/react/form";

/** Base UI's Form props, typed over the values `onFormSubmit` receives. */
export type FormProps<FormValues extends object = FormPrimitive.Values> = FormPrimitive.Props<FormValues>;

/**
 * A native form whose `errors` reach the Fields inside it, such as validation errors a server
 * returned after submit. Keys are the names of the controls, and each value is one message or
 * several. A `Field.Error` without children shows the error under its control's name, and so
 * does `TextField` when it gets no `errorMessage`. Editing a field clears its error, and a new
 * `errors` object shows them again. The interim react-aria fields read React Aria's own form
 * context instead, so pass them `errorMessage` and `isInvalid`.
 */
export function Form<FormValues extends object = FormPrimitive.Values>(
  props: FormProps<FormValues>
): ReactElement {
  return <FormPrimitive<FormValues> data-slot="form" {...props} />;
}

Form.displayName = "Form";
