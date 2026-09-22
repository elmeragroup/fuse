import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BUNDLE_SIZES, BUNDLE_SIZES_MEASURED_ON } from "../generated/bundle-sizes";
import { ceilingUsage } from "../lib/docs-model";
import { DocsTable } from "./docs-table";

const KIB = 1024;

function kib(bytes: number): string {
  return `${(bytes / KIB).toFixed(1)} kB`;
}

function percent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}

const bundleSizes = tv({
  slots: {
    note: "text-xs m-[-0.4rem_0_1.4rem] text-muted-foreground",
  },
});

const { note } = bundleSizes();

/**
 * The measured size of every published entry against the ceiling `size-limit` enforces
 * Both columns are generated from the library's budget module, so
 * the table cannot drift from the gate it describes.
 */
export function BundleSizes(): ReactElement {
  return (
    <>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <DocsTable.Caption>
            min+gzip, ESM, peers excluded. Measured {BUNDLE_SIZES_MEASURED_ON}.
          </DocsTable.Caption>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">Entry</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col" numeric>
                Measured
              </DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col" numeric>
                Ceiling
              </DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col" numeric>
                Used
              </DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            {BUNDLE_SIZES.map((entry) => (
              <tr key={entry.name}>
                <DocsTable.BodyCell>
                  <code>{entry.name === "." ? "@elmeragroup/fuse" : `@elmeragroup/fuse/${entry.name}`}</code>
                </DocsTable.BodyCell>
                <DocsTable.BodyCell numeric>{kib(entry.measuredGzip)}</DocsTable.BodyCell>
                <DocsTable.BodyCell numeric>{kib(entry.ceilingGzip)}</DocsTable.BodyCell>
                <DocsTable.BodyCell numeric>{percent(ceilingUsage(entry))}</DocsTable.BodyCell>
              </tr>
            ))}
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>
      <p className={note()}>
        The flag SVG payload is gated separately, as a raw-byte aggregate ceiling rather than a measured
        JavaScript payload, and is never inlined.
      </p>
    </>
  );
}
