"use client";

import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";

import { discardStudioSession } from "../../studio/components/studio-persistence";

export type StudioErrorProps = {
  error: Error & { digest?: string };
  /** Fetches and renders the studio again. */
  retry: () => void;
};

/**
 * The studio failed to render. The session restores from the address's hash and the autosave on
 * every load, so an edit that breaks rendering would break every reload too; "Start a fresh
 * session" discards both before it tries again.
 */
export default function StudioError({ retry }: StudioErrorProps): ReactElement {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section aria-labelledby="studio-error-title" className="max-w-md flex flex-col items-start gap-4">
        <h1 id="studio-error-title" className="text-2xl font-semibold m-0 font-heading">
          The studio could not load
        </h1>
        <p className="m-0 text-muted-foreground">
          Try again. If it fails again, your saved edits may be what breaks it: a fresh session discards them
          and opens the studio without them.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              discardStudioSession();
              retry();
            }}>
            Start a fresh session
          </Button>
        </div>
      </section>
    </main>
  );
}
