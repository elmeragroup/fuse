"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Tour, defineTour, memoryTourStorage, useTour } from "@elmeragroup/fuse/tour";

const contract = defineTour({
  id: "contract",
  steps: ["welcome", "plan", "renewal"],
  content: {
    welcome: {
      title: "Your contract",
      description: "A quick look at what you signed up for.",
      placement: "center",
    },
    plan: { title: "Your plan", description: "Spot price, billed monthly." },
    renewal: { title: "Renewal date", description: "We remind you a month before." },
  },
});

function StartButton() {
  const tour = useTour(contract);
  return (
    <Button variant="outline" onClick={() => tour.start()}>
      Explain my contract
    </Button>
  );
}

export function TourHtmlTarget() {
  const [storage] = useState(() => memoryTourStorage());
  return (
    <Tour.Provider storage={storage}>
      <div className="max-w-md text-sm flex w-full flex-col items-start gap-4">
        <StartButton />
        <dl className="grid w-full grid-cols-2 gap-2 rounded-md border p-4">
          <dt>Plan</dt>
          <dd data-tour-step="contract.plan">Spot price</dd>
          <dt>Renews</dt>
          <dd data-tour-step="contract.renewal">1 March 2027</dd>
        </dl>
      </div>
      <Tour.Popup tour={contract} modal="trap-focus">
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
