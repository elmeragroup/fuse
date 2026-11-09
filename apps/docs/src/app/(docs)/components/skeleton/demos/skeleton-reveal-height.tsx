"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

type Notice = { readonly title: string; readonly paragraphs: readonly string[] };

// One short paragraph: the real notice is longer, so the reveal eases to its height.
const SAMPLE: Notice = {
  title: "Planned maintenance",
  paragraphs: ["The grid operator is working in your area."],
};

const NOTICE: Notice = {
  title: "Planned maintenance on 12 May",
  paragraphs: [
    "The grid operator will replace a transformer in your area between 09:00 and 13:00.",
    "Power may be off for up to two hours in that window. Your meter keeps its readings.",
    "Unplug sensitive equipment beforehand. You do not need to be at home.",
  ],
};

const LOAD_MS = 1500;

export function SkeletonRevealHeight() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setNotice(NOTICE), LOAD_MS);
    return () => clearTimeout(timer);
  }, [request]);

  return (
    <div className="max-w-sm flex w-full flex-col gap-4">
      <SkeletonReveal data={notice} sample={SAMPLE} reveal="together" label="Loading notice">
        {(shown) => (
          <Card.Root>
            <Card.Header>
              <Card.Title>{shown.title}</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
              {shown.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Card.Content>
          </Card.Root>
        )}
      </SkeletonReveal>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => {
          setNotice(null);
          setRequest((count) => count + 1);
        }}>
        Reload
      </Button>
    </div>
  );
}
