/**
 * The operation model in `plan.ts` against hand-written expectations: the order Apply performs
 * a plan in, the lines Plan lists, and that an error in the planning pass stops a run before
 * its first write. Each operation pushes onto a log, and the log is the record of what ran.
 */
import { describe, expect, it } from "vitest";

import {
  change,
  changeLines,
  changeTogether,
  create,
  existing,
  keepsOrder,
  newPlan,
  performPlan,
  precede,
  runPlan,
} from "./plan.ts";
import type { Target } from "./plan.ts";

describe("runPlan", () => {
  it("finishes the pass before the first write, then performs the operations in order", async () => {
    const log: string[] = [];
    const { plan } = await runPlan(true, (pass) => {
      change(pass, "Button", "height → 32", () => {
        log.push("write height");
      });
      log.push("plan the fill");
      change(pass, "Button", "fill → primary", () => {
        log.push("write fill");
      });
      return Promise.resolve();
    });
    expect(log).toEqual(["plan the fill", "write height", "write fill"]);
    expect(changeLines(plan)).toEqual(["Button: height → 32", "Button: fill → primary"]);
  });

  it("lists the same operations and writes nothing when the run only plans", async () => {
    const log: string[] = [];
    const { plan } = await runPlan(false, (pass) => {
      change(pass, "Button", "height → 32", () => {
        log.push("write height");
      });
      return Promise.resolve();
    });
    expect(log).toEqual([]);
    expect(changeLines(plan)).toEqual(["Button: height → 32"]);
  });

  it("writes nothing when the pass throws after it recorded operations", async () => {
    const log: string[] = [];
    const run = runPlan(true, (pass) => {
      change(pass, "Fuse components", "delete Old button", () => {
        log.push("delete");
      });
      return Promise.reject(new Error("Button holds 2 layers with the key button/label."));
    });
    await expect(run).rejects.toThrow("Button holds 2 layers with the key button/label.");
    expect(log).toEqual([]);
  });

  it("returns what the planner returned", async () => {
    const { result } = await runPlan(false, () => Promise.resolve("the page"));
    expect(result).toBe("the page");
  });
});

describe("changeTogether", () => {
  it("lists the group's changes on one line and runs finish after the group's writes", async () => {
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
    await performPlan(plan);
    expect(log).toEqual(["height", "counter axis", "both sizing modes"]);
  });

  it("records nothing, and never runs finish, when the group plans no write", async () => {
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
    await performPlan(plan);
    expect(plan.operations).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe("precede", () => {
  it("runs the step before each of the group's operations and keeps their lines", async () => {
    const log: string[] = [];
    const plan = newPlan();
    precede(
      plan,
      () => {
        log.push("load fonts");
        return Promise.resolve();
      },
      (group) => {
        change(group, "Label", "font → Roboto Medium", () => {
          log.push("font");
        });
        change(group, "Label", "fontSize → 14", () => {
          log.push("font size");
        });
      }
    );
    expect(changeLines(plan)).toEqual(["Label: font → Roboto Medium", "Label: fontSize → 14"]);
    await performPlan(plan);
    expect(log).toEqual(["load fonts", "font", "load fonts", "font size"]);
  });
});

describe("create", () => {
  it("lists a new node once, and configures it when the operation runs", async () => {
    const log: string[] = [];
    const plan = newPlan();
    const preview = create(
      plan,
      "Fuse components",
      "create the preview Dark",
      () => {
        log.push("make");
        return { name: "Dark" };
      },
      (made, inner) => {
        log.push("plan the new node");
        change(inner, made.name, "layoutMode → HORIZONTAL", () => {
          log.push(`lay out ${made.name}`);
        });
      }
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
    await performPlan(plan);
    expect(log).toEqual(["make", "plan the new node", "lay out Dark", "stack Dark"]);
  });

  it("refuses to hand out the node before the operation that makes it has run", () => {
    const preview = create(newPlan(), "Fuse components", "create the preview Dark", () => ({ name: "Dark" }));
    expect(() => preview.get()).toThrow(/before that ran/);
  });
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
