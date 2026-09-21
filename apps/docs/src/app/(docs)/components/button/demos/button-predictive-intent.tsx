"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";

export function ButtonPredictiveIntent() {
  const [prefetched, setPrefetched] = useState(false);
  const [predictionZoneSize, setPredictionZoneSize] = useState(30);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm flex items-center gap-2">
        Prediction zone
        <input
          type="range"
          min={0}
          max={80}
          value={predictionZoneSize}
          onChange={(event) => {
            setPrefetched(false);
            setPredictionZoneSize(Number(event.target.value));
          }}
        />
        <span>{predictionZoneSize}px</span>
      </label>
      <Button
        key={predictionZoneSize}
        predictionZoneSize={predictionZoneSize}
        onIntent={() => {
          setPrefetched(true);
        }}>
        Open details
      </Button>
      <p>{prefetched ? "Prefetched" : "Idle"}</p>
    </div>
  );
}
