"use client";

import { Buildings, House } from "@elmeragroup/fuse/icons";
import { RadioGroupItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemIcon() {
  return (
    <RadioItemGroup label="Property type" defaultValue="house">
      <SelectionItem.Shell
        dataSlot="radio-item"
        control={
          <span className="flex items-center gap-2.5">
            <RadioGroupItem value="house" />
            <House aria-hidden />
          </span>
        }>
        <SelectionItem.Content>
          <SelectionItem.Title>House</SelectionItem.Title>
          <SelectionItem.Description>Detached or semi-detached.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
      <SelectionItem.Shell
        dataSlot="radio-item"
        control={
          <span className="flex items-center gap-2.5">
            <RadioGroupItem value="apartment" />
            <Buildings aria-hidden />
          </span>
        }>
        <SelectionItem.Content>
          <SelectionItem.Title>Apartment</SelectionItem.Title>
          <SelectionItem.Description>A unit in a shared building.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </RadioItemGroup>
  );
}
