"use client";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListHorizontal() {
  return (
    <ScrollArea.Root orientation="horizontal" className="max-w-md w-full">
      <div className="pb-4">
        <TimelineList.Root layout="horizontal">
          <TimelineList.Item>
            <TimelineList.Title>Order placed</TimelineList.Title>
            <TimelineList.Time date="2026-03-03">3 March 2026</TimelineList.Time>
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>Meter installed</TimelineList.Title>
            <TimelineList.Time date="2026-03-10">10 March 2026</TimelineList.Time>
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>First reading</TimelineList.Title>
            <TimelineList.Time date="2026-03-12">12 March 2026</TimelineList.Time>
          </TimelineList.Item>
          <TimelineList.Item>
            <TimelineList.Title>Invoice issued</TimelineList.Title>
            <TimelineList.Time date="2026-04-01">1 April 2026</TimelineList.Time>
          </TimelineList.Item>
        </TimelineList.Root>
      </div>
    </ScrollArea.Root>
  );
}
