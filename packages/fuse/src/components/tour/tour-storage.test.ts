// Unit under test: the remote and layered storage adapters. Oracles: the layered contract (a read
// waits for the remote up to `waitMs`, a late or failed remote leaves the cache's answer, and a
// late answer reaches subscribers and the cache without undoing a write made meanwhile, and a
// failed remote save leaves the cache's copy) and the remote's parse of an untrusted answer.
// `localTourStorage` needs a browser and is covered in the tour's browser file.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TourRecord, TourRecords } from "./tour-records";
import { layeredTourStorage, memoryTourStorage, remoteTourStorage } from "./tour-storage";
import type { TourStorage } from "./tour-storage";

const cached: TourRecords = { welcome: { v: 1, step: "usage", at: 10 } };
const finishedElsewhere: TourRecords = { welcome: { status: "dismissed", v: 1, at: 5 } };

function remoteAnsweringAfter(ms: number, answer: TourRecords | Error): TourStorage {
  return {
    read: () =>
      new Promise((resolve, reject) => {
        setTimeout(() => (answer instanceof Error ? reject(answer) : resolve(answer)), ms);
      }),
    write: () => undefined,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("layeredTourStorage", () => {
  it("answers with the remote merged into the cache when the remote answers in time", async () => {
    const storage = layeredTourStorage(
      memoryTourStorage(cached),
      remoteAnsweringAfter(100, finishedElsewhere),
      {
        waitMs: 500,
      }
    );
    const read = Promise.resolve(storage.read());
    await vi.advanceTimersByTimeAsync(100);
    await expect(read).resolves.toEqual(finishedElsewhere);
  });

  it("answers with the cache when the remote is late, then hands the late answer to subscribers and the cache", async () => {
    const cache = memoryTourStorage(cached);
    const storage = layeredTourStorage(cache, remoteAnsweringAfter(900, finishedElsewhere), { waitMs: 500 });
    const heard: TourRecords[] = [];
    storage.subscribe?.((records) => heard.push(records));

    const read = Promise.resolve(storage.read());
    await vi.advanceTimersByTimeAsync(500);
    await expect(read).resolves.toEqual(cached);
    expect(heard).toEqual([]);

    await vi.advanceTimersByTimeAsync(400);
    expect(heard).toEqual([finishedElsewhere]);
    expect(await cache.read()).toEqual(finishedElsewhere);
  });

  it("fills the cache from a late remote answer without erasing a write made while it waited", async () => {
    const cache = memoryTourStorage(cached);
    const storage = layeredTourStorage(cache, remoteAnsweringAfter(900, finishedElsewhere), { waitMs: 500 });
    const read = Promise.resolve(storage.read());
    await vi.advanceTimersByTimeAsync(500);
    await read;

    const billing = { status: "completed" as const, v: 1, at: 600 };
    await storage.write({ ...cached, billing }, { tourId: "billing", record: billing });
    await vi.advanceTimersByTimeAsync(400);
    expect(await cache.read()).toEqual({ ...finishedElsewhere, billing });
  });

  it("answers with the cache when the remote fails", async () => {
    const storage = layeredTourStorage(
      memoryTourStorage(cached),
      remoteAnsweringAfter(50, new Error("offline")),
      {
        waitMs: 500,
      }
    );
    const read = Promise.resolve(storage.read());
    await vi.advanceTimersByTimeAsync(50);
    await expect(read).resolves.toEqual(cached);
  });

  it("saves to the cache and settles when the remote's save fails, as a failed remote read leaves the cache's answer", async () => {
    const cache = memoryTourStorage();
    let failures = 1;
    const remote: TourStorage = {
      read: () => ({}),
      write: () => (failures-- > 0 ? Promise.reject(new Error("a network blip")) : undefined),
    };
    const storage = layeredTourStorage(cache, remote);
    const usage: TourRecord = { v: 1, step: "usage", at: 10 };
    await expect(
      Promise.resolve(storage.write({ welcome: usage }, { tourId: "welcome", record: usage }))
    ).resolves.toBeUndefined();
    expect(await cache.read()).toEqual({ welcome: usage });
    const completed: TourRecord = { status: "completed", v: 1, at: 20 };
    await storage.write({ welcome: completed }, { tourId: "welcome", record: completed });
    expect(await cache.read()).toEqual({ welcome: completed });
  });
});

describe("remoteTourStorage", () => {
  it("drops each entry of the backend's answer that is not a record, and saves the change it is given", async () => {
    const saved: unknown[] = [];
    const storage = remoteTourStorage({
      load: () => Promise.resolve({ welcome: { status: "completed", v: 1, at: 3 }, billing: "corrupt" }),
      save: (change) => {
        saved.push(change);
        return Promise.resolve();
      },
    });
    await expect(storage.read()).resolves.toEqual({ welcome: { status: "completed", v: 1, at: 3 } });
    const change = { tourId: "billing", record: { v: 1, at: 4 } };
    await storage.write({ billing: change.record }, change);
    expect(saved).toEqual([change]);
  });
});
