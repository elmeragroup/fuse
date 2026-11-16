"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";
import { ComboboxField } from "@elmeragroup/fuse/combobox-field";

const countries = ["Denmark", "Finland", "Iceland", "Norway", "Sweden"];

export function ComboboxFieldWithoutCaret() {
  return (
    <ComboboxField
      label="Country"
      description="Where the meter is installed."
      items={countries}
      placeholder="Search countries…"
      showTrigger={false}>
      <Combobox.Empty />
      <Combobox.List>
        {(country: string) => (
          <Combobox.Item key={country} value={country}>
            {country}
          </Combobox.Item>
        )}
      </Combobox.List>
    </ComboboxField>
  );
}
