"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Tour, defineTour, memoryTourStorage, useTour } from "@elmeragroup/fuse/tour";

const invoices = defineTour({
  id: "invoices-guided",
  steps: ["latest", "download"],
});

function StartButton() {
  const tour = useTour(invoices);
  return (
    <Button variant="outline" onClick={() => tour.start()}>
      Show me around
    </Button>
  );
}

export function TourGuided() {
  const [storage] = useState(() => memoryTourStorage());
  return (
    <Tour.Provider storage={storage}>
      <div className="max-w-md flex w-full flex-col items-start gap-4">
        <StartButton />
        <Tour.Target
          tour={invoices}
          step="latest"
          title="Latest invoice"
          description="The amount due and the date we collect it."
          render={<div className="text-sm w-full rounded-md border p-4" />}>
          October invoice: 1 284 kr, due 15 November
        </Tour.Target>
        <Tour.Target
          tour={invoices}
          step="download"
          title="Download as PDF"
          description="Keep a copy for your records or your accountant."
          render={<div className="text-sm rounded-md border px-3 py-2" />}>
          Download PDF
        </Tour.Target>
      </div>
      <Tour.Popup tour={invoices} modal="trap-focus">
        <Tour.Spotlight />
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
