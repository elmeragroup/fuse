"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListAlternate() {
  return (
    <TimelineList.Root layout="alternate">
      <TimelineList.Item opposite={<TimelineList.Time date="2026-03-03">3 March 2026</TimelineList.Time>}>
        <TimelineList.Title>Order placed</TimelineList.Title>
        <TimelineList.Description>Confirmed at checkout for meter 735999123.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item opposite={<TimelineList.Time date="2026-03-12">12 March 2026</TimelineList.Time>}>
        <TimelineList.Title>Meter reading received</TimelineList.Title>
        <TimelineList.Description>Submitted by the customer in My pages.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item opposite={<TimelineList.Time date="2026-04-01">1 April 2026</TimelineList.Time>}>
        <TimelineList.Title>Invoice issued</TimelineList.Title>
        <TimelineList.Description>NOK 2 310,00 ready for payment.</TimelineList.Description>
      </TimelineList.Item>
      <TimelineList.Item opposite={<TimelineList.Time date="2026-04-15">15 April 2026</TimelineList.Time>}>
        <TimelineList.Title>Payment received</TimelineList.Title>
        <TimelineList.Description>Paid by direct debit.</TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
