"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteInlineEnd() {
  return (
    <div className="ms-0 w-56">
      <Autocomplete.Root items={municipalities}>
        <Autocomplete.Input aria-label="Municipality" placeholder="Type a municipality…" />
        <Autocomplete.Content side="inline-end">
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
    </div>
  );
}
