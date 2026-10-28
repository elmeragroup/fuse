"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { AutocompleteField } from "@elmeragroup/fuse/autocomplete-field";

const reasons = [
  "Moving house",
  "Question about my bill",
  "Change of contract",
  "Meter reading",
  "Power outage",
];

export function AutocompleteFieldCaret() {
  return (
    <AutocompleteField
      label="Reason for contact"
      name="reason"
      items={reasons}
      placeholder="Describe it in a few words…"
      showTrigger
      className="max-w-xs">
      <Autocomplete.Empty />
      <Autocomplete.List>
        {(reason: string) => (
          <Autocomplete.Item key={reason} value={reason}>
            {reason}
          </Autocomplete.Item>
        )}
      </Autocomplete.List>
    </AutocompleteField>
  );
}
