"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteRight() {
  return (
    <div className="ml-0 w-56">
      <Autocomplete.Root items={municipalities}>
        <Autocomplete.Input aria-label="Municipality" placeholder="Type a municipality…" />
        <Autocomplete.Content side="right">
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
