"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

export function AutocompleteAlignEnd() {
  return (
    <div className="w-48">
      <Autocomplete.Root items={municipalities}>
        <Autocomplete.Input aria-label="Municipality" placeholder="Type a municipality…" />
        <Autocomplete.Content align="end" className="w-72">
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
