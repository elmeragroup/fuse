/**
 * What `overrides` lists after a corner or a padding changes on an instance in the in-memory file,
 * rule 37. Unit under test: the fake in `fake-figma.ts`. Oracle: probes CR1, CR4 and CR6, read
 * through the Plugin API on a scratch file on 2026-11-21, on instances of a hugging auto layout
 * component 36px tall with a 1px solid stroke and every corner bound to a 10px variable. Each case replays one probe's writes and expects what the real file read.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";

/** A FLOAT variable of the file's one collection, by name. */
function float(name: string, value: number) {
  return {
    name,
    type: "FLOAT",
    scopes: [],
    webSyntax: undefined,
    description: "",
    values: new Map([["Mode 1", { _tag: "Float", value } as const]]),
  } as const;
}

/** The probe's main and its variables: `radius-button` 10, `radius-md` 6 and `pad` 5. */
async function probeFile() {
  const { figma } = createFakeFigma({
    collections: [
      {
        name: "Probe radii",
        modes: ["Mode 1"],
        variables: [float("radius-button", 10), float("radius-md", 6), float("pad", 5)],
      },
    ],
  });
  const variables = new Map(
    (await figma.variables.getLocalVariablesAsync("FLOAT")).map((variable) => [variable.name, variable])
  );
  const variable = (name: string): Variable => {
    const found = variables.get(name);
    if (found === undefined) {
      throw new Error(`The probe file holds no ${name}.`);
    }
    return found;
  };
  const main = figma.createComponent();
  main.layoutMode = "HORIZONTAL";
  main.resize(80, 36);
  main.strokes = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  main.strokeWeight = 1;
  for (const corner of [
    "topLeftRadius",
    "topRightRadius",
    "bottomRightRadius",
    "bottomLeftRadius",
  ] as const) {
    main.setBoundVariable(corner, variable("radius-button"));
  }
  return { figma, main, variable };
}

/** The fields `overrides` lists on the instance itself, sorted as the probe read them. */
function listed(instance: InstanceNode): readonly string[] {
  return (instance.overrides.find((override) => override.id === instance.id)?.overriddenFields ?? []).sort();
}

describe("what an instance lists after a number changes", () => {
  it("lists a corner written as a literal under its name, beside its main's binding (CR1)", async () => {
    const { main } = await probeFile();
    const instance = main.createInstance();
    instance.topLeftRadius = 0;
    expect(listed(instance)).toEqual(["boundVariables", "topLeftRadius"]);
  });

  it("lists a corner bound to another variable as `boundVariables` alone (CR1)", async () => {
    const { main, variable } = await probeFile();
    const instance = main.createInstance();
    instance.setBoundVariable("topLeftRadius", variable("radius-md"));
    expect(listed(instance)).toEqual(["boundVariables"]);
  });

  it("lists a whole corner write as every corner and `cornerRadius` (CR4)", async () => {
    const { main } = await probeFile();
    const instance = main.createInstance();
    instance.cornerRadius = 2;
    expect(listed(instance)).toEqual([
      "bottomLeftRadius",
      "bottomRightRadius",
      "boundVariables",
      "cornerRadius",
      "topLeftRadius",
      "topRightRadius",
    ]);
  });

  it("lists an unbound corner under its name (CR4)", async () => {
    const { main } = await probeFile();
    const instance = main.createInstance();
    instance.setBoundVariable("topRightRadius", null);
    expect(listed(instance)).toEqual(["boundVariables", "topRightRadius"]);
  });

  it("lists a bound padding as `boundVariables` alone (CR6)", async () => {
    const { main, variable } = await probeFile();
    const instance = main.createInstance();
    instance.setBoundVariable("paddingLeft", variable("pad"));
    expect([listed(instance), instance.paddingLeft]).toEqual([["boundVariables"], 5]);
  });
});
