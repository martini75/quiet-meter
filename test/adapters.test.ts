import { describe, expect, it } from "bun:test";
import { isPlausibleLevel, startExpoCapture, type MeteringRecorder } from "../src/expo";

/** Drives the polling loop by hand so the tests are deterministic. */
function manualClock() {
  const fns: Array<() => void> = [];
  let t = 0;
  return {
    setInterval: (fn: () => void) => {
      fns.push(fn);
      return fns.length - 1;
    },
    clearInterval: (h: unknown) => {
      fns[h as number] = () => {};
    },
    now: () => (t += 100),
    async tick(times = 1) {
      for (let i = 0; i < times; i++) {
        for (const fn of fns) fn();
        // Let the promise inside the loop settle.
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };
}

function recorderReturning(levels: Array<number | null>): MeteringRecorder & { stopped: boolean } {
  let i = 0;
  return {
    stopped: false,
    getLevelDbfs: () => levels[Math.min(i++, levels.length - 1)],
    stop() {
      this.stopped = true;
    },
  };
}

describe("expo level plausibility", () => {
  it("accepts ordinary negative dBFS", () => {
    expect(isPlausibleLevel(-55)).toBe(true);
    expect(isPlausibleLevel(-0.5)).toBe(true);
  });

  it("rejects the platform floor, which would score every room as silent", () => {
    expect(isPlausibleLevel(-160)).toBe(false);
    expect(isPlausibleLevel(-120)).toBe(false);
  });

  it("rejects positive, null, NaN and Infinity", () => {
    expect(isPlausibleLevel(3)).toBe(false);
    expect(isPlausibleLevel(null)).toBe(false);
    expect(isPlausibleLevel(Number.NaN)).toBe(false);
    expect(isPlausibleLevel(-Infinity)).toBe(false);
  });
});

describe("expo capture session", () => {
  it("collects plausible levels and skips the rest", async () => {
    const clock = manualClock();
    const recorder = recorderReturning([-50, -160, -52, null, -48]);
    const session = startExpoCapture({
      recorder,
      device: { platform: "ios", model: "test" },
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      now: clock.now,
    });

    await clock.tick(5);
    const reading = await session.stop();

    // Five polls, two of them unusable.
    expect(reading.dbfs.count).toBe(3);
    expect(reading.provenance.method).toBe("platform-metering");
  });

  it("never reports SPL without calibration", async () => {
    const clock = manualClock();
    const session = startExpoCapture({
      recorder: recorderReturning([-55]),
      device: { platform: "android" },
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      now: clock.now,
    });
    await clock.tick(3);
    const reading = await session.stop();
    expect(reading.spl).toBeNull();
    expect(reading.score.basis).toBe("dbfs");
  });

  it("assumes platform processing is on unless the caller says otherwise", async () => {
    const clock = manualClock();
    const session = startExpoCapture({
      recorder: recorderReturning([-55]),
      device: { platform: "ios" },
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      now: clock.now,
    });
    await clock.tick(2);
    const reading = await session.stop();
    expect(reading.provenance.device.agcSuspected).toBe(true);
    expect(reading.provenance.warnings.some((w) => w.includes("gain control"))).toBe(true);
  });

  it("releases the recorder on stop and goes inactive", async () => {
    const clock = manualClock();
    const recorder = recorderReturning([-55]);
    const session = startExpoCapture({
      recorder,
      device: { platform: "ios" },
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      now: clock.now,
    });
    await clock.tick(2);
    expect(session.active).toBe(true);
    await session.stop();
    expect(session.active).toBe(false);
    expect(recorder.stopped).toBe(true);
  });

  it("peek does not stop the session", async () => {
    const clock = manualClock();
    const session = startExpoCapture({
      recorder: recorderReturning([-60]),
      device: { platform: "android" },
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      now: clock.now,
    });
    await clock.tick(3);
    expect(session.peek().dbfs.count).toBe(3);
    expect(session.active).toBe(true);
    await clock.tick(2);
    expect(session.peek().dbfs.count).toBe(5);
    await session.stop();
  });
});
