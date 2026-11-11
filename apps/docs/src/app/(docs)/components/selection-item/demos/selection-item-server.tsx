import { Checkbox, CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";
import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

// A "use client" module whose rows render CheckboxItem and RadioItem around the children below.
import { AddOnRow, TariffRow } from "./client/plan-rows";

export function SelectionItemServer() {
  return (
    <div className="flex flex-col gap-6">
      <CheckboxItemGroup label="Meter readings">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox value="hourly" />}>
          <SelectionItem.Title>Hourly readings</SelectionItem.Title>
          <SelectionItem.SubSection>Sent to your supplier every night.</SelectionItem.SubSection>
        </SelectionItem.Shell>
      </CheckboxItemGroup>
      <CheckboxItemGroup label="Add-ons">
        <AddOnRow value="price-alerts">
          <CheckboxItem.Title>Price alerts</CheckboxItem.Title>
          <CheckboxItem.SubSection>
            A text message when the spot price passes 2 kr/kWh.
          </CheckboxItem.SubSection>
        </AddOnRow>
      </CheckboxItemGroup>
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
    </div>
  );
}
