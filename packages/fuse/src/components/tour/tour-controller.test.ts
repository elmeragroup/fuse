// Unit under test: how the tour controller takes a consumer storage's answers. Oracle: the
// `TourStorage` contract that the built-in adapters keep, where an answer that is not an object
// means no records. A JavaScript backend may hand back `null` or `undefined`, and the tour must
// neither stall nor end a run for it.
import { describe, expect, it } from "vitest";

import { createTourController } from "./tour-controller";
import type { TourEvent } from "./tour-controller";
import { defineTour } from "./tour-definition";
import type { TourRecords } from "./tour-records";
import { tourStateOf } from "./tour-session";

const welcome = defineTour({
  id: "welcome",
  steps: ["intro"],
  content: { intro: { title: "Welcome", placement: "center" } },
});

/** What a JSON backend answers for a user with no saved tours. */
function nothing(): TourRecords {
  // SAFETY: the test plays a JavaScript consumer whose backend breaks the declared type.
  return null as never;
}

describe("createTourController", () => {
  it("treats a storage read that answers null as no records, so the session becomes ready", () => {
    const controller = createTourController({
      storage: { read: nothing, write: () => undefined },
      initialRecords: undefined,
    });
    controller.connect();
    expect(controller.store.get().ready).toBe(true);
    expect(tourStateOf(controller.store.get(), welcome.id)).toBe("idle");
  });

  it("keeps a live run going when the storage's subscription delivers a non-object", () => {
    let notify = (_records: TourRecords): void => undefined;
    const events: TourEvent[] = [];
    const controller = createTourController({
      storage: {
        read: () => ({}),
        write: () => undefined,
        subscribe: (listener) => {
          notify = listener;
          return () => undefined;
        },
      },
      initialRecords: undefined,
    });
    controller.configure({
      onEvent: (event) => events.push(event),
      onError: () => undefined,
      autoStartCooldownMs: 0,
      reducedMotion: () => false,
    });
    controller.connect();
    controller.start(welcome, { origin: "user" });
    expect(controller.store.get().shown?.stepId).toBe("intro");
    notify(nothing());
    expect(controller.store.get().shown?.stepId).toBe("intro");
    expect(events.map((event) => event.type)).not.toContain("end");
  });
});
