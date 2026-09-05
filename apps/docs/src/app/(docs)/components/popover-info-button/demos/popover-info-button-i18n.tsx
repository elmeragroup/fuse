"use client";

import { Field } from "@elmeragroup/ui/field";
import { Popover } from "@elmeragroup/ui/popover";
import { PopoverInfoButton } from "@elmeragroup/ui/popover-info-button";

export function PopoverInfoButtonI18n() {
  return (
    <Field.Root>
      <Field.Label>
        Nettleie
        <PopoverInfoButton label="Mer informasjon">
          <Popover.Header>
            <Popover.Title>Hva er nettleie?</Popover.Title>
            <Popover.Description>
              Nettleien er det du betaler for å bruke strømnettet. Beløpet fastsettes av nettselskapet og
              kommer i tillegg til strømprisen.
            </Popover.Description>
          </Popover.Header>
        </PopoverInfoButton>
      </Field.Label>
    </Field.Root>
  );
}
