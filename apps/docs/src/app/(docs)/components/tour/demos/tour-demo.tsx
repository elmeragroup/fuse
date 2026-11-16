"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Tour, defineTour, memoryTourStorage, useTour } from "@elmeragroup/fuse/tour";

const overview = defineTour({
  id: "usage-overview",
  steps: ["usage", "price"],
});

function StartButton() {
  const tour = useTour(overview);
  return (
    <Button variant="outline" onClick={() => tour.start()}>
      Take the tour
    </Button>
  );
}

export function TourDemo() {
  const [storage] = useState(() => memoryTourStorage());
  return (
    <Tour.Provider storage={storage}>
      <div className="max-w-md flex w-full flex-col items-start gap-4">
        <StartButton />
        <Tour.Target
          tour={overview}
          step="usage"
          title="Usage this month"
          description="Your consumption so far, updated every hour."
          render={<div className="text-sm w-full rounded-md border p-4" />}>
          412 kWh used in November
        </Tour.Target>
        <Tour.Target
          tour={overview}
          step="price"
          title="Your price"
          description="What you pay per kWh today, with grid fees."
          render={<div className="text-sm w-full rounded-md border p-4" />}>
          1.42 kr per kWh
        </Tour.Target>
      </div>
      <Tour.Popup tour={overview}>
        <Tour.Header>
          <Tour.Progress />
          <Tour.Close />
        </Tour.Header>
        <Tour.Title />
        <Tour.Description />
        <Tour.Footer>
          <Tour.Skip />
          <Tour.Prev />
          <Tour.Next />
        </Tour.Footer>
      </Tour.Popup>
    </Tour.Provider>
  );
}
