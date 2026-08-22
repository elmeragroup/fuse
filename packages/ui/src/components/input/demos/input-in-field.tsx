import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function InputInField() {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Description>Work address preferred.</Field.Description>
      <Field.Error>Enter a valid email.</Field.Error>
    </Field.Root>
  );
}
