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
 *
 * Every submit first checks the Fields inside the form. While any of them is invalid, the form
 * focuses the first one and calls neither `onSubmit` nor `onFormSubmit`. An `errors` entry
 * counts until its own field's value changes, and a Field passed `invalid` (TextField's
 * `isInvalid`) for as long as it is passed. From the first submit on, Fields also re-check
 * their native constraints on every change. So when a change elsewhere can make a field valid,
 * as with rules in a schema, use a plain `<form noValidate>` and pass each field `isInvalid`
 * and `errorMessage`, or `Field.Root invalid` and `Field.Error` children, instead.
 */
export function Form<FormValues extends object = FormPrimitive.Values>(
  props: FormProps<FormValues>
): ReactElement {
  return <FormPrimitive<FormValues> data-slot="form" {...props} />;
}

Form.displayName = "Form";
