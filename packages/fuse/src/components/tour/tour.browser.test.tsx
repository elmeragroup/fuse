// Unit under test: the tour's React layer, from `Tour.Provider` through `Tour.Popup` and its parts,
// against a real page. Oracles: the plan's Persistence rules (Done on the last step, Skip, Close and
// Escape write a status; an outside press and an error do not), Base UI's labeled dialog contract,
// the plain-HTML attribute's whole-entry match, and the re-render rule that only the parts whose
// answer changes render during a run.
import { Profiler, createRef, useLayoutEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { createPortal } from "react-dom";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, recordFrames } from "../../../test/animation-frames";
import { withLocale } from "../../../test/locale-matrix";
import {
  overlayBackdropOf,
  renderThemed as renderThemedTree,
  roleNamed,
} from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { Tooltip } from "../tooltip";
import type { TourEvent } from "./tour-controller";
import { defineTour } from "./tour-definition";
import type { TourDefinition } from "./tour-definition";
import type { TourError } from "./tour-error";
import { Tour } from "./tour-namespace";
import { useAutoStartTour, useTour, useTourStep, useTourStepDone } from "./tour-provider";
import type { TourRecords } from "./tour-records";
import { localTourStorage, memoryTourStorage, remoteTourStorage } from "./tour-storage";
import type { TourStorage } from "./tour-storage";

const welcome = defineTour({
  id: "welcome",
  steps: ["intro", "usage", "price"],
  targetTimeoutMs: 100,
  content: { intro: { title: "Welcome", description: "A short look around.", placement: "center" } },
});

function Starter({ tour, label = "Take the tour" }: { tour: TourDefinition; label?: string }): ReactElement {
  const handle = useTour(tour);
  return (
    <>
      <Button variant="outline" onClick={() => handle.start()}>
        {label}
      </Button>
      <output aria-label={`${tour.id} state`}>{handle.state}</output>
    </>
  );
}

function PriceButton(): ReactElement {
  const { ref } = useTourStep(welcome, "price", { title: "Price", description: "What you pay per kWh." });
  return (
    <button type="button" ref={ref}>
      Price
    </button>
  );
}

function StepPopup({ tour, children }: { tour: TourDefinition; children?: ReactNode }): ReactElement {
  return (
    <Tour.Popup tour={tour}>
      <Tour.Header>
        <Tour.Progress />
        <Tour.Close />
      </Tour.Header>
      <Tour.Title>{children}</Tour.Title>
      <Tour.Description />
      <Tour.Footer>
        <Tour.Skip />
        <Tour.Prev />
        <Tour.Next />
      </Tour.Footer>
    </Tour.Popup>
  );
}

type FixtureOptions = {
  readonly storage?: TourStorage;
  readonly onEvent?: (event: TourEvent) => void;
  readonly onError?: (error: TourError) => void;
  readonly initialRecords?: TourRecords;
  readonly children?: ReactNode;
};

function renderWelcome({ storage = memoryTourStorage(), children, ...props }: FixtureOptions = {}) {
  renderThemed(
    <Tour.Provider storage={storage} {...props}>
      <Starter tour={welcome} />
      <Tour.Target tour={welcome} step="usage" title="Usage" description="Your usage this month.">
        Usage card
      </Tour.Target>
      <PriceButton />
      <StepPopup tour={welcome} />
      {children}
    </Tour.Provider>
  );
  return storage;
}

async function dialogNamed(name: string): Promise<HTMLElement> {
  await expect.element(page.getByRole("dialog", { name })).toBeVisible();
  return roleNamed("dialog", name);
}

async function expectNoDialog(): Promise<void> {
  await vi.waitFor(() => {
    expect(page.getByRole("dialog").query()).toBeNull();
  });
}

async function recordsOf(storage: TourStorage): Promise<TourRecords> {
  return storage.read();
}

afterEach(() => {
  localStorage.clear();
});

function renderThemed(node: ReactNode, options: { readonly strictMode?: boolean } = {}): void {
  renderThemedTree(withLocale("en-US", node), options);
}

describe("Tour run", () => {
  it("shows each step as a dialog named by its title, and completes on Done", async () => {
    const events: TourEvent[] = [];
    const storage = renderWelcome({ onEvent: (event) => events.push(event) });
    await userEvent.click(roleNamed("button", "Take the tour"));

    const intro = await dialogNamed("Welcome");
    expect(intro).toHaveAccessibleDescription("A short look around.");
    expect(page.getByText("Step 1 of 3").element()).toHaveAttribute("aria-live", "polite");

    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    expect(page.getByText("Usage card").element()).toHaveAttribute("data-active", "");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();

    expect((await recordsOf(storage)).welcome?.status).toBe("completed");
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "completed", status: "completed" });
    expect(roleNamed("status", "welcome state")).toHaveTextContent("completed");
  });

  it("fades out beside the element it pointed at when the run ends", async () => {
    const solo = defineTour({ id: "solo", steps: ["usage"], targetTimeoutMs: 100 });
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={solo} />
        <div style={{ position: "fixed", right: 8, bottom: 8 }}>
          <Tour.Target tour={solo} step="usage" title="Usage">
            Usage card
          </Tour.Target>
        </div>
        <StepPopup tour={solo} />
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    const popup = await dialogNamed("Usage");
    // Unit under test: where a closing popup sits. Oracle: it fades out where it was, beside its
    // element, so it never moves farther than its own height and never takes the centered placement.
    const before = popup.getBoundingClientRect();
    // A detached popup measures as an empty box, so `read` skips the frame after it leaves.
    const recording = recordFrames(
      () =>
        popup.isConnected
          ? { top: popup.getBoundingClientRect().top, placement: popup.getAttribute("data-placement") ?? "" }
          : null,
      () => !popup.isConnected
    );
    await userEvent.click(roleNamed("button", "Close"));
    await expectNoDialog();
    const frames = (await recording).filter((frame) => frame !== null);
    const farthest = Math.max(0, ...frames.map((frame) => Math.abs(frame.top - before.top)));
    const placements = new Set(frames.map((frame) => frame.placement));
    expect(farthest).toBeLessThan(before.height);
    expect([...placements]).toEqual(["target"]);
  });

  it("moves between steps with the Arrow keys while focus is in the popup", async () => {
    renderWelcome();
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    roleNamed("button", "Next").focus();
    await userEvent.keyboard("{ArrowRight}");
    await dialogNamed("Usage");
    await userEvent.keyboard("{ArrowLeft}");
    await dialogNamed("Welcome");
  });

  it("leaves the last step on screen on the forward Arrow key, which writes no status", async () => {
    const storage = renderWelcome();
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    roleNamed("button", "Next").focus();
    await userEvent.keyboard("{ArrowRight}");
    await dialogNamed("Usage");
    await userEvent.keyboard("{ArrowRight}");
    await dialogNamed("Price");
    // Only Done, Skip, Close and Escape write a status. A held Arrow key must not finish the tour.
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Shift}");
    await dialogNamed("Price");
    expect((await recordsOf(storage)).welcome?.status).toBeUndefined();
  });

  it("leaves the Arrow keys to a text input in a same-origin frame", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument;
      // SAFETY: a same-origin frame's window has this window's globals, from its own realm.
      const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
      if (frameDocument === null || frameWindow === null) {
        throw new Error("expected a same-origin frame");
      }
      renderThemed(
        <Tour.Provider storage={memoryTourStorage()}>
          <Starter tour={welcome} />
          {createPortal(
            <Tour.Popup tour={welcome} initialFocus={false} container={frameDocument.body}>
              <Tour.Title />
              <input aria-label="Note" />
            </Tour.Popup>,
            frameDocument.body
          )}
        </Tour.Provider>
      );
      await userEvent.click(roleNamed("button", "Take the tour"));
      await vi.waitFor(() => {
        expect(frameDocument.querySelector("[role=dialog]")).not.toBeNull();
      });
      const note = frameDocument.querySelector("input[aria-label=Note]");
      if (note === null) {
        throw new Error("expected the input in the frame");
      }
      // The premise: this window's constructors miss the frame's nodes, as they do on a real page.
      expect(note instanceof HTMLElement).toBe(false);
      // Unit under test: the popup's Arrow-key step. Oracle: a text input keeps its own Arrow keys,
      // which is what the page's own realm does for the same element.
      const arrow = new frameWindow.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      note.dispatchEvent(arrow);
      expect(arrow.defaultPrevented).toBe(false);
    } finally {
      frame.remove();
    }
  });

  it("writes dismissed on Escape, and keeps the coachmark open through an outside press", async () => {
    const storage = renderWelcome();
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");

    await userEvent.click(page.getByText("Usage card").element());
    await dialogNamed("Welcome");

    await userEvent.keyboard("{Escape}");
    await expectNoDialog();
    expect((await recordsOf(storage)).welcome?.status).toBe("dismissed");
  });

  it("leaves the run going when an Escape outside the popup closes a hovered tooltip, and ends it on the next", async () => {
    const storage = memoryTourStorage();
    renderThemed(
      <Tour.Provider storage={storage}>
        <Starter tour={welcome} />
        <Tooltip.Provider delay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content>Add to library</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Tour.Popup tour={welcome} initialFocus={false}>
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.hover(roleNamed("button", "Hint"));
    await expect.element(page.getByRole("tooltip", { name: "Add to library", exact: true })).toBeVisible();
    // The tooltip takes the first Escape, as Base UI marks a keydown that closes an overlay handled.
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip").query()).toBeNull();
    });
    await userEvent.keyboard("{Shift}");
    await dialogNamed("Welcome");
    expect((await recordsOf(storage)).welcome?.status).toBeUndefined();
    await userEvent.keyboard("{Escape}");
    await expectNoDialog();
    expect((await recordsOf(storage)).welcome?.status).toBe("dismissed");
  });

  it("does nothing on Enter on a visually disabled Prev at the first step or Skip at the last", async () => {
    const storage = renderWelcome();
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");

    const prev = roleNamed("button", "Back");
    expect(prev).toHaveAttribute("aria-disabled", "true");
    prev.focus();
    await userEvent.keyboard("{Enter}");
    await dialogNamed("Welcome");

    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    const skip = roleNamed("button", "Skip");
    expect(skip).toHaveAttribute("aria-disabled", "true");
    skip.focus();
    await userEvent.keyboard("{Enter}");
    await dialogNamed("Price");
    expect((await recordsOf(storage)).welcome?.status).toBeUndefined();
  });

  it("moves focus into the popup by default", async () => {
    renderWelcome();
    await userEvent.click(roleNamed("button", "Take the tour"));
    const dialog = await dialogNamed("Welcome");
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("leaves focus on the page with initialFocus={false}", async () => {
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Tour.Popup tour={welcome} initialFocus={false}>
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    const starter = roleNamed("button", "Take the tour");
    await userEvent.click(starter);
    await dialogNamed("Welcome");
    expect(document.activeElement).toBe(starter);
  });

  it("returns focus to the control that started the run when it ends", async () => {
    renderWelcome();
    const starter = roleNamed("button", "Take the tour");
    await userEvent.click(starter);
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Close"));
    await expectNoDialog();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(starter);
    });
  });

  it("runs and auto-starts under Strict Mode's second effect cycle", async () => {
    function AutoStart(): ReactElement {
      useAutoStartTour(welcome, { delayMs: 0 });
      return <></>;
    }
    const events: TourEvent[] = [];
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()} onEvent={(event) => events.push(event)}>
        <AutoStart />
        <Starter tour={welcome} />
        <Tour.Target tour={welcome} step="usage" title="Usage">
          Usage card
        </Tour.Target>
        <PriceButton />
        <StepPopup tour={welcome} />
      </Tour.Provider>,
      { strictMode: true }
    );
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();
    expect(events.filter((event) => event.type === "start")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "completed" });
  });

  it("keeps a dismiss() that onEvent calls for the start event", async () => {
    let dismiss = (): void => undefined;
    function Grab({ grab }: { readonly grab: (next: () => void) => void }): null {
      const tour = useTour(welcome);
      useLayoutEffect(() => {
        grab(tour.dismiss);
      }, [grab, tour.dismiss]);
      return null;
    }
    const storage = renderWelcome({
      onEvent: (event) => {
        if (event.type === "start") {
          dismiss();
        }
      },
      children: (
        <Grab
          grab={(next) => {
            dismiss = next;
          }}
        />
      ),
    });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("dismissed");
    expect(page.getByRole("dialog").query()).toBeNull();
    await vi.waitFor(async () => {
      expect((await recordsOf(storage)).welcome?.status).toBe("dismissed");
    });
  });
});

describe("Tour targets", () => {
  it("skips a step whose element never appears, and ends as no-targets with no status when none remain", async () => {
    const sparse = defineTour({
      id: "sparse",
      steps: ["here", "gone", "also-gone"],
      targetTimeoutMs: 50,
      content: { here: { title: "Here" } },
    });
    const events: TourEvent[] = [];
    const storage = memoryTourStorage();
    renderThemed(
      <Tour.Provider storage={storage} onEvent={(event) => events.push(event)}>
        <Starter tour={sparse} />
        <div data-tour-step="sparse.here">Here</div>
        <StepPopup tour={sparse} />
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Here");
    await userEvent.click(roleNamed("button", "Next"));
    await expectNoDialog();

    expect(events.filter((event) => event.type === "skip").map((event) => event.stepId)).toEqual([
      "gone",
      "also-gone",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "no-targets", status: null });
    expect((await recordsOf(storage)).sparse?.status).toBeUndefined();
  });

  it("finds a plain-HTML target by a whole `data-tour-step` entry, and escapes the key", async () => {
    const quoted = defineTour({
      id: 'say"hi"',
      steps: ["step-1"],
      content: { "step-1": { title: "Quoted" } },
    });
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={quoted} />
        <div data-tour-step={'say"hi".step-10'} style={{ marginBlock: 120 }}>
          Longer key
        </div>
        <div data-tour-step={'other.step say"hi".step-1'}>Whole entry</div>
        <Tour.Popup tour={quoted} side="bottom" sideOffset={8}>
          <Tour.Title />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    const dialog = await dialogNamed("Quoted");
    const target = page.getByText("Whole entry").element();
    // Unit under test: which element the popup anchors to. Oracle: the whole-entry element's box with
    // the requested bottom side and 8px offset; the longer key sits 120px away.
    await vi.waitFor(() => {
      expect(dialog.getBoundingClientRect().top).toBeCloseTo(target.getBoundingClientRect().bottom + 8, 0);
    });
  });

  it("re-reads a shown Target's words when they change", async () => {
    function Renaming(): ReactElement {
      const [title, setTitle] = useState("Usage");
      return (
        <>
          <Button variant="outline" onClick={() => setTitle("Consumption")}>
            Rename
          </Button>
          <Tour.Target tour={welcome} step="usage" title={title}>
            Usage card
          </Tour.Target>
        </>
      );
    }
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Renaming />
        <StepPopup tour={welcome} />
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    await userEvent.click(roleNamed("button", "Rename"));
    await dialogNamed("Consumption");
  });

  it("falls back to an earlier registration's words when the newer one unmounts", async () => {
    function Newer(): ReactElement {
      useTourStep(welcome, "usage", { title: "Usage, newest" });
      return <></>;
    }
    function Toggle(): ReactElement {
      const [shown, setShown] = useState(true);
      return (
        <>
          <Button variant="outline" onClick={() => setShown(false)}>
            Drop the newer words
          </Button>
          {shown ? <Newer /> : null}
        </>
      );
    }
    renderWelcome({ children: <Toggle /> });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage, newest");
    roleNamed("button", "Drop the newer words").focus();
    await userEvent.keyboard("{Enter}");
    await dialogNamed("Usage");
  });
});

describe("Tour never throws", () => {
  it("ends the run as error when a part throws, writes no status, and leaves the page rendering", async () => {
    function Throwing(): ReactElement {
      throw new Error("broken words");
    }
    const errors: TourError[] = [];
    const events: TourEvent[] = [];
    const storage = memoryTourStorage();
    renderThemed(
      <Tour.Provider
        storage={storage}
        onError={(error) => errors.push(error)}
        onEvent={(event) => events.push(event)}>
        <Starter tour={welcome} />
        <StepPopup tour={welcome}>
          <Throwing />
        </StepPopup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await vi.waitFor(() => {
      expect(events.at(-1)).toMatchObject({ type: "end", reason: "error", status: null });
    });
    expect(errors.map((error) => error.source)).toContain("part");
    expect(page.getByRole("dialog").query()).toBeNull();
    expect(roleNamed("button", "Take the tour")).toBeVisible();
    expect((await recordsOf(storage)).welcome?.status).toBeUndefined();
    expect(roleNamed("status", "welcome state")).toHaveTextContent("snoozed");
  });

  it("falls back to memory when storage throws, reports storage-error, and still runs and records the tour", async () => {
    const broken: TourStorage = {
      read: () => {
        throw new Error("quota");
      },
      write: () => Promise.reject(new Error("offline")),
    };
    const events: TourEvent[] = [];
    renderWelcome({ storage: broken, onEvent: (event) => events.push(event), onError: () => undefined });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Close"));
    await expectNoDialog();
    // Memory took over after the failed read, so the broken write is never called.
    expect(events.filter((event) => event.type === "storage-error").map((event) => event.operation)).toEqual([
      "read",
    ]);
    expect(roleNamed("status", "welcome state")).toHaveTextContent("dismissed");
  });

  it("reports a failed write and keeps the run going", async () => {
    const offline: TourStorage = { read: () => ({}), write: () => Promise.reject(new Error("offline")) };
    const events: TourEvent[] = [];
    renderWelcome({ storage: offline, onEvent: (event) => events.push(event), onError: () => undefined });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await vi.waitFor(() => {
      expect(
        events.filter((event) => event.type === "storage-error").map((event) => event.operation)
      ).toEqual(["write"]);
    });
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
  });

  it("renders no tour outside a Provider and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderThemed(
      <>
        <Starter tour={welcome} />
        <StepPopup tour={welcome} />
      </>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    expect(page.getByRole("dialog").query()).toBeNull();
    expect(roleNamed("status", "welcome state")).toHaveTextContent("unknown");
    // The only observable behavior of the missing Provider is the development warning.
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes("outside Tour.Provider"))
    ).toHaveLength(1);
    warn.mockRestore();
  });

  it("renders nothing for a Tour.Close outside a Tour.Popup, on the server and the client", async () => {
    const tree = (
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Tour.Close />
      </Tour.Provider>
    );
    expect(renderToString(withLocale("en-US", tree))).not.toContain("<button aria-label");
    renderThemed(tree);
    await expect.element(page.getByRole("button", { name: "Take the tour" })).toBeVisible();
    expect(page.getByRole("button", { name: "Close" }).query()).toBeNull();
  });

  it("drops notifications from a storage that failed and was replaced by memory", async () => {
    let notify = (_records: TourRecords): void => undefined;
    const failing: TourStorage = {
      read: () => Promise.reject(new Error("offline")),
      write: () => undefined,
      subscribe: (listener) => {
        notify = listener;
        return () => {
          notify = () => undefined;
        };
      },
    };
    renderWelcome({ storage: failing, onError: () => undefined });
    await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("idle");
    notify({ welcome: { status: "completed", v: 1, at: 5 } });
    // A round trip to the page lets React render any change the notification made.
    await userEvent.keyboard("{Shift}");
    expect(roleNamed("status", "welcome state")).toHaveTextContent("idle");
  });

  it("lands remote saves in the order of the transitions that made them", async () => {
    const backend = new Map<string, TourRecords[string]>();
    const held: (() => void)[] = [];
    const storage = remoteTourStorage({
      load: () => Promise.resolve({}),
      save: (change) =>
        new Promise<void>((resolve) => {
          held.push(() => {
            backend.set(change.tourId, change.record);
            resolve();
          });
        }),
    });
    renderWelcome({ storage });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();
    // The backend answers the newest pending save first, as a slow network can.
    await vi.waitFor(async () => {
      held.pop()?.();
      await Promise.resolve();
      expect(held).toHaveLength(0);
      expect(backend.get("welcome")?.status).toBe("completed");
    });
  });

  it("keeps the first step of a run that a skip callback restarts", async () => {
    const pair = defineTour({
      id: "pair",
      steps: ["a", "b"],
      targetTimeoutMs: 50,
      content: { a: { title: "Step A" }, b: { title: "Step B" } },
    });
    let restart = (): void => undefined;
    function Grab({ grab }: { readonly grab: (next: () => void) => void }): null {
      const tour = useTour(pair);
      useLayoutEffect(() => {
        grab(() => {
          tour.dismiss();
          tour.start();
        });
      }, [grab, tour]);
      return null;
    }
    const added = document.createElement("div");
    added.textContent = "Step A's element";
    added.setAttribute("data-tour-step", "pair.a");
    let restarted = false;
    renderThemed(
      <Tour.Provider
        storage={memoryTourStorage()}
        onEvent={(event) => {
          if (event.type === "skip" && !restarted) {
            restarted = true;
            document.body.append(added);
            restart();
          }
        }}>
        <Grab
          grab={(next) => {
            restart = next;
          }}
        />
        <Starter tour={pair} />
        <div data-tour-step="pair.b">Step B's element</div>
        <Tour.Popup tour={pair}>
          <Tour.Title />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Step A");
    added.remove();
  });

  it("counts a write that fails before the first read as storage having answered, and keeps auto-start going", async () => {
    const other = defineTour({
      id: "other",
      steps: ["only"],
      content: { only: { title: "Other tour", placement: "center" } },
    });
    function AutoStart(): ReactElement {
      useAutoStartTour(other, { delayMs: 0 });
      return <></>;
    }
    const offline: TourStorage = {
      read: () => new Promise<TourRecords>(() => undefined),
      write: () => Promise.reject(new Error("offline")),
    };
    renderWelcome({
      storage: offline,
      onError: () => undefined,
      children: (
        <>
          <AutoStart />
          <StepPopup tour={other} />
        </>
      ),
    });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Close"));
    await dialogNamed("Other tour");
  });
});

describe("Tour storage and auto start", () => {
  it("auto-starts the highest priority due tour, and never a tour the initial records finished", async () => {
    const finished = defineTour({
      id: "finished",
      steps: ["only"],
      priority: 9,
      content: { only: { title: "Finished", placement: "center" } },
    });
    const minor = defineTour({
      id: "minor",
      steps: ["only"],
      content: { only: { title: "Minor", placement: "center" } },
    });
    const major = defineTour({
      id: "major",
      steps: ["only"],
      priority: 2,
      content: { only: { title: "Major", placement: "center" } },
    });
    function AutoStart(): ReactElement {
      useAutoStartTour(finished, { delayMs: 0 });
      useAutoStartTour(minor, { delayMs: 0 });
      useAutoStartTour(major, { delayMs: 0 });
      return <></>;
    }
    renderThemed(
      <Tour.Provider
        storage={memoryTourStorage()}
        initialRecords={{ finished: { status: "dismissed", v: 1, at: 0 } }}>
        <AutoStart />
        <StepPopup tour={finished} />
        <StepPopup tour={minor} />
        <StepPopup tour={major} />
      </Tour.Provider>
    );
    await dialogNamed("Major");
    expect(page.getByRole("dialog", { name: "Finished" }).query()).toBeNull();
  });

  it("auto-starts a tour once per mount, so a run that finds no targets does not start again", async () => {
    const absent = defineTour({ id: "absent", steps: ["nowhere"], targetTimeoutMs: 30 });
    function AutoStart(): ReactElement {
      useAutoStartTour(absent, { delayMs: 0 });
      return <></>;
    }
    const events: TourEvent[] = [];
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()} onEvent={(event) => events.push(event)}>
        <AutoStart />
        <Starter tour={absent} />
      </Tour.Provider>
    );
    await vi.waitFor(() => {
      expect(events.some((event) => event.type === "end")).toBe(true);
    });
    // A second run would have started in the task that ended the first, and would still be waiting.
    await vi.waitFor(() => {
      expect(roleNamed("status", "absent state")).toHaveTextContent("idle");
    });
    expect(events.filter((event) => event.type === "start")).toHaveLength(1);
  });

  it("keeps another tab's records when localTourStorage writes, and ends an auto run another tab finished", async () => {
    localStorage.setItem("fuse-tours", JSON.stringify({ billing: { status: "completed", v: 1, at: 1 } }));
    function AutoStart(): ReactElement {
      useAutoStartTour(welcome, { delayMs: 0 });
      return <></>;
    }
    const events: TourEvent[] = [];
    renderWelcome({
      storage: localTourStorage(),
      onEvent: (event) => events.push(event),
      children: <AutoStart />,
    });
    await dialogNamed("Welcome");
    await vi.waitFor(() => {
      expect(JSON.parse(localStorage.getItem("fuse-tours") ?? "{}")).toMatchObject({
        billing: { status: "completed" },
        welcome: { step: "intro" },
      });
    });

    const elsewhere = JSON.stringify({ welcome: { status: "dismissed", v: 1, at: Date.now() } });
    window.dispatchEvent(new StorageEvent("storage", { key: "fuse-tours", newValue: elsewhere }));
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "synced", status: null });
  });
});

describe("Tour.Spotlight", () => {
  function renderGuided({
    events,
    withClose = true,
  }: {
    events: TourEvent[];
    withClose?: boolean;
  }): TourStorage {
    const storage = memoryTourStorage();
    renderThemed(
      <Tour.Provider storage={storage} onEvent={(event) => events.push(event)}>
        <div data-testid="page-controls">
          <Starter tour={welcome} />
          <Tour.Target tour={welcome} step="usage" title="Usage">
            Usage card
          </Tour.Target>
          <PriceButton />
        </div>
        <Tour.Popup tour={welcome} modal="trap-focus">
          <Tour.Spotlight />
          <Tour.Header>{withClose ? <Tour.Close /> : null}</Tour.Header>
          <Tour.Title />
          <Tour.Footer>
            <Tour.Prev />
            <Tour.Next />
          </Tour.Footer>
        </Tour.Popup>
      </Tour.Provider>
    );
    return storage;
  }

  it("holds focus in the popup and hides the page from assistive technology", async () => {
    const events: TourEvent[] = [];
    renderGuided({ events });
    const starter = roleNamed("button", "Take the tour");
    await userEvent.click(starter);
    const dialog = await dialogNamed("Welcome");
    const close = roleNamed("button", "Close");
    const back = roleNamed("button", "Back");
    const next = roleNamed("button", "Next");
    // Base UI sets initial focus on the next animation frame.
    await pollFrames(() => dialog.contains(document.activeElement), true);
    const pageFocus: Element[] = [];
    page
      .getByTestId("page-controls")
      .element()
      .addEventListener("focusin", (event) => {
        if (event.target instanceof Element) pageFocus.push(event.target);
      });
    next.focus();
    expect(document.activeElement).toBe(next);
    // A Tab from the last button lands on a focus guard, which moves focus to the first button on
    // the next frame.
    await userEvent.keyboard("{Tab}");
    await pollFrames(() => document.activeElement === close, true);
    await userEvent.keyboard("{Tab}");
    await pollFrames(() => document.activeElement === back, true);
    expect(pageFocus).toEqual([]);
    expect(starter.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("ends the run as outside-press with no status on a press on the backdrop or on the lit hole", async () => {
    const events: TourEvent[] = [];
    const storage = renderGuided({ events });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await userEvent.click(roleNamed("button", "Next"));
    const dialog = await dialogNamed("Usage");
    const backdrop = overlayBackdropOf(dialog);
    const target = page.getByText("Usage card").element().getBoundingClientRect();
    const plane = backdrop.getBoundingClientRect();
    // A press in the middle of the step's element, where the cutout lights the page.
    await userEvent.click(backdrop, {
      position: {
        x: target.left + target.width / 2 - plane.left,
        y: target.top + target.height / 2 - plane.top,
      },
    });
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "outside-press", status: null });
    expect((await recordsOf(storage)).welcome?.status).toBeUndefined();

    await userEvent.click(roleNamed("button", "Take the tour"));
    const again = await dialogNamed("Welcome");
    await userEvent.click(overlayBackdropOf(again), { position: { x: 4, y: 4 } });
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "outside-press", status: null });
  });

  it("warns in development when the popup has no Tour.Close", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderGuided({ events: [], withClose: false });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    // The warning is the only observable behavior of the missing Close part.
    await vi.waitFor(() => {
      expect(
        warn.mock.calls.some(([message]) => String(message).includes("Tour.Spotlight needs a Tour.Close"))
      ).toBe(true);
    });
    warn.mockRestore();
  });

  it("keeps the lit hole on the step's element while the dim fades out", async () => {
    renderGuided({ events: [] });
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    const dialog = await dialogNamed("Usage");
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    const cutout = cutoutOf();
    const width = (): string => cutout.style.getPropertyValue("--tour-highlight-w");
    const lit = width();
    // Unit under test: the hole while the popup closes. Oracle: it stays the size of the element it
    // lit, and never closes to the 0px point a centered step uses.
    const widths: string[] = [];
    const observer = new MutationObserver(() => widths.push(width()));
    observer.observe(cutout, { attributes: true, attributeFilter: ["style"] });
    await userEvent.keyboard("{Escape}");
    await expectNoDialog();
    observer.disconnect();
    expect(widths.filter((value) => value !== lit)).toEqual([]);
  });

  it("moves the lit hole and the ring with the element when the layout shifts under it", async () => {
    // The shift moves the element down and keeps the page's height, so nothing scrolls or resizes.
    function Shifting({ children }: { children: ReactNode }): ReactElement {
      const [shifted, setShifted] = useState(false);
      return (
        <>
          <button type="button" hidden onClick={() => setShifted(true)}>
            Shift
          </button>
          <div style={{ paddingBlockStart: shifted ? 120 : 0, paddingBlockEnd: shifted ? 0 : 120 }}>
            {children}
          </div>
        </>
      );
    }
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Shifting>
          <Tour.Target tour={welcome} step="usage" title="Usage">
            Usage card
          </Tour.Target>
        </Shifting>
        <PriceButton />
        <Tour.Popup tour={welcome} modal="trap-focus">
          <Tour.Spotlight />
          <Tour.Ring />
          <Tour.Close />
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    const dialog = await dialogNamed("Usage");
    // The step settles first, so no scroll or entrance animation is still moving anything.
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    const cutout = cutoutOf();
    const ring = document.querySelector<HTMLElement>('[data-slot="tour-ring"]');
    if (ring === null) {
      throw new Error("expected the ring");
    }
    const target = page.getByText("Usage card").element();
    // Unit under test: the hole's and the ring's boxes. Oracle: each covers the element's box,
    // wherever the element is.
    const covers = (): boolean =>
      [cutout, ring].every((highlight) => {
        const box = highlight.getBoundingClientRect();
        const element = target.getBoundingClientRect();
        return box.top <= element.top && box.bottom >= element.bottom;
      });
    await vi.waitFor(() => {
      expect(covers()).toBe(true);
    });
    // Two frames pass, so no measure the step's own changes asked for is still pending.
    await nextFrames(2);
    const top = target.getBoundingClientRect().top;
    // A layout shift with no scroll and no resize, as a late image or an opening banner makes. The
    // backdrop takes presses on the page, so the shift comes from a script.
    document.querySelector<HTMLButtonElement>("button[hidden]")?.click();
    await vi.waitFor(() => {
      expect(target.getBoundingClientRect().top).toBeGreaterThan(top);
    });
    await vi.waitFor(() => {
      expect(covers()).toBe(true);
    });
  });
});

function cutoutOf(): HTMLElement {
  const cutout = document.querySelector<HTMLElement>('[data-slot="tour-cutout"]');
  if (cutout === null) {
    throw new Error("expected the spotlight's cutout");
  }
  return cutout;
}

describe("Tour checklist", () => {
  function Checklist(): ReactElement {
    const tour = useTour(welcome);
    const usageDone = useTourStepDone(welcome, "usage");
    return (
      <>
        <output aria-label="Done count">{tour.doneCount}</output>
        <output aria-label="Usage done">{String(usageDone)}</output>
        <Button variant="outline" onClick={() => tour.startStep("usage")}>
          Show the usage tip
        </Button>
        <Button variant="outline" onClick={() => tour.completeStep("usage")}>
          Finish usage
        </Button>
        <Button variant="outline" onClick={() => tour.completeStep("intro")}>
          Finish intro
        </Button>
        <Button variant="outline" onClick={() => tour.completeStep("price")}>
          Finish price
        </Button>
      </>
    );
  }

  it("shows one step on its own, whose Done ends the run with no status", async () => {
    const events: TourEvent[] = [];
    const storage = renderWelcome({ onEvent: (event) => events.push(event), children: <Checklist /> });
    await userEvent.click(roleNamed("button", "Show the usage tip"));
    await dialogNamed("Usage");
    expect(page.getByText("Step 2 of 3").query()).toBeNull();
    expect(roleNamed("button", "Back")).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "step-done", status: null });
    expect((await recordsOf(storage)).welcome).toBeUndefined();
  });

  it("marks tasks done, ends the shown task's run, and completes the tour with the last task", async () => {
    const events: TourEvent[] = [];
    const storage = renderWelcome({ onEvent: (event) => events.push(event), children: <Checklist /> });
    await userEvent.click(roleNamed("button", "Show the usage tip"));
    await dialogNamed("Usage");
    // A coachmark leaves the page usable, so the task's own control is reachable from the keyboard.
    roleNamed("button", "Finish usage").focus();
    await userEvent.keyboard("{Enter}");
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "step-done" });
    expect(roleNamed("status", "Usage done")).toHaveTextContent("true");
    expect(roleNamed("status", "Done count")).toHaveTextContent("1");

    await userEvent.click(roleNamed("button", "Finish intro"));
    await userEvent.click(roleNamed("button", "Finish price"));
    await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("completed");
    expect((await recordsOf(storage)).welcome).toMatchObject({
      status: "completed",
      done: ["usage", "intro", "price"],
    });
  });

  it("completes a checklist whose tasks another device finished between them", async () => {
    const storage = memoryTourStorage({ welcome: { v: 1, done: ["intro", "usage", "price"], at: 3 } });
    renderWelcome({ storage });
    await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("completed");
    await vi.waitFor(async () => {
      expect((await recordsOf(storage)).welcome?.status).toBe("completed");
    });
  });

  it("ends an auto-running checklist as synced when another tab's record finishes its tasks", async () => {
    function AutoStart(): ReactElement {
      useAutoStartTour(welcome, { delayMs: 0 });
      return <></>;
    }
    const events: TourEvent[] = [];
    renderWelcome({
      storage: localTourStorage(),
      onEvent: (event) => events.push(event),
      children: <AutoStart />,
    });
    await dialogNamed("Welcome");
    const covered = JSON.stringify({ welcome: { v: 1, done: ["intro", "usage", "price"], at: Date.now() } });
    window.dispatchEvent(new StorageEvent("storage", { key: "fuse-tours", newValue: covered }));
    await expectNoDialog();
    expect(events.at(-1)).toMatchObject({ type: "end", reason: "synced", status: null });
    expect(roleNamed("status", "welcome state")).toHaveTextContent("completed");
  });

  const setup = defineTour({ id: "setup", steps: ["meter", "payment"] });
  // Each part makes `setup` known to the session on its own. The list items are plain-HTML targets.
  function SetupList({ children }: { children?: ReactNode }): ReactElement {
    return (
      <ul>
        <li data-tour-step="setup.payment">Add a payment method</li>
        {children}
      </ul>
    );
  }
  function WithUseTour(): ReactElement {
    const tour = useTour(setup);
    return (
      <SetupList>
        <li data-tour-step="setup.meter">Connect your meter ({tour.state})</li>
      </SetupList>
    );
  }
  function WithUseTourStepDone(): ReactElement {
    const done = useTourStepDone(setup, "meter");
    return (
      <SetupList>
        <li data-tour-step="setup.meter">Connect your meter {done ? "(done)" : ""}</li>
      </SetupList>
    );
  }
  function WithTarget(): ReactElement {
    return (
      <SetupList>
        <Tour.Target tour={setup} step="meter" title="Meter" render={<li />}>
          Connect your meter
        </Tour.Target>
      </SetupList>
    );
  }
  function WithUseTourStep(): ReactElement {
    const { ref } = useTourStep(setup, "meter", { title: "Meter" });
    return (
      <SetupList>
        <li ref={ref}>Connect your meter</li>
      </SetupList>
    );
  }
  function WithBeacon(): ReactElement {
    return (
      <SetupList>
        <li data-tour-step="setup.meter">Connect your meter</li>
        <li>
          <Tour.Beacon tour={setup} step="meter" />
        </li>
      </SetupList>
    );
  }
  function WithAutoStart(): ReactElement {
    useAutoStartTour(setup, { delayMs: 0 });
    return (
      <SetupList>
        <li data-tour-step="setup.meter">Connect your meter</li>
      </SetupList>
    );
  }

  it.each([
    ["useTour", WithUseTour],
    ["useTourStepDone", WithUseTourStepDone],
    ["Tour.Target", WithTarget],
    ["useTourStep", WithUseTourStep],
    ["useAutoStartTour", WithAutoStart],
    ["Tour.Beacon", WithBeacon],
  ])(
    "completes a checklist that %s makes known after its covering records arrived, and saves it",
    async (_part, Part) => {
      function Later(): ReactElement {
        const [open, setOpen] = useState(false);
        return (
          <>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Open the checklist
            </Button>
            {open ? <Part /> : null}
          </>
        );
      }
      const storage = memoryTourStorage({ setup: { v: 1, done: ["meter", "payment"], at: 1 } });
      renderWelcome({ storage, children: <Later /> });
      await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("idle");
      await userEvent.click(roleNamed("button", "Open the checklist"));
      await vi.waitFor(async () => {
        expect((await recordsOf(storage)).setup?.status).toBe("completed");
      });
    }
  );
});

describe("Tour.Ring", () => {
  it("outlines the step's element without taking presses from it", async () => {
    const presses: string[] = [];
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Tour.Target
          tour={welcome}
          step="usage"
          title="Usage"
          render={<button type="button" onClick={() => presses.push("usage")} />}>
          Usage card
        </Tour.Target>
        <Tour.Popup tour={welcome} side="right">
          <Tour.Ring />
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    const target = roleNamed("button", "Usage card");
    // Unit under test: the ring's box. Oracle: the target's box grown by the default 4px padding.
    // The ring is hidden from assistive technology, so only its slot finds it.
    await vi.waitFor(() => {
      const ring = document.querySelector('[data-slot="tour-ring"]');
      expect(ring).not.toBeNull();
      const box = ring?.getBoundingClientRect();
      const element = target.getBoundingClientRect();
      expect(box?.left).toBeCloseTo(element.left - 4, 0);
      expect(box?.width).toBeCloseTo(element.width + 8, 0);
      expect(box?.height).toBeCloseTo(element.height + 8, 0);
    });
    await userEvent.click(target);
    expect(presses).toEqual(["usage"]);
    await dialogNamed("Usage");
  });
});

describe("Tour.Beacon", () => {
  const tip = defineTour({
    id: "export-tip",
    steps: ["export"],
    content: { export: { title: "Export your data", description: "Download a CSV of your readings." } },
  });

  function renderBeacon(props: FixtureOptions & { readonly storage: TourStorage }): void {
    renderThemed(
      <Tour.Provider {...props}>
        <Tour.Beacon tour={tip} />
        <StepPopup tour={tip} />
      </Tour.Provider>
    );
  }

  it("renders nothing until storage answers, then a button that opens the tip and closes it for good", async () => {
    let answer: (records: TourRecords) => void = () => undefined;
    const storage = memoryTourStorage();
    const slow: TourStorage = {
      read: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
      write: storage.write,
    };
    renderBeacon({ storage: slow });
    expect(page.getByRole("button", { name: "Show tip" }).query()).toBeNull();
    answer({});

    const beacon = page.getByRole("button", { name: "Show tip" });
    await expect.element(beacon).toBeVisible();
    expect(beacon.element()).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(beacon.element());
    await dialogNamed("Export your data");
    expect(beacon.element()).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(roleNamed("button", "Close"));
    await expectNoDialog();
    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: "Show tip" }).query()).toBeNull();
    });
    expect((await recordsOf(storage))["export-tip"]?.status).toBe("dismissed");
  });

  it("keeps pointing the tip at the beacon when the consumer passes a ref", async () => {
    const consumerRef = createRef<HTMLButtonElement>();
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Tour.Beacon tour={tip} ref={consumerRef} />
        <StepPopup tour={tip} />
      </Tour.Provider>
    );
    const beacon = page.getByRole("button", { name: "Show tip" });
    await expect.element(beacon).toBeVisible();
    expect(consumerRef.current).toBe(beacon.element());
    await userEvent.click(beacon.element());
    await dialogNamed("Export your data");
  });

  it("renders nothing for a tip the initial records finished, before and after storage answers", async () => {
    const storage = memoryTourStorage();
    renderThemed(
      <Tour.Provider
        storage={storage}
        initialRecords={{ "export-tip": { status: "completed", v: 1, at: 1 } }}>
        <Starter tour={welcome} />
        <Tour.Beacon tour={tip} />
      </Tour.Provider>
    );
    expect(page.getByRole("button", { name: "Show tip" }).query()).toBeNull();
    // Another tour leaves "unknown" once storage answers.
    await expect.element(page.getByRole("status", { name: "welcome state" })).toHaveTextContent("idle");
    expect(page.getByRole("button", { name: "Show tip" }).query()).toBeNull();
  });

  it("keeps the lit hole over the beacon while the dim fades, though the beacon unmounts with the tip", async () => {
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Tour.Beacon tour={tip} />
        <Tour.Popup tour={tip} modal="trap-focus">
          <Tour.Spotlight />
          <Tour.Close />
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Show tip"));
    const dialog = await dialogNamed("Export your data");
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    const cutout = cutoutOf();
    const width = (): string => cutout.style.getPropertyValue("--tour-highlight-w");
    const lit = width();
    // Unit under test: the hole while the popup closes. Oracle: the beacon's box, which it lit. Done
    // completes the tip, and the beacon, the step's element, leaves the page with it.
    const widths: string[] = [];
    const observer = new MutationObserver(() => widths.push(width()));
    observer.observe(cutout, { attributes: true, attributeFilter: ["style"] });
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();
    observer.disconnect();
    expect(page.getByRole("button", { name: "Show tip" }).query()).toBeNull();
    expect(widths.filter((value) => value !== lit)).toEqual([]);
  });
});

describe("Tour glide", () => {
  it("pins the popup where it was when the step changes, then releases it at the next step's element", async () => {
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()}>
        <Starter tour={welcome} />
        <Tour.Target tour={welcome} step="usage" title="Usage">
          Usage card
        </Tour.Target>
        <div style={{ marginInlineStart: 240, marginBlockStart: 160 }}>
          <PriceButton />
        </div>
        <Tour.Popup tour={welcome} sideOffset={12}>
          <Tour.Title />
          <Tour.Next />
        </Tour.Popup>
      </Tour.Provider>
    );
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    const dialog = await dialogNamed("Usage");
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished.catch(() => undefined)));

    const pins: string[] = [];
    const observer = new MutationObserver(() => {
      pins.push(dialog.style.translate);
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["style"] });
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    const price = roleNamed("button", "Price");
    // Unit under test: the popup's place after the glide. Oracle: the price button's box with the
    // bottom side and 12px offset, and no translate left on the popup.
    await vi.waitFor(() => {
      expect(dialog.style.translate).toBe("");
      expect(dialog).not.toHaveAttribute("data-gliding");
      expect(dialog.getBoundingClientRect().top).toBeCloseTo(price.getBoundingClientRect().bottom + 12, 0);
    });
    observer.disconnect();
    expect(pins.some((pin) => pin !== "")).toBe(true);
  });
});

describe("Tour re-renders", () => {
  it("renders an unrelated child once, a Target as it becomes and stops being shown, and another tour's Popup only on step changes", async () => {
    const commits = { unrelated: 0, target: 0, otherPopup: 0 };
    const other = defineTour({ id: "other", steps: ["only"] });
    const events: TourEvent[] = [];
    renderThemed(
      <Tour.Provider storage={memoryTourStorage()} onEvent={(event) => events.push(event)}>
        <Profiler
          id="unrelated"
          onRender={() => {
            commits.unrelated += 1;
          }}>
          <p>Unrelated</p>
        </Profiler>
        <Starter tour={welcome} />
        <Tour.Target
          tour={welcome}
          step="usage"
          title="Usage"
          render={(props) => {
            commits.target += 1;
            return <div {...props} />;
          }}>
          Usage card
        </Tour.Target>
        <PriceButton />
        <StepPopup tour={welcome} />
        <Profiler
          id="other"
          onRender={() => {
            commits.otherPopup += 1;
          }}>
          <StepPopup tour={other} />
        </Profiler>
      </Tour.Provider>
    );
    const mounted = { ...commits };
    await userEvent.click(roleNamed("button", "Take the tour"));
    await dialogNamed("Welcome");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Usage");
    await userEvent.click(roleNamed("button", "Next"));
    await dialogNamed("Price");
    await userEvent.click(roleNamed("button", "Done"));
    await expectNoDialog();

    expect(commits.unrelated - mounted.unrelated).toBe(0);
    // It became the shown step, then stopped being it.
    expect(commits.target - mounted.target).toBe(2);
    // Three steps showed and the run ended: four changes of the shown step.
    const shownChanges = events.filter((event) => event.type === "show" || event.type === "end").length;
    expect(shownChanges).toBe(4);
    expect(commits.otherPopup - mounted.otherPopup).toBe(shownChanges);
  });
});
