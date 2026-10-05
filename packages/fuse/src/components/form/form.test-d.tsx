import { expectTypeOf, test } from "vitest";

import type { FormProps } from "@elmeragroup/fuse/form";
import { Form } from "@elmeragroup/fuse/form";

test("errors maps a control name to one message or several, and onFormSubmit takes the typed values", () => {
  expectTypeOf<FormProps["errors"]>().toEqualTypeOf<Record<string, string | string[]> | undefined>();

  const _errors = <Form errors={{ email: "Already registered.", phone: ["Too short.", "Digits only."] }} />;
  // @ts-expect-error a message is a string or a list of strings
  const _badErrors = <Form errors={{ email: 1 }} />;

  type Signup = { email: string; phone: string };
  const _typed = (
    <Form<Signup>
      onFormSubmit={(values) => {
        expectTypeOf(values).toEqualTypeOf<Signup>();
      }}
    />
  );
  // Untyped, the values keep Base UI's default: any field name reads.
  const _untyped = (
    <Form
      onFormSubmit={(values) => {
        const _email: unknown = values.email;
      }}
    />
  );

  // @ts-expect-error Form has no recipe axis
  const _noVariant = <Form variant="card" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Form as="div" />;
});
