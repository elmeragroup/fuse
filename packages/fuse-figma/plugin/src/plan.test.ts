/**
 * The operation model in `plan.ts` against hand-written expectations: the order Apply performs
 * a plan in, the lines Plan lists, and that an error in the planning pass or in a requirement
 * stops a run before its first write. Each operation and requirement pushes onto a log, and
 * the log is the record of what ran.
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  change,
  changeLines,
  changeTogether,
  create,
  existing,
  keepsOrder,
  newPlan,
  performPlan,
  Plan,
  planWhenRun,
  requirement,
  runPlan,
} from "./plan.ts";
import type { PlanRecorder, Target } from "./plan.ts";

/** Record into the current recorder, as a leaf planner does with the recorder its run holds. */
const record = (planner: (pass: PlanRecorder) => void): Effect.Effect<void, never, Plan> =>
  Effect.map(Plan, planner);

describe("runPlan", () => {
  it.effect("finishes the pass before the first write, then performs the operations in order", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      const { plan } = yield* runPlan(
        true,
        record((pass) => {
          change(pass, "Button", "height → 32", () => {
            log.push("write height");
          });
          log.push("plan the fill");
          change(pass, "Button", "fill → primary", () => {
            log.push("write fill");
          });
        })
      );
      expect(log).toEqual(["plan the fill", "write height", "write fill"]);
      expect(changeLines(plan)).toEqual(["Button: height → 32", "Button: fill → primary"]);
    })
  );

  it.effect("lists the same operations and writes nothing when the run only plans", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      const { plan } = yield* runPlan(
        false,
        record((pass) => {
          change(pass, "Button", "height → 32", () => {
            log.push("write height");
          });
        })
      );
      expect(log).toEqual([]);
      expect(changeLines(plan)).toEqual(["Button: height → 32"]);
    })
  );

  it("writes nothing when the pass throws after it recorded operations", async () => {
    const log: string[] = [];
    const run = runPlan(
      true,
      record((pass) => {
        change(pass, "Fuse components", "delete Old button", () => {
          log.push("delete");
        });
        throw new Error("Button holds 2 layers with the key button/label.");
      })
    );
    await expect(Effect.runPromise(run)).rejects.toThrow("Button holds 2 layers with the key button/label.");
    expect(log).toEqual([]);
  });

  it.effect("meets each requirement once, before the first write", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      yield* runPlan(
        true,
        record((pass) => {
          change(pass, "Label", "font → Roboto Medium", () => {
            log.push("write font");
          });
          for (const key of ["Roboto Medium", "Inter Regular", "Roboto Medium"]) {
            requirement(
              pass,
              key,
              Effect.sync(() => {
                log.push(`load ${key}`);
              })
            );
          }
        })
      );
      expect(log).toEqual(["load Roboto Medium", "load Inter Regular", "write font"]);
    })
  );

  it("writes nothing, and fails a plan too, when a requirement cannot be met", async () => {
    const log: string[] = [];
    const planner = record((pass) => {
      change(pass, "Fuse components", "delete Old button", () => {
        log.push("delete");
      });
      requirement(pass, "Comic Sans Bold", Effect.die(new Error("Comic Sans Bold is not installed.")));
    });
    await expect(Effect.runPromise(runPlan(true, planner))).rejects.toThrow(
      "Comic Sans Bold is not installed."
    );
    await expect(Effect.runPromise(runPlan(false, planner))).rejects.toThrow(
      "Comic Sans Bold is not installed."
    );
    expect(log).toEqual([]);
  });

  it.effect("returns what the planner returned", () =>
    Effect.gen(function* () {
      const { result } = yield* runPlan(false, Effect.succeed("the page"));
      expect(result).toBe("the page");
    })
  );
});

describe("changeTogether", () => {
  it.effect("lists the group's changes on one line and runs finish after the group's writes", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      const plan = newPlan();
      changeTogether(
        plan,
        "Button",
        (group) => {
          change(group, "Button", "height → 32", () => {
            log.push("height");
          });
          change(group, "Button", "counterAxisSizingMode → FIXED", () => {
            log.push("counter axis");
          });
        },
        () => {
          log.push("both sizing modes");
        }
      );
      expect(changeLines(plan)).toEqual(["Button: height → 32, counterAxisSizingMode → FIXED"]);
      yield* performPlan(plan);
      expect(log).toEqual(["height", "counter axis", "both sizing modes"]);
    })
  );

  it.effect("records nothing, and never runs finish, when the group plans no write", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      const plan = newPlan();
      changeTogether(
        plan,
        "Button",
        () => undefined,
        () => {
          log.push("both sizing modes");
        }
      );
      yield* performPlan(plan);
      expect(plan.operations).toEqual([]);
      expect(log).toEqual([]);
    })
  );
});

describe("create", () => {
  it.effect("lists a new node once, and configures it when the operation runs", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      const plan = newPlan();
      const preview = yield* Effect.provideService(
        create(
          "Fuse components",
          "create the preview Dark",
          () => {
            log.push("make");
            return { name: "Dark" };
          },
          (made) =>
            record((inner) => {
              log.push("plan the new node");
              change(inner, made.name, "layoutMode → HORIZONTAL", () => {
                log.push(`lay out ${made.name}`);
              });
            })
        ),
        Plan,
        plan
      );
      change(plan, "Fuse components", "stack 1 previews below the component sets", () => {
        log.push(`stack ${preview.get().name}`);
      });

      expect(changeLines(plan)).toEqual([
        "Fuse components: create the preview Dark",
        "Fuse components: stack 1 previews below the component sets",
      ]);
      expect(preview.existing).toBeUndefined();
      expect(log).toEqual([]);
      yield* performPlan(plan);
      expect(log).toEqual(["make", "plan the new node", "lay out Dark", "stack Dark"]);
    })
  );

  it.effect("plans a new node's contents against the run's requirements, met before the first write", () =>
    Effect.gen(function* () {
      const log: string[] = [];
      yield* runPlan(
        true,
        Effect.gen(function* () {
          yield* record((pass) => {
            requirement(
              pass,
              "font Roboto Medium",
              Effect.sync(() => {
                log.push("load Roboto Medium");
              })
            );
          });
          yield* create(
            "Button",
            "create the text layer Label",
            () => {
              log.push("make");
              return { name: "Label" };
            },
            (made) =>
              record((inner) => {
                requirement(
                  inner,
                  "font Roboto Medium",
                  Effect.sync(() => {
                    log.push("load Roboto Medium again");
                  })
                );
                change(inner, made.name, "font → Roboto Medium", () => {
                  log.push("write font");
                });
              })
          );
        })
      );
      expect(log).toEqual(["load Roboto Medium", "make", "write font"]);
    })
  );

  it("stops a new node's contents at a requirement the pass did not prepare", async () => {
    const log: string[] = [];
    const run = runPlan(
      true,
      create(
        "Button",
        "create the text layer Label",
        () => {
          log.push("make");
          return { name: "Label" };
        },
        (made) =>
          record((inner) => {
            requirement(
              inner,
              "font Comic Sans Bold",
              Effect.sync(() => {
                log.push("load Comic Sans Bold");
              })
            );
            change(inner, made.name, "font → Comic Sans Bold", () => {
              log.push("write font");
            });
          })
      )
    );
    await expect(Effect.runPromise(run)).rejects.toThrow(
      "The run needs font Comic Sans Bold, which its planning pass did not prepare"
    );
    expect(log).toEqual(["make"]);
  });

  it.effect("refuses to hand out the node before the operation that makes it has run", () =>
    Effect.gen(function* () {
      const preview = yield* Effect.provideService(
        create("Fuse components", "create the preview Dark", () => ({ name: "Dark" })),
        Plan,
        newPlan()
      );
      expect(() => preview.get()).toThrow(/before that ran/);
    })
  );
});

describe("Plan.watch", () => {
  it.effect("reports whether an effect recorded into the current recorder, and not into a nested one", () =>
    Effect.gen(function* () {
      const writes: string[] = [];
      const plan = newPlan();
      const watched = <A, E>(planner: Effect.Effect<A, E, Plan>) =>
        Effect.provideService(Plan.watch(planner), Plan, plan);
      const [, nothing] = yield* watched(Effect.void);
      const [, nested] = yield* watched(
        planWhenRun(
          record((inner) => change(inner, "Dark", "layoutMode → HORIZONTAL", () => writes.push("nested")))
        )
      );
      const [result, recorded] = yield* watched(
        Effect.as(
          record((pass) => change(pass, "Button", "height → 32", () => writes.push("height"))),
          "the page"
        )
      );
      expect([nothing, nested, recorded, result, writes, changeLines(plan)]).toEqual([
        false,
        false,
        true,
        "the page",
        ["nested"],
        ["Button: height → 32"],
      ]);
    })
  );
});

describe("keepsOrder", () => {
  const made = (name: string): Target<string> => ({ existing: undefined, get: () => name });

  it("accepts owned children in spec order, with a foreign child between them", () => {
    expect(keepsOrder(["icon", "note", "label"], [existing("icon"), existing("label")])).toBe(true);
  });

  it("rejects owned children out of spec order", () => {
    expect(keepsOrder(["label", "icon"], [existing("icon"), existing("label")])).toBe(false);
  });

  it("places a created child after every child the parent holds", () => {
    expect(keepsOrder(["icon", "label"], [existing("icon"), existing("label"), made("badge")])).toBe(true);
    expect(keepsOrder(["icon", "label"], [existing("icon"), made("badge"), existing("label")])).toBe(false);
  });

  it("places created children in the order their operations run", () => {
    expect(keepsOrder([], [made("icon"), made("label")])).toBe(true);
  });
});
