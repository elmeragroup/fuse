"use client";

import { useState } from "react";

import { Slider } from "@elmeragroup/fuse/slider";

export function SliderCommit() {
  const [changed, setChanged] = useState(40);
  const [committed, setCommitted] = useState(40);
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Volume" defaultValue={40} onChange={setChanged} onValueCommitted={setCommitted} />
      <p className="tabular-nums">Last change: {changed}</p>
      <p className="tabular-nums">Last commit: {committed}</p>
    </div>
  );
}
