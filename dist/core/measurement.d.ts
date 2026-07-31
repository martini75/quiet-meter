/**
 * A measurement session: collect level samples over time, then produce one reading.
 *
 * The session accepts levels two ways, because the platforms genuinely differ:
 *
 * - `pushFrame` — raw PCM, which the browser gives us. We compute the level ourselves.
 * - `pushLevel` — a dBFS level the platform already computed, which is all Expo's recorder
 *   metering exposes. Less trustworthy, and the provenance records that.
 *
 * Anything that can supply either can drive this, which is what keeps the core free of
 * platform APIs.
 */
import { type LevelStats } from "./stats";
import { type Calibration, type DeviceInfo, type Provenance } from "./provenance";
import { type QuietScore } from "./score";
export declare const LIBRARY_ID = "quiet-meter@0.1.0";
export interface QuietReading {
    /** The comparable number a listing shows. */
    score: QuietScore;
    /** Device-relative statistics. Always present. */
    dbfs: LevelStats;
    /**
     * Absolute statistics in dB SPL. **Null unless the session was calibrated** — this is the
     * guarantee the whole package exists to make.
     */
    spl: LevelStats | null;
    provenance: Provenance;
}
export interface MeasurementOptions {
    device: DeviceInfo;
    /** Supply to obtain dB SPL. Omit and the reading stays device-relative. */
    calibration?: Calibration;
    /** Injected so the core stays deterministic and testable. */
    now?: () => number;
}
export declare class QuietMeasurement {
    private readonly options;
    private readonly levels;
    private readonly now;
    private readonly startedAtMs;
    private readonly startedAtIso;
    private sampleRateHz?;
    private sawFrames;
    private sawPlatformLevels;
    constructor(options: MeasurementOptions);
    /**
     * Feed raw normalised (-1..1) PCM. The level is computed here.
     * Returns that level in dBFS, so a live readout does not have to recompute it.
     */
    pushFrame(samples: Float32Array, sampleRate: number): number;
    /** Feed a dBFS level the platform already computed. Returns it unchanged, for symmetry. */
    pushLevel(dbfs: number): number;
    get sampleCount(): number;
    get elapsedMs(): number;
    /** Finish and produce the reading. The session can keep collecting afterwards. */
    result(): QuietReading;
}
//# sourceMappingURL=measurement.d.ts.map