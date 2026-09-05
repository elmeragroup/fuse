"use client";

import { Frame } from "@elmeragroup/ui/frame";

export function FrameBasic() {
  return (
    <Frame.Root>
      <Frame.Header>
        <Frame.Title>Invoices</Frame.Title>
        <Frame.Description>Last 30 days</Frame.Description>
      </Frame.Header>
      <Frame.Panel>
        <p>Three invoices issued for meter 735999123. NOK 2 310,00 outstanding.</p>
      </Frame.Panel>
      <Frame.Footer>
        <p>Export the period or send a reminder.</p>
      </Frame.Footer>
    </Frame.Root>
  );
}
