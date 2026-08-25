"use client";

import { TimelineList } from "@elmeragroup/ui/timeline-list";

export function TimelineListRich() {
  return (
    <TimelineList.Root>
      <TimelineList.Item>
        <TimelineList.Title>Order placed</TimelineList.Title>
        <TimelineList.Time date="2026-03-03T10:00:00.000Z">3 March 2026</TimelineList.Time>
        <TimelineList.Description>Confirmed at checkout for meter 735999123.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Time date="2026-04-01T00:00:00.000Z">1 April 2026</TimelineList.Time>
        <TimelineList.Description>
          NOK 2 310,00 ready for payment.{" "}
          <a href="#invoice-4821" className="underline">
            View invoice 4821
          </a>
        </TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Reminder sent</TimelineList.Title>
        <TimelineList.Time date="2026-04-15T09:00:00.000Z">15 April 2026</TimelineList.Time>
        <TimelineList.Description>
          Payment still open.{" "}
          <a href="#pay-4821" className="underline">
            Pay now
          </a>
        </TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
