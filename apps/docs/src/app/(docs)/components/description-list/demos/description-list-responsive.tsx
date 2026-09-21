"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListResponsive() {
  return (
    <DescriptionList.Root>
      <DescriptionList.Heading>Meter point</DescriptionList.Heading>
      <DescriptionList.Content>
        <DescriptionList.Term>Metering point ID</DescriptionList.Term>
        <DescriptionList.Details>707057500012345678</DescriptionList.Details>
        <DescriptionList.Term>Installation address</DescriptionList.Term>
        <DescriptionList.Details>
          Storgata 1, inngang B, 4. etasje, 3611 Kongsberg, Buskerud
        </DescriptionList.Details>
        <DescriptionList.Term>Grid company notes</DescriptionList.Term>
        <DescriptionList.Details>
          Access via the courtyard. Ring the meter-room doorbell; the key cabinet code is on the work order.
        </DescriptionList.Details>
        <DescriptionList.Term>Tariff</DescriptionList.Term>
        <DescriptionList.Details>
          Spot with monthly average, plus grid rent billed separately
        </DescriptionList.Details>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
