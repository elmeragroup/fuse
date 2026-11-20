/**
 * What the capture measures of a root's tree in Chromium, beyond its winning declarations: the facts
 * a capture keeps because they hold on any platform, read by a page function over DevTools.
 */
import type { CDPSession } from "playwright";

import type { MeasuredFacts } from "./capture-format.ts";
import { coincidingAround } from "./coinciding-around.ts";

/**
 * Measure a root's tree in the page and keep what holds on any platform, by each element's
 * element-ordinal path from the root, `""` for the root:
 *
 * - `containerWidth`, on the root: the content width of the element around it, where the root's
 *   margin box fills it, widening with it, and one more character of the root's text leaves it as it
 *   is, so CSS sets it and not the text. A positioned element with an auto width, as Base UI's
 *   positioner, shrinks to its content, so it is no such container.
 * - `widest`: in a root as wide as its own content, at its `min-width` or past it, the leaf row with
 *   text that fills its parent and whose own text is the widest, more than half a pixel wider than
 *   the next. That row's text sets the root's width once it outgrows the minimum, as a longer label
 *   does, so the build hugs it and keeps the minimum as its own (PH3).
 * - `oneLine`: an element under a `max-width` whose own text sits on one line, or a wrapping flex
 *   row whose items do.
 * - `underMaxHeight`: an element more than half a pixel under its `max-height`.
 * - `ellipsisFits`: an element that ends its one line of text in an ellipsis, `text-overflow:
 *   ellipsis` on a box that hides its overflow and keeps to one line, whose content box is at least
 *   a pixel wider than its first character and the ellipsis together. Chromium keeps the first
 *   character of a line however narrow the box and sets the ellipsis after it, both clipped at the
 *   box, so only a box that holds both draws what a Figma text that ends in an ellipsis draws.
 * - `coincidingAround`, on the root: how many of the elements around it, innermost first, lie
 *   exactly behind it, as {@link coincidingAround} decides from their boxes and the paint the page
 *   counts. An element's other child counts as reaching the root where its box or a box below it
 *   meets the root's box. Wherever they lie, it also counts where it or an element below it holds
 *   text, is SVG or MathML, is a list item with a marker, is replaced through `content`, hosts an
 *   open shadow root, generates a `::before` or `::after` box, or has a shadow, filter, backdrop
 *   filter, border image, reflection or outline. A replaced element or form control counts only
 *   where its box meets the root's. The element's own text, marker, `content`, open shadow root and
 *   generated box count as a child that reaches the root, and so do its inset shadow, border image
 *   and outline. The page checks this list and measures no paint, so paint it does not list, as a
 *   closed shadow root's, goes unseen. Issue #766 tracks measuring the fact from Chromium's pixels.
 * - `lineFits`: an element whose one element child is an inline-level box and which holds no text
 *   of its own, whose content box's top and bottom edges are the child's margin box's, within half
 *   a pixel, at its own line height and at 2px more. Matching edges leave no baseline offset, which
 *   moves the child down a line taller than a fixed-height box, and a line 2px taller grows the strut
 *   by 1px above and below (CSS 2.1 §10.8.1), so the line box adds nothing to the child by at least
 *   that margin. The second reading holds only where the page's computed line height took the 2px
 *   and the child kept its own.
 * - `trackFits`: a grid with one column, as wide as its content box, whose column at the grid's
 *   min-content width, with no `min-width` or `max-width` of its own, is at least
 *   {@link TRACK_CLEARANCE_PX} narrower than its column at the captured width. The items' least
 *   widths then fit inside the content box, so the `auto` column is the content box's width (CSS
 *   Grid 1 §11.5, §11.8), on both platforms the capture runs on.
 *
 * The page restores every element it changes before it returns.
 *
 * @param cdp - A DevTools session on the page.
 * @param nodeId - The root's node.
 * @returns Each element's facts, by its path from the root.
 */
export async function measuredFacts(
  cdp: CDPSession,
  nodeId: number
): Promise<ReadonlyMap<string, MeasuredFacts>> {
  const { object } = await cdp.send("DOM.resolveNode", { nodeId });
  if (object.objectId === undefined) {
    return new Map();
  }
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    functionDeclaration: MEASURE_IN_PAGE,
  });
  // SAFETY: the page function returns facts by path, as plain JSON.
  return new Map(Object.entries((result.value ?? {}) as Record<string, MeasuredFacts>));
}

/**
 * The least room, in CSS pixels, a one-column grid's column must keep past its items' least width
 * for the page to record `trackFits`. Chromium sets the same text a fraction of a pixel wider on one
 * platform than the other: on 2026-11-17 the same Roboto 600 24px words gave a grid a min-content
 * column of 140.859px on macOS and 141px in Playwright's Linux image. The page records the fact
 * only with a whole pixel to spare, the room `ellipsisFits` keeps for the same reason, so a grid
 * whose least width comes close to its column records nothing and the build leaves it unmapped. A
 * least width within the platforms' fraction of a pixel of that bound could still land on either
 * side, so `figma:capture --check` in the Linux image is what shows each kept capture agrees.
 */
const TRACK_CLEARANCE_PX = 1;

/** The page side of {@link measuredFacts}, called on the root. */
const MEASURE_IN_PAGE = `function () {
  const root = this;
  const out = {};
  const put = (path, key, value) => { (out[path] ??= {})[key] = value; };
  const contentWidth = (element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().width - ["padding-left", "padding-right", "border-left-width", "border-right-width"].reduce((sum, name) => sum + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
  };
  const texts = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const found = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim() !== "") { found.push(node); }
    }
    return found;
  };
  const withLonger = (element, read) => {
    const nodes = texts(element);
    const before = nodes.map((node) => node.textContent);
    nodes.forEach((node) => { node.textContent += "W"; });
    const value = read();
    nodes.forEach((node, index) => { node.textContent = before[index]; });
    return value;
  };
  const maxContent = (element) => {
    const style = element.getAttribute("style");
    element.style.width = "max-content";
    const width = element.getBoundingClientRect().width;
    if (style === null) { element.removeAttribute("style"); } else { element.setAttribute("style", style); }
    return width;
  };
  const elements = [];
  const walk = (element, path) => {
    elements.push({ element, path });
    if (element.localName === "svg") { return; }
    [...element.children].forEach((child, index) => walk(child, path === "" ? String(index) : path + "/" + String(index)));
  };
  walk(root, "");
  const parent = root.parentElement;
  const shrinks = (element) => ["absolute", "fixed"].includes(getComputedStyle(element).position);
  if (parent !== null && !shrinks(root) && !shrinks(parent)) {
    const before = contentWidth(parent);
    const style = parent.getAttribute("style");
    const width = root.getBoundingClientRect().width;
    parent.style.width = String(parent.getBoundingClientRect().width + 10) + "px";
    const follows = Math.abs(root.getBoundingClientRect().width - width - 10) <= 0.5;
    if (style === null) { parent.removeAttribute("style"); } else { parent.setAttribute("style", style); }
    const own = getComputedStyle(root);
    const margins = (Number.parseFloat(own.marginLeft) || 0) + (Number.parseFloat(own.marginRight) || 0);
    const fills = Math.abs(width + margins - before) <= 0.5 && follows;
    if (fills && withLonger(root, () => Math.abs(contentWidth(parent) - before) <= 0.01)) {
      put("", "containerWidth", Math.round(before * 100) / 100);
    }
  }
  const box = root.getBoundingClientRect();
  const rectOf = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  const clear = (color) => color === "transparent" || /[,/]\\s*0\\)$/.test(color);
  // Content an element draws whatever its box's paint says: a replaced element or form control, SVG
  // or MathML, a list item, an element its own content property replaces, an open shadow root's
  // tree, or a generated ::before or ::after box. Any of these counts as paint. \`draws\` is the part
  // of it whose paint the page does not bound by the element's box. A closed shadow root is unseen
  // here (issue #766).
  const REPLACED = new Set(["img", "video", "audio", "canvas", "iframe", "object", "embed", "picture", "input", "textarea", "select", "button", "meter", "progress", "math"]);
  const generates = (element) => ["::before", "::after"].some((pseudo) => !["none", "normal"].includes(getComputedStyle(element, pseudo).content));
  const marks = (style) => style.display.includes("list-item") && (style.listStyleType !== "none" || style.listStyleImage !== "none");
  const draws = (each) => {
    const style = getComputedStyle(each);
    return marks(style) || !["none", "normal"].includes(style.content) || each.shadowRoot !== null || generates(each);
  };
  const drawsContent = (each) => REPLACED.has(each.localName) || each.namespaceURI !== "http://www.w3.org/1999/xhtml" || getComputedStyle(each).display.includes("list-item") || draws(each);
  const paintsNothing = (element) => [element, ...element.querySelectorAll("*")].every((each) => {
    const style = getComputedStyle(each);
    const sides = ["top", "right", "bottom", "left"];
    return !drawsContent(each) && clear(style.backgroundColor) && style.backgroundImage === "none" && style.borderImageSource === "none" && style.boxShadow === "none" && style.backdropFilter === "none" &&
      sides.every((side) => style.getPropertyValue("border-" + side + "-style") === "none" || Number.parseFloat(style.getPropertyValue("border-" + side + "-width")) === 0) &&
      (style.outlineStyle === "none" || Number.parseFloat(style.outlineWidth) === 0) &&
      [...each.childNodes].every((node) => node.nodeType !== 3 || (node.textContent ?? "").trim() === "");
  });
  const overlapsRoot = (edges) => edges.left < box.right && edges.right > box.left && edges.top < box.bottom && edges.bottom > box.top;
  const meetsRoot = (rect) => rect.width > 0 && rect.height > 0 && overlapsRoot(rect);
  const ownText = (element) => [...element.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
  // Whether an element or an element below it counts as reaching the root's box. A box that meets
  // it counts, since a box can overflow its parent. Wherever it lies, so does text, SVG or MathML,
  // what \`draws\` lists, a shadow, a filter, a backdrop filter, a border image, a reflection or an
  // outline, since each can paint past the element's box (CSS Overflow 3 §2.2) by an amount the page
  // does not measure.
  const reaches = (element) => [element, ...element.querySelectorAll("*")].some((each) => {
    const style = getComputedStyle(each);
    return each.namespaceURI !== "http://www.w3.org/1999/xhtml" || draws(each) || ownText(each).length > 0 || style.boxShadow !== "none" || style.filter !== "none" || style.backdropFilter !== "none" ||
      style.borderImageSource !== "none" || style.webkitBoxReflect !== "none" ||
      (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) !== 0) ||
      meetsRoot(each.getBoundingClientRect());
  });
  const around = [];
  let below = root;
  for (let up = root.parentElement; up !== null && !up.hasAttribute("data-compare-cell"); up = up.parentElement) {
    const edges = up.getBoundingClientRect();
    const style = getComputedStyle(up);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const padding = { left: edges.left + px("border-left-width"), top: edges.top + px("border-top-width"), right: edges.right - px("border-right-width"), bottom: edges.bottom - px("border-bottom-width") };
    const others = [...up.children].filter((each) => each !== below).map((each) => {
      const nothing = paintsNothing(each);
      return { meets: !nothing && reaches(each), paintsNothing: nothing };
    });
    // The element's own text, its marker, content that replaces it, a shadow root and a generated
    // box count as a child over the root, and so does its own paint that can cover the padding box
    // behind the root: an inset shadow (CSS Backgrounds 3 §7.1), a border image wider than its
    // border, or an outline, which a negative offset draws inside the box.
    const ownPaint = style.boxShadow.includes("inset") || style.borderImageSource !== "none" || (style.outlineStyle !== "none" && px("outline-width") !== 0);
    const own = ownPaint || ownText(up).length > 0 || draws(up) ? [{ meets: true, paintsNothing: false }] : [];
    around.push({ padding, others: [...others, ...own] });
    below = up;
  }
  const coinciding = (${coincidingAround.toString()})(rectOf(box), around);
  if (coinciding > 0) { put("", "coincidingAround", coinciding); }
  const width = root.getBoundingClientRect().width;
  if (Math.abs(maxContent(root) - width) <= 0.5) {
    const rows = elements.filter(({ element }) => element !== root && element.hasAttribute("data-slot") && element.parentElement !== null && texts(element).length > 0 && Math.abs(element.getBoundingClientRect().width - contentWidth(element.parentElement)) <= 0.5);
    const leaves = rows.filter((row) => !rows.some((other) => other !== row && row.element.contains(other.element)));
    const widths = leaves.map(({ element, path }) => ({ path, width: maxContent(element) })).sort((left, right) => right.width - left.width);
    const [first, second] = widths;
    if (first !== undefined && (second === undefined || first.width - second.width > 0.5)) {
      put(first.path, "widest", true);
    }
  }
  for (const { element, path } of elements) {
    const style = getComputedStyle(element);
    const own = [...element.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
    const tracks = style.display.endsWith("grid") ? style.gridTemplateColumns.trim().split(/\\s+/) : [];
    if (tracks.length === 1) {
      const column = Number.parseFloat(tracks[0] ?? "");
      const saved = element.getAttribute("style");
      element.style.setProperty("width", "min-content", "important");
      element.style.setProperty("min-width", "0px", "important");
      element.style.setProperty("max-width", "none", "important");
      const least = Number.parseFloat(getComputedStyle(element).gridTemplateColumns);
      if (saved === null) { element.removeAttribute("style"); } else { element.setAttribute("style", saved); }
      if (Math.abs(column - contentWidth(element)) <= 0.5 && least + ${String(TRACK_CLEARANCE_PX)} <= column) { put(path, "trackFits", true); }
    }
    if (style.flexWrap.startsWith("wrap") && element.children.length > 1) {
      let bottom = -Infinity;
      let lines = 0;
      for (const child of [...element.children].map((each) => each.getBoundingClientRect()).sort((left, right) => left.top - right.top)) {
        if (child.top >= bottom - 0.5) { lines += 1; }
        bottom = Math.max(bottom, child.bottom);
      }
      if (lines === 1) { put(path, "oneLine", true); }
    } else if (own.length > 0 && style.maxWidth !== "none") {
      const tops = new Set();
      for (const node of own) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) { tops.add(Math.round(rect.top)); }
      }
      if (tops.size === 1) { put(path, "oneLine", true); }
    }
    const text = style.textOverflow === "ellipsis" && style.overflowX !== "visible" && (style.textWrapMode === "nowrap" || style.whiteSpace === "nowrap") ? (element.textContent ?? "").trim() : "";
    if (text !== "") {
      const [first] = new Intl.Segmenter().segment(text);
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      probe.textContent = (first?.segment ?? "") + "\u2026";
      element.append(probe);
      const need = probe.getBoundingClientRect().width;
      probe.remove();
      if (contentWidth(element) >= need + 1) { put(path, "ellipsisFits", true); }
    }
    if (style.maxHeight !== "none" && element.getBoundingClientRect().height + 0.5 < Number.parseFloat(style.maxHeight)) {
      put(path, "underMaxHeight", true);
    }
    const [child, ...others] = element.children;
    const line = Number.parseFloat(style.lineHeight);
    if (child !== undefined && others.length === 0 && own.length === 0 && getComputedStyle(child).display.startsWith("inline-") && Number.isFinite(line)) {
      const sum = (style, names) => names.reduce((total, name) => total + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
      const fits = () => {
        const box = element.getBoundingClientRect();
        const inner = getComputedStyle(element);
        const top = box.top + sum(inner, ["border-top-width", "padding-top"]);
        const bottom = box.bottom - sum(inner, ["border-bottom-width", "padding-bottom"]);
        const outer = getComputedStyle(child);
        const edges = child.getBoundingClientRect();
        return Math.abs(edges.top - sum(outer, ["margin-top"]) - top) <= 0.5 && Math.abs(edges.bottom + sum(outer, ["margin-bottom"]) - bottom) <= 0.5;
      };
      if (fits()) {
        const elementStyle = element.getAttribute("style");
        const childStyle = child.getAttribute("style");
        const childLine = getComputedStyle(child).lineHeight;
        child.style.setProperty("line-height", childLine, "important");
        element.style.setProperty("line-height", String(line + 2) + "px", "important");
        const applied = Math.abs(Number.parseFloat(getComputedStyle(element).lineHeight) - line - 2) <= 0.01 && getComputedStyle(child).lineHeight === childLine;
        const still = applied && fits();
        if (elementStyle === null) { element.removeAttribute("style"); } else { element.setAttribute("style", elementStyle); }
        if (childStyle === null) { child.removeAttribute("style"); } else { child.setAttribute("style", childStyle); }
        if (still) { put(path, "lineFits", true); }
      }
    }
  }
  return out;
}`;
