import type { ReactElement } from "react";

import type { Metadata } from "next";
import Link from "next/link";

import { DocumentRoot } from "../components/document-root";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Page not found · Fuse",
};

/**
 * The 404 for an address no route matches. The app has a root layout per route group, so none of
 * them can frame it; it renders its own document and points back into the site.
 */
export default function GlobalNotFound(): ReactElement {
  return (
    <DocumentRoot>
      <body className="m-0 grid min-h-dvh place-items-center bg-background p-6 font-sans text-foreground antialiased">
        <main className="max-w-md flex flex-col items-start gap-4">
          <h1 className="text-2xl font-semibold m-0 font-heading">Page not found</h1>
          <p className="m-0 text-muted-foreground">
            Nothing lives at this address. It may have moved when a page was renamed.
          </p>
          <nav aria-label="Back into the site" className="flex flex-wrap gap-4">
            <Link href="/docs" className="font-medium text-foreground underline underline-offset-4">
              Read the docs
            </Link>
            <Link href="/" className="font-medium text-foreground underline underline-offset-4">
              Go to the Fuse home page
            </Link>
          </nav>
        </main>
      </body>
    </DocumentRoot>
  );
}
