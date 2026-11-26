"use client";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListHorizontalOpposite() {
  return (
    <ScrollArea.Root orientation="horizontal" className="max-w-md w-full">
      <div className="pb-4">
        <TimelineList.Root layout="horizontal">
          <TimelineList.Item opposite={<TimelineList.Time date="2026-01-15">Q1 2026</TimelineList.Time>}>
            <TimelineList.Title>Smart meters</TimelineList.Title>
            <TimelineList.Description>Every customer on a remote-read meter.</TimelineList.Description>
          </TimelineList.Item>
          <TimelineList.Item opposite={<TimelineList.Time date="2026-04-15">Q2 2026</TimelineList.Time>}>
            <TimelineList.Title>Hourly prices</TimelineList.Title>
            <TimelineList.Description>Spot prices shown by the hour in My pages.</TimelineList.Description>
          </TimelineList.Item>
          <TimelineList.Item opposite={<TimelineList.Time date="2026-07-15">Q3 2026</TimelineList.Time>}>
            <TimelineList.Title>Solar export</TimelineList.Title>
            <TimelineList.Description>Surplus power credited on the invoice.</TimelineList.Description>
          </TimelineList.Item>
          <TimelineList.Item opposite={<TimelineList.Time date="2026-10-15">Q4 2026</TimelineList.Time>}>
            <TimelineList.Title>EV charging</TimelineList.Title>
            <TimelineList.Description>Charging scheduled for the cheapest hours.</TimelineList.Description>
          </TimelineList.Item>
        </TimelineList.Root>
      </div>
    </ScrollArea.Root>
  );
}
