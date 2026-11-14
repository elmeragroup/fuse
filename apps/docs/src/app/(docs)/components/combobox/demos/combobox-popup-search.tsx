"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Combobox } from "@elmeragroup/fuse/combobox";

const countries = ["Norway", "Sweden", "Finland", "Denmark"];

export function ComboboxPopupSearch() {
  return (
    <Combobox.Root items={countries} defaultValue="Norway">
      <Combobox.Trigger
        aria-label="Country"
        render={<Button variant="outline" className="w-56 justify-between" />}>
        <Combobox.Value />
      </Combobox.Trigger>
      <Combobox.Content>
        <Combobox.Input showTrigger={false} aria-label="Search countries" placeholder="Search countries…" />
        <Combobox.Empty />
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}
