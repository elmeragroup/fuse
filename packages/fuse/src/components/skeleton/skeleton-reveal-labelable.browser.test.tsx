/**
 * Unit under test: the labelable probe, against the installed Base UI. Oracle: Base UI's own
 * `useLabelableContext`, which a child reads under the probe's provider: it must see the probe's
 * scope, so the probe found the very context Base UI's Field parts read. This fails in CI the
 * moment a Base UI upgrade renders its labelable provider differently, where consumers would only
 * get the probe's fallback.
 */
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { describe, expect, it } from "vitest";

import { failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { useOwnLabelableScope } from "./skeleton-reveal-labelable";
import type { LabelableValue } from "./skeleton-reveal-labelable";

failOnResizeObserverLoop();

describe("useOwnLabelableScope", () => {
  it("finds Base UI's labelable context and a scope of its own in the installed Base UI", () => {
    function Reader({ own }: { own: LabelableValue }) {
      // The same object only if the probe's provider fills the context Base UI's parts read.
      return (
        <p>
          {useLabelableContext() === own ? "Base UI reads the probe's scope" : "Base UI reads another scope"}
        </p>
      );
    }
    function Probe() {
      const scope = useOwnLabelableScope();
      if (scope === null) return <p>No labelable context</p>;
      return (
        <scope.Provider value={scope.own}>
          <Reader own={scope.own} />
        </scope.Provider>
      );
    }
    const { host } = renderThemed(<Probe />);
    expect(host.textContent).toBe("Base UI reads the probe's scope");
  });
});
