import { Field } from "@elmeragroup/ui/field";

export function FieldSeparatorDemo() {
  return (
    <Field.Group>
      <Field.Root>
        <Field.Label>Given name</Field.Label>
        <Field.Control render={<input />} />
      </Field.Root>
      <Field.Separator>Account</Field.Separator>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Field.Control render={<input type="email" />} />
      </Field.Root>
    </Field.Group>
  );
}
