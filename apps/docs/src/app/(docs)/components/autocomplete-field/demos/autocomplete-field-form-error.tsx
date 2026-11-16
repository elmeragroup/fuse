"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { AutocompleteField } from "@elmeragroup/fuse/autocomplete-field";
import { Form } from "@elmeragroup/fuse/form";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteFieldFormError() {
  return (
    <Form errors={{ municipality: "We do not deliver to Tromsø yet." }}>
      <AutocompleteField
        label="Municipality"
        description="Pick a suggestion or type the name yourself."
        name="municipality"
        items={municipalities}
        defaultValue="Tromsø">
        <Autocomplete.Empty />
        <Autocomplete.List>
          {(municipality: string) => (
            <Autocomplete.Item key={municipality} value={municipality}>
              {municipality}
            </Autocomplete.Item>
          )}
        </Autocomplete.List>
      </AutocompleteField>
    </Form>
  );
}
