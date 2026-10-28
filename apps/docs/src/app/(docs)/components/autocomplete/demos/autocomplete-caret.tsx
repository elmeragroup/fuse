"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { Field } from "@elmeragroup/fuse/field";

const reasons = [
  "Moving house",
  "Question about my bill",
  "Change of contract",
  "Meter reading",
  "Power outage",
];

export function AutocompleteCaret() {
  return (
    <Field.Root name="reason" className="max-w-xs">
      <Field.Label>Reason for contact</Field.Label>
      <Autocomplete.Root id="reason" items={reasons}>
        <Autocomplete.Input placeholder="Describe it in a few words…" showTrigger />
        <Autocomplete.Content>
          <Autocomplete.Empty />
          <Autocomplete.List>
            {(reason: string) => (
              <Autocomplete.Item key={reason} value={reason}>
                {reason}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete.Root>
    </Field.Root>
  );
}
