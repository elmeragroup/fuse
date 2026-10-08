"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function SelectionItemSelectableSubsection() {
  return (
    <RadioItemGroup label="Price plans" defaultValue="fixed">
      <RadioItem value="fixed" isSubSectionSelectable>
        <RadioItem.Content>
          <RadioItem.Title>Fixed price</RadioItem.Title>
          <RadioItem.Description>Locked for 12 months.</RadioItem.Description>
        </RadioItem.Content>
        <RadioItem.SubSection>
          <p>No price changes while the agreement runs, and no fee to leave it at renewal.</p>
          <a href="#fixed-price-terms">Fixed price terms</a>
        </RadioItem.SubSection>
      </RadioItem>
      <RadioItem value="spot" isSubSectionSelectable>
        <RadioItem.Content>
          <RadioItem.Title>Spot price</RadioItem.Title>
          <RadioItem.Description>Follows the hourly market rate.</RadioItem.Description>
        </RadioItem.Content>
        <RadioItem.SubSection>
          <p>Cheaper when demand is low. Move usage to the night to pay less.</p>
          <a href="#spot-price-terms">Spot price terms</a>
        </RadioItem.SubSection>
      </RadioItem>
    </RadioItemGroup>
  );
}
