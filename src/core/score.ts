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

/** dB SPL anchors: [level, score]. Interpolated between, clamped outside. */
const SPL_CURVE: ReadonlyArray<readonly [number, number]> = [
  [20, 100], // anechoic-quiet; effectively unmeasurable by phone
  [25, 95], // remote rural night
  [30, 85], // very quiet rural
  [35, 72], // quiet room at night
  [40, 60], // WHO night noise guideline
  [45, 45], // audible constant background
  [50, 30], // quiet office / distant traffic
  [55, 18],
  [60, 8], // conversation level
  [70, 0], // busy street
];

/**
 * dBFS anchors. These map a device-relative background level onto the same 0-100 range.
 * They are a convention, not physics: their only job is to rank readings taken the same way.
 */
const DBFS_CURVE: ReadonlyArray<readonly [number, number]> = [
  [-80, 100],
  [-70, 92],
  [-60, 80],
  [-55, 68],
  [-50, 55],
  [-45, 42],
  [-40, 30],
  [-35, 18],
  [-30, 8],
  [-20, 0],
];

function interpolate(curve: ReadonlyArray<readonly [number, number]>, level: number): number {
  if (Number.isNaN(level)) return Number.NaN;
  if (level <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (level >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (level <= x1) {
      const [x0, y0] = curve[i - 1];
      const t = (level - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

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
export function scoreFromBackground(level: number, provenance: Provenance): QuietScore {
  const basis = provenance.calibrated ? "spl" : "dbfs";
  const curve = basis === "spl" ? SPL_CURVE : DBFS_CURVE;
  const value = interpolate(curve, level);

  // Propagate the level margin through the local slope of the curve, so the score's
  // uncertainty reflects how steep the scale is at that point.
  const delta = provenance.marginDb;
  const high = interpolate(curve, level - delta);
  const low = interpolate(curve, level + delta);
  const margin = Math.abs(high - low) / 2;

  return {
    value: Math.round(value),
    basis,
    margin: Math.round(margin * 10) / 10,
  };
}

/**
 * How to present a score honestly in one line.
 * Deliberately never renders an absolute decibel figure for an uncalibrated reading.
 */
export function describeScore(score: QuietScore): string {
  const range = `${score.value} ± ${score.margin}`;
  return score.basis === "spl"
    ? `${range} / 100 (calibrated)`
    : `${range} / 100 (device-relative — not comparable across devices)`;
}
