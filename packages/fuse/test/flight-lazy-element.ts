import type { ReactElement } from "react";

/** React Flight's lazy node for an element that a Server Component passes to a client one. */
type FlightLazyNode = {
  readonly $$typeof: symbol;
  readonly _payload: ReactElement;
  readonly _init: (payload: ReactElement) => ReactElement;
};

/**
 * Wraps an element the way React Flight passes it to a client component's render prop. React's
 * children utilities unwrap it through `_init(_payload)`.
 */
export function flightLazyElement(element: ReactElement): ReactElement {
  const node: FlightLazyNode = {
    $$typeof: Symbol.for("react.lazy"),
    _payload: element,
    _init: (payload) => payload,
  };
  // SAFETY: React's public types have no lazy node, though React renders one wherever it renders
  // an element. Base UI's render prop unwraps it, and Flight produces this shape.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a lazy node shares no key with ReactElement's type, so TypeScript rejects a single assertion; this fixture imitates React Flight's output
  return node as unknown as ReactElement;
}
