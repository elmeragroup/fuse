"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteCaret() {
  return (
    <Autocomplete.Root items={municipalities}>
      <Autocomplete.Input aria-label="Municipality" placeholder="Type a municipality…" showTrigger />
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
  );
}
