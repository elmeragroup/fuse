import { ruleTester } from "../rule-tester.ts";
import { noDataSlotSelector } from "./no-data-slot-selector.ts";

const error = [{ messageId: "dataSlot" }];

ruleTester.run("no-data-slot-selector", noDataSlotSelector, {
  valid: [
    'root.querySelector("[data-date-segment]");',
    // A test may find what it checks by slot.
    { code: 'root.querySelectorAll("[data-slot=option]");', filename: "listbox.test.jsx" },
    'element.closest("[data-slot-id=x]");',
    'element.getAttribute("data-slot");',
    'element.matches(".data-slot");',
    'const className = "[data-slot=card]:p-4";',
    '<div data-slot="card" className="*:data-[slot=title]:font-medium" />;',
    'const slot = "[data-slot=x]";\nfunction find(slot: string) { return root.querySelector(slot); }',
    'let selector = "[data-slot=x]";\nselector = ".row";\nroot.querySelector(selector);',
    'root.querySelector(`[data-index="${index}"]`);',
    'slots.find("[data-slot=x]");',
    'const mover = (name: string) => `:scope > [data-part="${name}"]`;\nglide.querySelector(mover("dot"));',
    'const CONTROLS = ["button", "[role=slider]"].join(",");\nelement.closest(CONTROLS);',
    "const select = (): string => select();\nroot.querySelector(select());",
    "root.querySelector('[data-label=\"[data-slot=x]\"]');",
    "root.querySelector(\"[title='[data-slot]']\");",
    String.raw`root.querySelectorAll(".\\[\\&_\\[data-slot\\]\\]\\:p-4");`,
    'const suffix = "-id";\nroot.querySelector(`[data-slot${suffix}=x]`);',
    "function find(suffix: string) {\n  return root.querySelector(`[data-slot${suffix}=x]`);\n}",
    // A text of more than 64 runs and gaps is unknown, however it reads.
    "function find(id: string) {\n  const s0 = `[data-slot=${id}]`;\n  const s1 = `${s0}${s0}`;\n  const s2 = `${s1}${s1}`;\n  const s3 = `${s2}${s2}`;\n  const s4 = `${s3}${s3}`;\n  const s5 = `${s4}${s4}`;\n  return root.querySelector(s5);\n}",
  ],
  invalid: [
    { code: 'root.querySelector("[data-slot=chart-dot]");', errors: error },
    { code: "root.querySelector('[data-slot=\"select-value\"]');", errors: error },
    { code: 'root.querySelectorAll("[data-slot$=\\"label\\"]");', errors: error },
    { code: 'element.closest("[data-slot]");', errors: error },
    { code: 'element.matches(":not([DATA-SLOT=x])");', errors: error },
    { code: 'root?.querySelector<HTMLElement>("[data-slot=x]");', errors: error },
    { code: 'document.querySelector?.("[data-slot~=x]");', errors: error },
    {
      code: 'const GHOST_SLOT = "chart-ghost";\nroot.querySelectorAll(`:scope > [data-slot="${GHOST_SLOT}"]`);',
      errors: error,
    },
    { code: "root.querySelector(`[data-slot=${slot}] input`);", errors: error },
    { code: 'const SELECTOR = "[data-slot=chart-dot]";\nroot.querySelectorAll(SELECTOR);', errors: error },
    {
      code: 'const ITEM = `[data-slot="item"]`;\nconst SELECTOR = `${ITEM}, [role=row]`;\nroot.querySelector(SELECTOR);',
      errors: error,
    },
    { code: 'root.querySelector("[data-" + "slot=cell]");', errors: error },
    { code: 'element.closest("[ data-slot ]");', errors: error },
    { code: 'root.querySelector(open ? "[data-slot=a]" : ".b");', errors: error },
    { code: 'root.querySelector(("[data-slot=x]" as const));', errors: error },
    {
      code: 'const OWN = "button";\nconst INTERACTIVE = [OWN, "[role=slider]", "[data-slot=slider-control]"].join(",");\nelement.closest(INTERACTIVE);',
      errors: error,
    },
    {
      code: 'const slot = ({ "data-slot": name }: { readonly "data-slot": string }) => `[data-slot="${name}"]`;\nconst GLIDE = slot(PARTS.glide);\nsvg.querySelector(GLIDE);',
      errors: error,
    },
    {
      code: 'function slotSelector(name: string) {\n  if (name === "") return "*";\n  return `[data-slot=${name}]`;\n}\nroot.querySelector(slotSelector("x"));',
      errors: error,
    },
    {
      code: 'const SELECTORS = { dot: "[data-slot=chart-dot]" } as const;\nroot.querySelector(SELECTORS.dot);',
      errors: error,
    },
    { code: 'const ATTRIBUTE = "data-slot";\nroot.querySelector(`[${ATTRIBUTE}=x]`);', errors: error },
    {
      code: 'const ATTR = "data-slot";\nfunction find(value: string) {\n  return root.querySelector(`[${ATTR}="${CSS.escape(value)}"]`);\n}',
      errors: error,
    },
    {
      code: "function find(id: string) {\n  const SELECTORS = { cell: `[data-slot=${id}]` };\n  return root.querySelector(SELECTORS.cell);\n}",
      errors: error,
    },
    {
      code: 'const slotSelector = (name: string) => `[data-slot="${name}"]`;\nconst select = slotSelector;\nroot.querySelector(select(part));',
      errors: error,
    },
    {
      code: 'function find(id: string) {\n  return root.querySelector("[data-slot=" + id + "]");\n}',
      errors: error,
    },
    {
      code: 'function find(id: string) {\n  return root.querySelector("[data-slot=".concat(id, "]"));\n}',
      errors: error,
    },
    {
      code: 'function find(id: string) {\n  return element.closest(["button", `[data-slot=${id}]`].join(","));\n}',
      errors: error,
    },
    {
      code: 'function find(root: Element, baseSelectors: string[]) {\n  return root.querySelectorAll([...baseSelectors, "[data-slot=item]"].join(", "));\n}',
      errors: error,
    },
    {
      code: 'function find(root: Element, extraSelectors: string[]) {\n  return root.querySelectorAll(["[data-slot=item]", ...extraSelectors].join(", "));\n}',
      errors: error,
    },
    // The separator after an element always lands, whatever the spread after it holds.
    {
      code: 'function find(root: Element, predicate: string[]) {\n  return root.querySelector(["[data-slot", ...predicate, "]"].join(" "));\n}',
      errors: error,
    },
  ],
});
