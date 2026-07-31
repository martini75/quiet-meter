/**
 * Browser capture, via the Web Audio API.
 *
 * The browser hands us raw PCM, so this adapter feeds `pushFrame` and the core computes the
 * levels itself — the more trustworthy of the two input paths.
 *
 * The important work here is not reading samples. It is **switching off the processing that
 * browsers apply by default**. Echo cancellation, noise suppression and automatic gain control
 * exist to make voice calls pleasant, and all three destroy a measurement: AGC in particular
 * amplifies quiet passages toward the mean, which turns a silent room into an average one.
 *
 * Browsers may ignore those constraints. So the adapter asks, then checks what it actually
 * got, and marks the reading as suspect when the answer is wrong. That flag reaches the
 * provenance and widens nothing silently.
 */
import { type Calibration, type QuietReading } from "../core";
export interface WebCaptureOptions {
    /** Supply to obtain dB SPL. Omit and the reading stays device-relative. */
    calibration?: Calibration;
    /** How often to take a level sample. 100 ms is the usual "fast" time weighting. */
    intervalMs?: number;
    /** Passed to getUserMedia when you need a specific input. */
    deviceId?: string;
    /** Called on every sample, for a live readout. */
    onLevel?: (dbfs: number) => void;
}
export interface WebCaptureSession {
    /** Stop capture, release the microphone, and return the reading. */
    stop(): Promise<QuietReading>;
    /** Reading so far, without stopping. */
    peek(): QuietReading;
    /** True while the microphone is open. */
    readonly active: boolean;
}
/**
 * Open the microphone and start measuring. Resolves once capture is running.
 *
 * @throws if the browser has no microphone permission, or no Web Audio support.
 */
export declare function startWebCapture(options?: WebCaptureOptions): Promise<WebCaptureSession>;
//# sourceMappingURL=index.d.ts.map