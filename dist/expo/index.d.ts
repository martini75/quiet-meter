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
import { type Calibration, type DeviceInfo, type QuietReading } from "../core";
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
    device: Omit<DeviceInfo, "platform"> & {
        platform?: "ios" | "android";
    };
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
export declare function isPlausibleLevel(level: number | null | undefined): level is number;
/** Start a metering-driven measurement. */
export declare function startExpoCapture(options: ExpoCaptureOptions): ExpoCaptureSession;
//# sourceMappingURL=index.d.ts.map