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
import { frameDbfs } from "./signal";
import { summarise } from "./stats";
import { buildProvenance } from "./provenance";
import { scoreFromBackground } from "./score";
export const LIBRARY_ID = "quiet-meter@0.1.0";
export class QuietMeasurement {
    options;
    levels = [];
    now;
    startedAtMs;
    startedAtIso;
    sampleRateHz;
    sawFrames = false;
    sawPlatformLevels = false;
    constructor(options) {
        this.options = options;
        this.now = options.now ?? (() => Date.now());
        this.startedAtMs = this.now();
        this.startedAtIso = new Date(this.startedAtMs).toISOString();
    }
    /**
     * Feed raw normalised (-1..1) PCM. The level is computed here.
     * Returns that level in dBFS, so a live readout does not have to recompute it.
     */
    pushFrame(samples, sampleRate) {
        this.sawFrames = true;
        this.sampleRateHz = sampleRate;
        const level = frameDbfs(samples);
        this.levels.push(level);
        return level;
    }
    /** Feed a dBFS level the platform already computed. Returns it unchanged, for symmetry. */
    pushLevel(dbfs) {
        this.sawPlatformLevels = true;
        this.levels.push(dbfs);
        return dbfs;
    }
    get sampleCount() {
        return this.levels.length;
    }
    get elapsedMs() {
        return this.now() - this.startedAtMs;
    }
    /** Finish and produce the reading. The session can keep collecting afterwards. */
    result() {
        const dbfs = summarise(this.levels);
        const calibration = this.options.calibration;
        const provenance = buildProvenance({
            // If both kinds arrived, trust the weaker one when describing the method.
            method: this.sawPlatformLevels || !this.sawFrames ? "platform-metering" : "raw-frames",
            device: this.options.device,
            durationMs: this.elapsedMs,
            samples: this.levels.length,
            startedAt: this.startedAtIso,
            library: LIBRARY_ID,
            sampleRateHz: this.sampleRateHz,
            calibration,
        });
        const spl = calibration ? shift(dbfs, calibration.offsetDb) : null;
        const background = spl ? spl.l90 : dbfs.l90;
        return {
            score: scoreFromBackground(background, provenance),
            dbfs,
            spl,
            provenance,
        };
    }
}
function shift(stats, offsetDb) {
    return {
        l10: stats.l10 + offsetDb,
        l50: stats.l50 + offsetDb,
        l90: stats.l90 + offsetDb,
        leq: stats.leq + offsetDb,
        min: stats.min + offsetDb,
        max: stats.max + offsetDb,
        count: stats.count,
    };
}
