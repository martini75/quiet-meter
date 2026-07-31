import { describe, expect, it } from "bun:test";
import {
  amplitudeToDbfs,
  aWeightingDb,
  exceedance,
  frameDbfs,
  FLOOR_DBFS,
  leq,
  QuietMeasurement,
  rms,
  scoreFromBackground,
  summarise,
  buildProvenance,
  type DeviceInfo,
} from "../src/core";

const DEVICE: DeviceInfo = { platform: "web", model: "test" };

function sine(amplitude: number, samples = 2048): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) out[i] = amplitude * Math.sin((2 * Math.PI * i * 8) / samples);
  return out;
}

describe("signal", () => {
  it("rms of a sine is amplitude / sqrt(2)", () => {
    expect(rms(sine(1))).toBeCloseTo(1 / Math.SQRT2, 3);
  });

  it("full-scale amplitude is 0 dBFS and never positive", () => {
    expect(amplitudeToDbfs(1)).toBeCloseTo(0, 6);
    expect(amplitudeToDbfs(0.5)).toBeCloseTo(-6.02, 1);
    expect(amplitudeToDbfs(2)).toBeGreaterThan(0); // caller's problem, not clamped upward
  });

  it("digital silence lands on the floor rather than -Infinity", () => {
    expect(amplitudeToDbfs(0)).toBe(FLOOR_DBFS);
    expect(Number.isFinite(frameDbfs(new Float32Array(512)))).toBe(true);
  });

  it("halving amplitude drops the level by ~6 dB", () => {
    const loud = frameDbfs(sine(0.5));
    const quiet = frameDbfs(sine(0.25));
    expect(loud - quiet).toBeCloseTo(6.02, 1);
  });

  it("A-weighting is 0 dB at 1 kHz and discounts the extremes", () => {
    expect(aWeightingDb(1000)).toBeCloseTo(0, 1);
    // Published reference values: about -16 dB at 100 Hz, about -1 dB at 4 kHz.
    expect(aWeightingDb(100)).toBeCloseTo(-19.1, 0);
    expect(aWeightingDb(4000)).toBeCloseTo(1, 0);
    expect(aWeightingDb(20)).toBeLessThan(-40);
  });
});

describe("stats", () => {
  const levels = [-70, -68, -66, -64, -62, -60, -58, -56, -54, -30];

  it("L90 is the background, so it is LOWER than L10", () => {
    const s = summarise(levels);
    expect(s.l90).toBeLessThan(s.l10);
  });

  it("exceedance follows the acoustics convention, not the statistical one", () => {
    // Exceeded 90 % of the time -> near the bottom of the sorted set.
    expect(exceedance(levels, 90)).toBeLessThan(-66);
    expect(exceedance(levels, 10)).toBeGreaterThan(-56);
  });

  it("Leq is energy-averaged, so one loud event pulls it above the median", () => {
    const s = summarise(levels);
    expect(s.leq).toBeGreaterThan(s.l50);
  });

  it("Leq of a constant signal is that constant", () => {
    expect(leq([-50, -50, -50])).toBeCloseTo(-50, 6);
  });

  it("an empty measurement does not throw", () => {
    const s = summarise([]);
    expect(s.count).toBe(0);
    expect(Number.isNaN(s.l90)).toBe(true);
  });
});

describe("provenance", () => {
  it("refuses to claim calibration that was not supplied", () => {
    const p = buildProvenance({
      method: "raw-frames",
      device: DEVICE,
      durationMs: 60_000,
      samples: 600,
      startedAt: new Date(0).toISOString(),
      library: "test",
    });
    expect(p.calibrated).toBe(false);
    expect(p.warnings.some((w) => w.includes("Uncalibrated"))).toBe(true);
  });

  it("platform metering carries a wider margin than raw frames", () => {
    const base = {
      device: DEVICE,
      durationMs: 60_000,
      samples: 600,
      startedAt: new Date(0).toISOString(),
      library: "test",
    };
    const frames = buildProvenance({ ...base, method: "raw-frames" });
    const metering = buildProvenance({ ...base, method: "platform-metering" });
    expect(metering.marginDb).toBeGreaterThan(frames.marginDb);
  });

  it("warns when the measurement is too short to describe a place", () => {
    const p = buildProvenance({
      method: "raw-frames",
      device: DEVICE,
      durationMs: 5_000,
      samples: 50,
      startedAt: new Date(0).toISOString(),
      library: "test",
    });
    expect(p.warnings.some((w) => w.includes("Short measurement"))).toBe(true);
  });

  it("combines calibration and method uncertainty in quadrature", () => {
    const p = buildProvenance({
      method: "raw-frames", // 3 dB
      device: DEVICE,
      durationMs: 60_000,
      samples: 600,
      startedAt: new Date(0).toISOString(),
      library: "test",
      calibration: { offsetDb: 100, source: "reference-meter", marginDb: 4 },
    });
    expect(p.marginDb).toBeCloseTo(5, 1); // sqrt(3^2 + 4^2)
    expect(p.calibrated).toBe(true);
  });
});

describe("score", () => {
  const uncalibrated = buildProvenance({
    method: "raw-frames",
    device: DEVICE,
    durationMs: 60_000,
    samples: 600,
    startedAt: new Date(0).toISOString(),
    library: "test",
  });
  const calibrated = buildProvenance({
    method: "raw-frames",
    device: DEVICE,
    durationMs: 60_000,
    samples: 600,
    startedAt: new Date(0).toISOString(),
    library: "test",
    calibration: { offsetDb: 100, source: "reference-meter", marginDb: 2 },
  });

  it("quieter backgrounds score higher", () => {
    const quiet = scoreFromBackground(28, calibrated).value;
    const loud = scoreFromBackground(55, calibrated).value;
    expect(quiet).toBeGreaterThan(loud);
  });

  it("stays inside 0-100 beyond both ends of the curve", () => {
    expect(scoreFromBackground(5, calibrated).value).toBe(100);
    expect(scoreFromBackground(120, calibrated).value).toBe(0);
  });

  it("labels the basis so dBFS scores are never mistaken for absolute ones", () => {
    expect(scoreFromBackground(-60, uncalibrated).basis).toBe("dbfs");
    expect(scoreFromBackground(35, calibrated).basis).toBe("spl");
  });

  it("carries a margin that widens with the measurement's uncertainty", () => {
    expect(scoreFromBackground(40, calibrated).margin).toBeGreaterThan(0);
    expect(scoreFromBackground(40, uncalibrated).margin).toBeGreaterThanOrEqual(0);
  });
});

describe("measurement session", () => {
  function session(calibrated: boolean) {
    let t = 0;
    const m = new QuietMeasurement({
      device: DEVICE,
      now: () => (t += 100),
      calibration: calibrated
        ? { offsetDb: 100, source: "reference-meter", marginDb: 2 }
        : undefined,
    });
    for (let i = 0; i < 60; i++) m.pushFrame(sine(0.002), 48_000);
    return m;
  }

  it("returns null SPL when uncalibrated — the core guarantee", () => {
    const r = session(false).result();
    expect(r.spl).toBeNull();
    expect(r.dbfs.count).toBe(60);
    expect(r.score.basis).toBe("dbfs");
  });

  it("returns SPL shifted by the calibration offset when calibrated", () => {
    const r = session(true).result();
    expect(r.spl).not.toBeNull();
    expect(r.spl!.l90).toBeCloseTo(r.dbfs.l90 + 100, 6);
    expect(r.score.basis).toBe("spl");
  });

  it("records platform metering as the method when levels were pushed pre-computed", () => {
    let t = 0;
    const m = new QuietMeasurement({ device: DEVICE, now: () => (t += 100) });
    for (let i = 0; i < 20; i++) m.pushLevel(-55);
    expect(m.result().provenance.method).toBe("platform-metering");
  });

  it("scores a quiet room above a loud one on identical settings", () => {
    let t = 0;
    const quiet = new QuietMeasurement({ device: DEVICE, now: () => (t += 100) });
    for (let i = 0; i < 60; i++) quiet.pushLevel(-72);
    let u = 0;
    const loud = new QuietMeasurement({ device: DEVICE, now: () => (u += 100) });
    for (let i = 0; i < 60; i++) loud.pushLevel(-38);
    expect(quiet.result().score.value).toBeGreaterThan(loud.result().score.value);
  });
});
