"use client";

import { useEffect } from "react";

type DemoHydrationMarkerProps = {
  /** Id of the frame's heading; the marker stamps the `[data-demo-frame]` it labels. */
  headingId: string;
};

/**
 * Sets `data-demo-hydrated` on its demo frame once the demo is live, and renders nothing.
 *
 * With Cache Components, Next wraps each route segment in an Activity boundary, and the frame
 * wraps its demo in a Suspense boundary of its own, so each demo hydrates in its own pass after
 * the docs shell and the page. Until then, text typed into the demo shows but never reaches React
 * state, and no shell or page signal covers that window. The marker sits inside the demo's
 * boundary, so it commits with the demo, and it writes from a passive effect, so the attribute
 * also proves the demo's own passive effects have run. The attribute is written, never rendered,
 * so the server HTML stays without it and hydration stays clean. Browser tests wait for it.
 */
export function DemoHydrationMarker({ headingId }: DemoHydrationMarkerProps): null {
  useEffect(() => {
    // The lookup reads only demo frames, so a prose heading that shares the id cannot take it.
    const frame = document.querySelector(`[data-demo-frame][aria-labelledby="${CSS.escape(headingId)}"]`);
    frame?.setAttribute("data-demo-hydrated", "");
    return () => frame?.removeAttribute("data-demo-hydrated");
  }, [headingId]);

  return null;
}
