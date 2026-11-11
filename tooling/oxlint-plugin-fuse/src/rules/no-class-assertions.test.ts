import { ruleTester } from "../rule-tester.ts";
import { noClassAssertions } from "./no-class-assertions.ts";

ruleTester.run("no-class-assertions", noClassAssertions, {
  valid: [
    // Finding 13: join converts each element as JavaScript does.
    'render(<Button className={["marker", 1].join("-")} />);\nexpect(button).toHaveClass("marker-1");',
    // Finding 14: a template part is computed with JavaScript semantics.
    'render(<Button className={`marker-${1 + 2}`} />);\nexpect(button).toHaveClass("marker-3");',
    // Finding 12 pair: a pattern and a string that both match supplied classes.
    'render(<Button className="marker" />);\nexpect(button).toHaveClass(flag ? /mark/ : "marker");',
    // T13: a numeric template part converts as a template does.
    'render(<Button className="marker-1" />);\nexpect(button).toHaveClass(`marker-${1}`);',
    // T14: the matcher's options object names no class.
    'render(<Button className="marker" />);\nexpect(button).toHaveClass("marker", { exact: true });',
    // T14: a pattern that matches a supplied class.
    'render(<Button className="marker-x" />);\nexpect(button).toHaveClass(/marker-/);',
    // T15: concat assembles statically.
    'render(<Button className="marker-x" />);\nexpect(button).toHaveClass("marker-".concat("x"));',
    // T15: an unlisted string method resolves to no string, so the call counts as a cross-check.
    'expect(button).toHaveClass("h-9".padStart(4));',
    // N3: a template the test supplies is assembled whole.
    'const id = "x";\nrender(<Button className={`marker-${id}`} />);\nexpect(button).toHaveClass("marker-x");',
    // T10: a classList held in a binding is still the receiver.
    'render(<Button className="marker" />);\nconst list = button.classList;\nexpect(list.contains("marker")).toBe(true);',
    // N3: a conditional or template class the test supplies matches itself.
    'render(<Button className={active ? "marker-a" : "marker-b"} />);\nexpect(button).toHaveClass(active ? "marker-a" : "marker-b");',
    'const id = "x";\nrender(<Button className={`marker-${id}`} />);\nexpect(button).toHaveClass(`marker-${id}`);',
    // N4: membership on the split class list asks about its argument, not `true`.
    'const marker = "m";\nrender(<Button className={marker} />);\nexpect(button.className.split(/\\s+/).includes(marker)).toBe(true);',
    // N9: hooks, tests and expect under a namespace import.
    'import * as vt from "vitest";\nvt.beforeEach(() => render(<Button className="marker" />));\nvt.it("forwards", () => {\n  vt.expect(button).toHaveClass("marker");\n});',
    // The consumer's class reaches the right part.
    'render(<TextareaField className="root-marker" />);\nexpect(root.classList.contains("root-marker")).toBe(true);',
    'render(<Select className="font-bold w-full" />);\nexpect(trigger()).toHaveClass("font-bold", "w-full");',
    // A part's own class prop supplies classes too.
    'render(<TextareaField textareaClassName="control-marker" />);\nexpect(area.classList.contains("control-marker")).toBe(true);',
    'render(<Link className={({ active }) => (active ? "is-active" : "")} />);\nexpect(link.classList.contains("is-active")).toBe(true);',
    'const props = { className: "logo" };\nrender(<BrandLogo {...props} />);\nexpect(img.className).toBe("logo");',
    'group.classList.add("compact");\nexpect(group.className.split(/\\s+/)).toContain("compact");',
    // T4: a class the test supplies through a binding.
    'const marker = "consumer-marker";\nrender(<Button className={marker} />);\nexpect(button).toHaveClass(marker);',
    // T6: a fixture the test calls supplies the class.
    'function renderMarked() {\n  render(<Button className="marker" />);\n}\nit("forwards", () => {\n  renderMarked();\n  expect(button()).toHaveClass("marker");\n});',
    // T6: a component the test renders by its JSX tag is a fixture it reaches.
    'function InlineMenu() {\n  return <Viewport className="viewport-extra" />;\n}\nit("forwards", () => {\n  render(<InlineMenu />);\n  expect(viewport.classList.contains("viewport-extra")).toBe(true);\n});',
    // Item 11: a setup hook of the test's suite supplies the class.
    'beforeEach(() => render(<Button className="marker" />));\nit("forwards", () => {\n  expect(button).toHaveClass("marker");\n});',
    'describe("menu", () => {\n  beforeEach(() => {\n    render(<Button className="marker" />);\n  });\n  it("forwards", () => {\n    expect(button).toHaveClass("marker");\n  });\n});',
    // Item 12: a props object's property is the class it holds.
    'const props = { className: "marker" };\nrender(<Button {...props} />);\nexpect(button).toHaveClass(props.className);',
    'const classes = ["marker", "other"];\nrender(<Button className={classes[0]} />);\nexpect(button).toHaveClass(classes[0]);',
    // A cross-check against the recipe the part forwards.
    'expect(button.className).toBe(buttonVariants({ size: "sm" }));',
    // Data whose field is called className is not an element.
    'expect(coverage.filter((row) => row.className === "flex-1")).toEqual([]);',
    'expect(getComputedStyle(trigger).fontWeight).toBe("700");',
  ],
  invalid: [
    // Finding 10: every membership an alternative asks about is checked.
    {
      code: 'render(<Button className="marker" />);\nconst list = button.classList;\nexpect(flag ? list.contains("marker") : list.contains("h-9")).toBe(true);',
      errors: [{ messageId: "pinned" }],
    },
    // Finding 11: an attribute name that may be "class" reads the classes.
    {
      code: 'expect(root.getAttribute(flag ? "id" : "class")).toBe("flex");',
      errors: [{ messageId: "pinned" }],
    },
    // Finding 11: toHaveAttribute with a name that may be "class".
    {
      code: 'expect(root).toHaveAttribute(flag ? "id" : "class", "flex");',
      errors: [{ messageId: "pinned" }],
    },
    // Finding 12: each alternative is classified: the pattern pins.
    {
      code: 'render(<Button className="marker" />);\nexpect(button).toHaveClass(flag ? /h-9/ : "marker");',
      errors: [{ messageId: "pinned" }],
    },
    // Finding 13: join maps over its receiver's alternatives.
    {
      code: 'render(<Button className="a" />);\nexpect(button).toHaveClass((flag ? ["a"] : ["h", "9"]).join("-"));',
      errors: [{ messageId: "pinned" }],
    },
    // Finding 7: a reused body must have the class supplied at every registration.
    {
      code: 'const body = () => {\n  expect(button).toHaveClass("marker");\n};\ndescribe("a", () => {\n  beforeEach(() => render(<Button className="marker" />));\n  it("x", body);\n});\ndescribe("b", () => {\n  it("y", body);\n});',
      errors: [{ messageId: "pinned" }],
    },
    // T14: a pattern that matches no supplied class pins the component's own.
    {
      code: 'render(<Button className="marker" />);\nexpect(button).toHaveClass(/h-\\d/);',
      errors: [{ messageId: "pinned", data: { token: "/h-\\d/" } }],
    },
    // T15: concat of an unsupplied class still pins it.
    {
      code: 'expect(button).toHaveClass("h-".concat("9"));',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // T10: the membership argument, not `true`, is the class.
    {
      code: 'const list = button.classList;\nexpect(list.contains("h-9")).toBe(true);',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // T6: an aliased global expect.
    {
      code: 'const check = expect;\ncheck(spinner.classList.contains("animate-spin")).toBe(true);',
      errors: [{ messageId: "pinned", data: { token: "animate-spin" } }],
    },
    // N9 pair: namespace expect is still an assertion, and an unsupplied class still pins.
    {
      code: 'import * as vt from "vitest";\nvt.it("pins", () => {\n  vt.expect(button).toHaveClass("h-9");\n});',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // N3 pair: a conditional with one arm the test never supplied.
    {
      code: 'render(<Button className={active ? "marker-a" : ""} />);\nexpect(button).toHaveClass(active ? "marker-a" : "h-9");',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // N4: membership on the split class list pins its argument.
    {
      code: 'expect(button.className.split(" ").includes("h-9")).toBe(true);',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    {
      code: 'expect(spinner.classList.contains("animate-spin")).toBe(true);',
      errors: [{ messageId: "pinned" }],
    },
    { code: 'await expect.element(group).toHaveClass("is-open");', errors: [{ messageId: "pinned" }] },
    { code: 'expect(calendar().className).toContain("min-w-40");', errors: [{ messageId: "pinned" }] },
    { code: 'expect(root.getAttribute("class")).toBe("flex gap-2");', errors: [{ messageId: "pinned" }] },
    { code: 'expect(root).toHaveAttribute("class", "sr-only");', errors: [{ messageId: "pinned" }] },
    { code: 'expect([...root.classList]).toEqual(["grid"]);', errors: [{ messageId: "pinned" }] },
    // One supplied class does not excuse a pinned one beside it.
    {
      code: 'render(<Button className="mine" />);\nexpect(button()).toHaveClass("mine", "h-9");',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // An empty class string pins that the component adds none.
    { code: 'expect(root.className).toBe("");', errors: [{ messageId: "pinned" }] },
    {
      code: 'const SPIN = "animate-spin";\nexpect(icon).toHaveClass(SPIN);',
      errors: [{ messageId: "pinned" }],
    },
    // T5: a class read held in a binding is still a class read.
    {
      code: 'const classes = button.className;\nexpect(classes).toContain("h-9");',
      errors: [{ messageId: "pinned" }],
    },
    {
      code: 'const { className } = button;\nexpect(className).toContain("h-9");',
      errors: [{ messageId: "pinned" }],
    },
    {
      code: 'const spins = icon.classList.contains("animate-spin");\nexpect(spins).toBe(true);',
      errors: [{ messageId: "pinned" }],
    },
    // T6: an assertion in a helper outside any test counts only its own function's classes.
    {
      code: 'function check() {\n  expect(button()).toHaveClass("h-9");\n}\nit("supplies", () => render(<Button className="h-9" />));\nit("pins", () => {\n  render(<Button />);\n  check();\n});',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    // Item 2: a call that only reshapes a literal still pins it.
    {
      code: 'expect(button).toHaveClass("h-9".trim());',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
    {
      code: 'const own = () => "h-9";\nexpect(button).toHaveClass(own());',
      errors: [{ messageId: "pinned" }],
    },
    // Item 3: an aliased expect still asserts.
    {
      code: 'import { expect as check } from "vitest";\ncheck(spinner.classList.contains("animate-spin")).toBe(true);',
      errors: [{ messageId: "pinned" }],
    },
    // Item 7: every value a poll callback returns is checked.
    {
      code: 'await expect.poll(() => (ready ? button.className : "")).toContain("h-9");',
      errors: [{ messageId: "pinned" }],
    },
    // Item 11: a sibling suite's hook does not run before this test.
    {
      code: 'describe("a", () => {\n  beforeEach(() => render(<Button className="marker" />));\n});\ndescribe("b", () => {\n  it("pins", () => {\n    expect(button).toHaveClass("marker");\n  });\n});',
      errors: [{ messageId: "pinned" }],
    },
    // T6: a class another test supplies does not excuse this one.
    {
      code: 'it("supplies", () => {\n  render(<Button className="h-9" />);\n});\nit("pins", () => {\n  expect(button()).toHaveClass("h-9");\n});',
      errors: [{ messageId: "pinned", data: { token: "h-9" } }],
    },
  ],
});
