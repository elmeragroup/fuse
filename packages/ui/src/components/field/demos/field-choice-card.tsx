import { Field } from "@elmeragroup/ui/field";

export function FieldChoiceCard() {
  return (
    <Field.Label>
      <Field.Root>
        <Field.Title>Fixed price</Field.Title>
        <Field.Content>
          <Field.Description>Lock the kilowatt-hour rate for twelve months.</Field.Description>
        </Field.Content>
      </Field.Root>
    </Field.Label>
  );
}
