"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { AutocompleteField } from "@elmeragroup/fuse/autocomplete-field";

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

export function AutocompleteFieldBasic() {
  return (
    <AutocompleteField
      label="Municipality"
      name="municipality"
      description="Pick a suggestion or type the name yourself."
      items={municipalities}
      placeholder="Type a municipality…"
      showClear
      className="max-w-xs">
      <Autocomplete.Empty>No suggestions. The text you typed is kept.</Autocomplete.Empty>
      <Autocomplete.List>
        {(municipality: string) => (
          <Autocomplete.Item key={municipality} value={municipality}>
            {municipality}
          </Autocomplete.Item>
        )}
      </Autocomplete.List>
    </AutocompleteField>
  );
}
