import { Checkbox, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemServerShell() {
  return (
    <CheckboxItemGroup label="Meter readings">
      <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox value="hourly" />}>
        <SelectionItem.Title>Hourly readings</SelectionItem.Title>
        <SelectionItem.SubSection>Sent to your supplier every night.</SelectionItem.SubSection>
      </SelectionItem.Shell>
    </CheckboxItemGroup>
  );
}
