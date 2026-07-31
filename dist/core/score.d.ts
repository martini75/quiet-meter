/**
 * Turning a background level into the single comparable number a listing shows.
 *
 * The score is 0-100, higher is quieter. It is deliberately derived from **L90** (the
 * background), not from the average: a place with a low background and occasional passing
 * traffic is a quiet place, and averaging hides that.
 *
 * Two scales, because there are two honest situations:
 *
 * - **Calibrated** → score from dB SPL against published thresholds. The WHO night guideline
 *   sits at 40 dB(A) outside a bedroom, a quiet rural night is nearer 25-30, and normal
 *   conversation is around 60. Those anchor the curve.
 * - **Uncalibrated** → score from dBFS. Comparable between readings **taken the same way on
 *   the same device**, and nothing more. Cross-device comparison of uncalibrated scores is
 *   not supported and the provenance says so.
 */
import type { Provenance } from "./provenance";
export interface QuietScore {
    /** 0-100, higher is quieter. */
    value: number;
    /** Which scale produced it — never compare `dbfs`-based scores across devices. */
    basis: "spl" | "dbfs";
    /**
     * Half-width of the score's own error bar, propagated from the level uncertainty.
     * A score of 72 ± 9 should not be printed as "72".
     */
    margin: number;
}
/** Score a background level. `level` is dB SPL when calibrated, dBFS otherwise. */
export declare function scoreFromBackground(level: number, provenance: Provenance): QuietScore;
/**
 * How to present a score honestly in one line.
 * Deliberately never renders an absolute decibel figure for an uncalibrated reading.
 */
export declare function describeScore(score: QuietScore): string;
//# sourceMappingURL=score.d.ts.map