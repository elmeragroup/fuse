"use client";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const municipalities = ["Bergen", "Bodø", "Oslo", "Stavanger", "Tromsø", "Trondheim"];

function MunicipalityInput({ label, size }: { label: string; size?: "sm" | "default" }) {
  return (
    <Autocomplete.Root items={municipalities}>
      <Autocomplete.Input size={size} aria-label={label} placeholder={label} showClear className="w-56" />
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
  );
}

export function AutocompleteSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MunicipalityInput label="Small" size="sm" />
      <MunicipalityInput label="Default" />
    </div>
  );
}
