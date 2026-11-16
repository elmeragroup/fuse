import type { ReactElement } from "react";

// A tour's server HTML and hydration, in Chromium and WebKit. Unit under test: `useTour`'s state and
// `Tour.Popup` from server HTML to the hydrated page. Oracles: the plan's SSR rule (the server and
// hydration answer a tour's status from `initialRecords`, every other tour "unknown", and no popup)
// and React's hydration contract, no recoverable error.
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { defineTour } from "./tour-definition";
import { Tour } from "./tour-namespace";
import { useTour } from "./tour-provider";
import type { TourRecords } from "./tour-records";
import { memoryTourStorage } from "./tour-storage";

const welcome = defineTour({ id: "welcome", steps: ["intro"], content: { intro: { title: "Welcome" } } });

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function State(): ReactElement {
  const tour = useTour(welcome);
  return <output aria-label="Tour state">{tour.state}</output>;
}

function Fixture({ records }: { readonly records: TourRecords | undefined }): ReactElement {
  return withLocale(
    "en-US",
    <Tour.Provider
      storage={memoryTourStorage({ welcome: { status: "completed", v: 1, at: 2 } })}
      initialRecords={records}>
      <State />
      <Tour.Popup tour={welcome}>
        <Tour.Title />
      </Tour.Popup>
    </Tour.Provider>
  );
}

/** The hydrated host and the recoverable errors hydration reported. */
type Hydrated = { readonly host: HTMLDivElement; readonly errors: unknown[] };

function serverThenHydrate(records: TourRecords | undefined): Hydrated {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<Fixture records={records} />);
  document.body.append(host);
  const errors: unknown[] = [];
  const root = hydrateRoot(host, <Fixture records={records} />, {
    onRecoverableError: (error) => {
      errors.push(error);
    },
  });
  cleanups.push(() => {
    root.unmount();
    host.remove();
  });
  return { host, errors };
}

describe("Tour hydration", () => {
  it("renders a finished tour's status from initialRecords on the server and hydrates without a mismatch", async () => {
    const records = { welcome: { status: "dismissed" as const, v: 1, at: 1 } };
    expect(renderToString(<Fixture records={records} />)).toContain(">dismissed<");
    const { errors } = serverThenHydrate(records);
    // Storage answers with a newer record that also has a status, and the newer one wins.
    await expect.element(page.getByRole("status", { name: "Tour state" })).toHaveTextContent("completed");
    expect(errors).toEqual([]);
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("renders unknown on the server without initialRecords, then the stored status once storage answers", async () => {
    expect(renderToString(<Fixture records={undefined} />)).toContain(">unknown<");
    const { errors } = serverThenHydrate(undefined);
    await expect.element(page.getByRole("status", { name: "Tour state" })).toHaveTextContent("completed");
    expect(errors).toEqual([]);
  });
});
