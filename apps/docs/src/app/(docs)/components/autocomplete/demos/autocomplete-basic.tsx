"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { Field } from "@elmeragroup/fuse/field";

const municipalities = [
  "Bergen",
  "Bodø",
  "Drammen",
  "Fredrikstad",
  "Kristiansand",
  "Oslo",
  "Stavanger",
  "Tromsø",
  "Trondheim",
];

export function AutocompleteBasic() {
  return (
    <Field.Root name="municipality" spacing="part" className="max-w-xs">
      <Field.Label>Municipality</Field.Label>
      <Autocomplete.Root id="municipality" items={municipalities}>
        <Autocomplete.Input placeholder="Type a municipality…" showClear />
        <Autocomplete.Content>
          <Autocomplete.Empty>No suggestions. The text you typed is kept.</Autocomplete.Empty>
          <Autocomplete.List>
            {(municipality: string) => (
              <Autocomplete.Item key={municipality} value={municipality}>
                {municipality}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
      <Field.Description>Pick a suggestion or type the name yourself.</Field.Description>
    </Field.Root>
  );
}
