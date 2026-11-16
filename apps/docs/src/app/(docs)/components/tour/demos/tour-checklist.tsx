"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Tour, defineTour, memoryTourStorage, useTour, useTourStepDone } from "@elmeragroup/fuse/tour";

const setup = defineTour({
  id: "account-setup",
  steps: ["meter", "payment", "alerts"],
  content: {
    meter: { title: "Connect your meter", description: "Enter the meter ID from your contract." },
    payment: { title: "Add a payment method", description: "Pay by direct debit or card." },
    alerts: { title: "Turn on price alerts", description: "Get a message when prices peak." },
  },
});

const TASKS = [
  { step: "meter", label: "Connect your meter" },
  { step: "payment", label: "Add a payment method" },
  { step: "alerts", label: "Turn on price alerts" },
] as const;

function Task({ step, label }: (typeof TASKS)[number]) {
  const tour = useTour(setup);
  const done = useTourStepDone(setup, step);
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span data-tour-step={`account-setup.${step}`} className={done ? "line-through" : undefined}>
        {label}
      </span>
      <span className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => tour.startStep(step)}>
          Show me
        </Button>
        <Button size="sm" disabled={done} onClick={() => tour.completeStep(step)}>
          Mark done
        </Button>
      </span>
    </li>
  );
}

function Progress() {
  const tour = useTour(setup);
  return (
    <p className="text-sm">
      {tour.doneCount} of {tour.count} done
    </p>
  );
}

export function TourChecklist() {
  const [storage] = useState(() => memoryTourStorage());
  return (
    <Tour.Provider storage={storage}>
      <div className="max-w-md w-full">
        <Progress />
        <ul className="divide-y">
          {TASKS.map((task) => (
            <Task key={task.step} {...task} />
          ))}
        </ul>
      </div>
      <Tour.Popup tour={setup} side="top">
        <Tour.Ring />
        <Tour.Title />
        <Tour.Description />
        <Tour.Footer>
          <Tour.Next />
        </Tour.Footer>
      </Tour.Popup>
    </Tour.Provider>
  );
}
