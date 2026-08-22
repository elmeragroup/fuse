import { Field } from "@elmeragroup/ui/field";

export function FieldErrorDemo() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Field.Control render={<input type="email" defaultValue="" />} />
      <Field.Error>Enter a work email.</Field.Error>
    </Field.Root>
  );
}
