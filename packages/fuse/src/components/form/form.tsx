"use client";

import type { ReactElement } from "react";

import { Form as FormPrimitive } from "@base-ui/react/form";

/** Base UI's Form props, typed over the values `onFormSubmit` receives. */
export type FormProps<FormValues extends object = FormPrimitive.Values> = FormPrimitive.Props<FormValues>;

/**
 * A native form whose `errors` reach the Fields inside it, such as validation errors a server
 * returned after submit. Keys are the names of the controls, and each value is one message or
 * several. A `Field.Error` without children shows the error under its control's name, and so
 * do `TextField`, `PhoneNumberField` and the interim react-aria fields when they get no
 * `errorMessage`. Editing a field clears its error, and a new `errors` object shows them again.
 * The react-aria fields are not Fields of the form: their values are not in `onFormSubmit`'s,
 * and their own validation does not block a submit.
 *
 * Every submit first checks the enabled Fields inside the form. While any of them is invalid,
 * the form calls neither `onSubmit` nor `onFormSubmit`, lets no native submit or form action
 * run, and focuses the first one it can. An
 * `errors` entry counts until its own field's value changes or a new `errors` object leaves it
 * out, and a Field passed `invalid` (TextField's `isInvalid`) for as long as it is passed. In
 * the default `onSubmit` validation mode, Fields also re-check their native constraints on
 * every change from the first submit on. So when a change elsewhere can make a field valid, as
 * with rules in a schema, pass a new `errors` object without the stale message, or use a plain
 * `<form noValidate>` and pass each field `isInvalid` and `errorMessage` (or `Field.Root
 * invalid` and `Field.Error` children) instead.
 */
export function Form<FormValues extends object = FormPrimitive.Values>(
  props: FormProps<FormValues>
): ReactElement {
  return <FormPrimitive<FormValues> data-slot="form" {...props} />;
}

Form.displayName = "Form";
