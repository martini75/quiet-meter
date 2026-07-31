/**
 * React Native / Expo capture.
 *
 * Expo does not expose raw PCM from the recorder. What it exposes is a **metering level** on
 * the recording status — a dBFS number the OS computed with an algorithm it does not document.
 * That is why the core accepts pre-computed levels at all, and why readings taken this way
 * carry a wider method margin than browser readings.
 *
 * This adapter deliberately does **not** import `expo-av` or `expo-audio`. Those packages
 * change API across SDK versions, they are peer concerns of the host app, and a measurement
 * library has no business pinning them. Instead it drives anything matching `MeteringRecorder`,
 * and the app supplies twenty lines of wiring. See the README for both variants.
 *
 * NOTE: the polling loop, normalisation and session lifecycle below are covered by tests, but
 * the library has not been run against a physical device — the wiring snippets in the README
 * are written from the documented APIs, not from a verified run.
 */

import { QuietMeasurement, type Calibration, type DeviceInfo, type QuietReading } from "../core";

/**
 * The smallest surface this adapter needs. `expo-av`'s `Audio.Recording` and `expo-audio`'s
 * recorder both satisfy it with a thin wrapper.
 */
export interface MeteringRecorder {
  /** Current level in dBFS (<= 0), or null when the platform has not produced one yet. */
  getLevelDbfs(): Promise<number | null> | number | null;
  /** Release the microphone. Called once when the session stops. */
  stop?(): Promise<void> | void;
}

export interface ExpoCaptureOptions {
  recorder: MeteringRecorder;
  device: Omit<DeviceInfo, "platform"> & { platform?: "ios" | "android" };
  calibration?: Calibration;
  /** Polling period. Expo updates metering on its own cadence; 100 ms is a sensible ask. */
  intervalMs?: number;
  onLevel?: (dbfs: number) => void;
  /** Injected for tests. */
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  now?: () => number;
}

export interface ExpoCaptureSession {
  stop(): Promise<QuietReading>;
  peek(): QuietReading;
  readonly active: boolean;
}

/**
 * Some platforms report a floor value (often -160) when the signal is below their threshold.
 * Passing that through would drag L90 to an impossible level and score every room as silent.
 */
const IMPLAUSIBLE_FLOOR_DBFS = -95;

export function isPlausibleLevel(level: number | null | undefined): level is number {
  return (
    typeof level === "number" &&
    Number.isFinite(level) &&
    level <= 0 &&
    level > IMPLAUSIBLE_FLOOR_DBFS
  );
}

/** Start a metering-driven measurement. */
export function startExpoCapture(options: ExpoCaptureOptions): ExpoCaptureSession {
  const measurement = new QuietMeasurement({
    device: {
      platform: options.device.platform ?? "unknown",
      model: options.device.model,
      os: options.device.os,
      // The OS metering pipeline is opaque; assume its processing is on unless told otherwise.
      agcSuspected: options.device.agcSuspected ?? true,
    },
    calibration: options.calibration,
    now: options.now,
  });

  const start = options.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clear = options.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));

  let active = true;
  const handle = start(() => {
    if (!active) return;
    void Promise.resolve(options.recorder.getLevelDbfs()).then((level) => {
      if (!active || !isPlausibleLevel(level)) return;
      measurement.pushLevel(level);
      options.onLevel?.(level);
    });
  }, options.intervalMs ?? 100);

  return {
    get active() {
      return active;
    },
    peek: () => measurement.result(),
    stop: async () => {
      const reading = measurement.result();
      active = false;
      clear(handle);
      await options.recorder.stop?.();
      return reading;
    },
  };
}
