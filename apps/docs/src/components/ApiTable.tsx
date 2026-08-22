import type { ReactElement } from "react";

import type { ApiPart } from "../lib/docs-model";
import { propDescription } from "../lib/docs-model";
import "./ApiTable.css";
import { InlineCode } from "./InlineCode";

export type ApiTableProps = {
  part: ApiPart;
  /** Anchor id, so the on-page TOC can link straight to this part. */
  id: string;
};

/**
 * One generated API table per compound part (docs-site.md §8). Every row carries the
 * part's RSC status, which is public contract and surfaced mechanically rather than
 * editorially (performance.md §3).
 */
export function ApiTable({ part, id }: ApiTableProps): ReactElement {
  return (
    <section className="ApiTable" aria-labelledby={id}>
      <h3 id={id}>
        <code>{part.name}</code>
      </h3>
      {part.props.length === 0 ? (
        <p className="ApiTableNote">Every prop is forwarded to the underlying part.</p>
      ) : (
        <div className="ApiTableScroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Prop</th>
                <th scope="col">Type</th>
                <th scope="col">Default</th>
                <th scope="col">RSC</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {part.props.map((prop) => (
                <tr key={prop.name}>
                  <th scope="row">
                    <code>{prop.name}</code>
                    {prop.required ? <span className="ApiTableRequired">required</span> : null}
                  </th>
                  <td>
                    <code className="ApiTableType">{prop.type}</code>
                  </td>
                  <td>{prop.defaultValue === null ? "—" : <code>{prop.defaultValue}</code>}</td>
                  <td className="ApiTableRsc">{part.rsc}</td>
                  <td>
                    <InlineCode text={propDescription(prop)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {part.forwardedCount > 0 ? (
        <p className="ApiTableNote">
          Plus {part.forwardedCount} forwarded props from {part.forwardedFrom.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
