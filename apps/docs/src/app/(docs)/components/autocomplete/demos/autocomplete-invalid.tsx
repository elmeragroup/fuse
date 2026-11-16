"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { Field } from "@elmeragroup/fuse/field";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteInvalid() {
  return (
    <Field.Root invalid>
      <Field.Label>Municipality</Field.Label>
      <Autocomplete.Root items={municipalities} defaultValue="Osl">
        <Autocomplete.Input placeholder="Type a municipality…" />
        <Autocomplete.Content>
          <Autocomplete.Empty />
          <Autocomplete.List>
            {(municipality: string) => (
              <Autocomplete.Item key={municipality} value={municipality}>
                {municipality}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
      <Field.Error>Enter a municipality in Norway.</Field.Error>
    </Field.Root>
  );
}
