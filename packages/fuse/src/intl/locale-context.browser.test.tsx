import { describe, expect, it } from "vitest";

import { render } from "../../test/browser-render";
import { LocaleProvider, useLocale } from "./locale-context";

function LocaleProbe() {
  try {
    // oxlint-disable-next-line react-hooks/rules-of-hooks -- probe asserts the provider's synchronous throw path; the hook never commits
    const { locale } = useLocale();
    // oxlint-disable-next-line react/error-boundaries -- the probe renders the thrown message directly; the hook throws during this render
    return <span>{locale}</span>;
  } catch (error) {
    return <span>{error instanceof Error ? error.message : "error"}</span>;
  }
}

describe("LocaleProvider", () => {
  it("returns the provided locale and throws outside the provider", () => {
    const { host, rerender } = render(<LocaleProbe />);
    expect(host.textContent).toBe("useLocale must be used within LocaleProvider");

    rerender(
      <LocaleProvider locale="nb-NO">
        <LocaleProbe />
      </LocaleProvider>
    );
    expect(host.textContent).toBe("nb-NO");
  });

  it("keeps the context value stable across rerenders with the same locale", () => {
    const seen: object[] = [];
    function StabilityProbe() {
      seen.push(useLocale());
      return null;
    }

    const { rerender } = render(
      <LocaleProvider locale="sv-SE">
        <StabilityProbe />
      </LocaleProvider>
    );
    rerender(
      <LocaleProvider locale="sv-SE">
        <StabilityProbe />
      </LocaleProvider>
    );
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});
