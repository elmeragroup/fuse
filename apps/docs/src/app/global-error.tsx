"use client";

import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";

import { DocumentRoot } from "../components/document-root";
import "../styles/globals.css";

export type GlobalErrorProps = {
  error: Error & { digest?: string };
  /** Fetches and renders the failed layout again. */
  retry: () => void;
};

/**
 * The last resort for an error no nearer boundary caught, such as one in a root layout. It
 * replaces the whole document, so it renders its own `<html>`, styles and title.
 */
export default function GlobalError({ retry }: GlobalErrorProps): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 grid min-h-dvh place-items-center bg-background p-6 font-sans text-foreground antialiased">
        <title>Something went wrong · Fuse</title>
        <main className="max-w-md flex flex-col items-start gap-4">
          <h1 className="text-2xl font-semibold m-0 font-heading">Something went wrong</h1>
          <p className="m-0 text-muted-foreground">
            This page could not be shown. Try again, or reload the page if the site was just updated.
          </p>
          <Button onClick={retry}>Try again</Button>
        </main>
      </body>
    </DocumentRoot>
  );
}
