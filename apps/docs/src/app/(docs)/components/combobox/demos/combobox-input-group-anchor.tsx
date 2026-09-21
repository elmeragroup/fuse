"use client";

import { Combobox, useComboboxAnchor } from "@elmeragroup/fuse/combobox";
import { InputGroup } from "@elmeragroup/fuse/input-group";

const countries = ["Norway", "Sweden", "Finland", "Denmark"] as const;

export function ComboboxInputGroupAnchor() {
  const anchor = useComboboxAnchor();
  return (
    <Combobox.Root items={[...countries]}>
      <InputGroup.Root ref={anchor}>
        <InputGroup.Input aria-label="Selected country" readOnly placeholder="Pick a country" />
        <InputGroup.Addon align="inline-end">
          <Combobox.Trigger aria-label="Open country list" />
        </InputGroup.Addon>
      </InputGroup.Root>
      <Combobox.Content anchor={anchor}>
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
