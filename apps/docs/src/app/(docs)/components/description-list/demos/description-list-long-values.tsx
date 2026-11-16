"use client";

import { DescriptionList } from "@elmeragroup/fuse/description-list";

export function DescriptionListLongValues() {
  return (
    <DescriptionList.Root className="max-w-xs w-full">
      <DescriptionList.Content layout="inline">
        <DescriptionList.Item>
          <DescriptionList.Term>Created</DescriptionList.Term>
          <DescriptionList.Details>30 September 2026 at 12:31:32</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Metering point ID</DescriptionList.Term>
          <DescriptionList.Details>707057500012345678</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Keep your existing phone number</DescriptionList.Term>
          <DescriptionList.Details>Yes</DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Invoice</DescriptionList.Term>
          <DescriptionList.Details>
            Emailed to kari.nordmann.hansen
            <wbr />
            @nordmannholding.no
          </DescriptionList.Details>
        </DescriptionList.Item>
        <DescriptionList.Item>
          <DescriptionList.Term>Email</DescriptionList.Term>
          <DescriptionList.Details>kari.nordmann.hansen@example.no</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList.Content>
    </DescriptionList.Root>
  );
}
