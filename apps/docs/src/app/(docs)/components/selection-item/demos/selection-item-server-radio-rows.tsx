import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

// A "use client" module whose rows render RadioItem around the children below.
import { TariffRow } from "./client/plan-rows";

export function SelectionItemServerRadioRows() {
  return (
    <RadioItemGroup label="Tariff">
      <TariffRow value="spot">
        <RadioItem.Title>Spot price</RadioItem.Title>
        <RadioItem.SubSection>Follows the hourly market.</RadioItem.SubSection>
      </TariffRow>
      <TariffRow value="fixed">
        <RadioItem.Title>Fixed price</RadioItem.Title>
        <RadioItem.SubSection>Locked for 12 months.</RadioItem.SubSection>
      </TariffRow>
    </RadioItemGroup>
  );
}
