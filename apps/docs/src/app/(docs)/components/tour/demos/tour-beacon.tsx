"use client";

import { useState } from "react";

import { Tour, defineTour, memoryTourStorage } from "@elmeragroup/fuse/tour";

const exportTip = defineTour({
  id: "export-tip",
  steps: ["export"],
  content: {
    export: { title: "Export your readings", description: "Download every hourly reading as a CSV file." },
  },
});

export function TourBeacon() {
  const [storage] = useState(() => memoryTourStorage());
  return (
    <Tour.Provider storage={storage}>
      <div className="text-sm flex items-center gap-2">
        <span>Meter readings</span>
        <Tour.Beacon tour={exportTip} />
      </div>
      <Tour.Popup tour={exportTip} side="right">
        <Tour.Header>
          <Tour.Title />
          <Tour.Close />
        </Tour.Header>
        <Tour.Description />
        <Tour.Footer>
          <Tour.Next />
        </Tour.Footer>
      </Tour.Popup>
    </Tour.Provider>
  );
}
