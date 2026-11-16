/**
 * Server-visible namespace for `Tour`. This module has no directive, so a server component reads
 * each part as a client reference instead of dotting into a client module.
 */

/**
 * Tours: a run of popups that point at parts of a page, one step at a time. `Tour.Provider` holds
 * the session, `Tour.Target` marks a step's element, and `Tour.Popup` shows the step on screen
 * with the parts inside it.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * Every later tour change follows the growth rule. A new capability becomes a new part, a hook, a
 * definition field or a Provider prop. It never becomes a boolean or mode prop on a part.
 *
 * @beta
 */
export * as Tour from "./tour-namespace-parts";
