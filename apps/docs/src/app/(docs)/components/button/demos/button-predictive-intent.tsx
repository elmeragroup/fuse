"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";

export function ButtonPredictiveIntent() {
  const [prefetched, setPrefetched] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button variant="outline" predictionZoneSize={40} onIntent={() => setPrefetched(true)}>
        Open report
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {prefetched ? "Report prefetched" : "Move the pointer toward the button"}
      </p>
    </div>
  );
}
