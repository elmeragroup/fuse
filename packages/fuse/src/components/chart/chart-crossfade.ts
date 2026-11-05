"use client";

/**
 * The crossfade a mark plays when its drawing cannot tween, such as a path whose vertices lose their
 * pairing: the old drawing fades out over the new one in `CHART_CROSSFADE_MS`. A light leaf, so a
 * polar route crossfades without the cartesian path code.
 */
import { CHART_CROSSFADE_MS } from "./layout/motion";

/**
 * Fade a mark's old drawing out over its new one. The old drawing is a copy of the live node, or of
 * a copy the mark kept of how it last showed, which `redraw` puts back where it was, inside a
 * group React renders empty, and it leaves when its fade ends or a range step finishes it. The live
 * node fades in on the same clock.
 *
 * @param live - The node React and the loop draw into.
 * @param outgoing - The empty group the copy fades out in.
 * @param redraw - Writes the old drawing onto the copy.
 * @param source - What the copy starts from, the live node by default.
 */
export function crossfade(
  live: Element,
  outgoing: Element,
  redraw: (copy: Element) => void,
  source: Element = live
): void {
  for (const animation of live.getAnimations()) animation.finish();
  for (const old of outgoing.children) for (const animation of old.getAnimations()) animation.finish();
  outgoing.replaceChildren();
  const copy = source.cloneNode(true);
  if (!(copy instanceof Element)) return;
  copy.setAttribute("data-outgoing", "");
  redraw(copy);
  // The copy's clip paths and paint servers take ids of their own, so the live node keeps its own.
  const renamed = new Map<string, string>();
  for (const element of copy.querySelectorAll("[id]")) {
    renamed.set(element.id, `${element.id}-out`);
    element.id = `${element.id}-out`;
  }
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of ["clip-path", "mask", "fill", "stroke"]) {
      const reference = /^url\(#(.+)\)$/u.exec(element.getAttribute(name) ?? "")?.[1];
      const next = reference === undefined ? undefined : renamed.get(reference);
      if (next !== undefined) element.setAttribute(name, `url(#${next})`);
    }
  }
  outgoing.append(copy);
  const timing = { duration: CHART_CROSSFADE_MS, easing: "linear" } as const;
  const out = copy.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, fill: "forwards" });
  const leave = (): void => {
    copy.remove();
  };
  out.onfinish = leave;
  out.oncancel = leave;
  live.animate([{ opacity: 0 }, { opacity: 1 }], timing);
}
