"use client";

import { TimelineList } from "@elmeragroup/ui/timeline-list";

export function TimelineListBasic() {
  return (
    <TimelineList.Root>
      <TimelineList.Item>
        <TimelineList.Title>Order placed</TimelineList.Title>
        <TimelineList.Time date="2026-03-03T10:00:00.000Z">3 March 2026</TimelineList.Time>
        <TimelineList.Description>Confirmed at checkout for meter 735999123.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Meter reading received</TimelineList.Title>
        <TimelineList.Time date="2026-03-12T08:30:00.000Z">12 March 2026</TimelineList.Time>
        <TimelineList.Description>Submitted by the customer in My pages.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Time date="2026-04-01T00:00:00.000Z">1 April 2026</TimelineList.Time>
        <TimelineList.Description>NOK 2 310,00 ready for payment.</TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
