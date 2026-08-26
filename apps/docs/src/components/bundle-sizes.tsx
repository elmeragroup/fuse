import type { ReactElement } from "react";

import { BUNDLE_SIZES, BUNDLE_SIZES_MEASURED_ON } from "../generated/bundle-sizes";
import { ceilingUsage } from "../lib/docs-model";
import "./bundle-sizes.css";

const KIB = 1024;

function kib(bytes: number): string {
  return `${(bytes / KIB).toFixed(1)} kB`;
}

function percent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}

/**
 * The measured size of every published entry against the ceiling `size-limit` enforces
 * (performance.md §2). Both columns are generated from the library's budget module, so
 * the table cannot drift from the gate it describes.
 */
export function BundleSizes(): ReactElement {
  return (
    <>
      <div className="DocsTableWrap">
        <table className="DocsTable">
          <caption className="BundleCaption">
            min+gzip, ESM, peers excluded. Measured {BUNDLE_SIZES_MEASURED_ON}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Entry</th>
              <th scope="col" className="DocsNum">
                Measured
              </th>
              <th scope="col" className="DocsNum">
                Ceiling
              </th>
              <th scope="col" className="DocsNum">
                Used
              </th>
            </tr>
          </thead>
          <tbody>
            {BUNDLE_SIZES.map((entry) => (
              <tr key={entry.name}>
                <td>
                  <code>{entry.name === "." ? "@elmeragroup/ui" : `@elmeragroup/ui/${entry.name}`}</code>
                </td>
                <td className="DocsNum">{kib(entry.measuredGzip)}</td>
                <td className="DocsNum">{kib(entry.ceilingGzip)}</td>
                <td className="DocsNum">{percent(ceilingUsage(entry))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="BundleNote">
        The flag SVG payload is gated separately, as a raw-byte aggregate ceiling rather than a measured
        JavaScript payload, and is never inlined.
      </p>
    </>
  );
}
