/**
 * Statistical descriptors of a noise measurement.
 *
 * Acousticians do not describe a place by its average level, and neither should we. The
 * useful numbers are exceedance percentiles:
 *
 * - **L90** — the level exceeded 90 % of the time. This is the *background*: what you hear
 *   when nothing in particular is happening. For "is this place quiet?", L90 is the answer.
 * - **L50** — the median.
 * - **L10** — the level exceeded only 10 % of the time. The *intrusive* level: passing cars,
 *   a door, a dog. A low L90 with a high L10 is a quiet place with interruptions, which is a
 *   very different product from a place that hums constantly.
 *
 * Keeping all three is what lets a listing say something more honest than one number.
 */
export interface LevelStats {
    /** Level exceeded 10 % of the time — the intrusive events. */
    l10: number;
    /** Median level. */
    l50: number;
    /** Level exceeded 90 % of the time — the background. */
    l90: number;
    /** Equivalent continuous level: the energy average, not the arithmetic one. */
    leq: number;
    min: number;
    max: number;
    /** How many level samples the statistics were computed from. */
    count: number;
}
/**
 * Exceedance percentile: `percentile(levels, 90)` is the level exceeded 90 % of the time,
 * i.e. a LOW value. This is the acoustics convention and it is the inverse of the ordinary
 * statistical percentile — worth being explicit about, because getting it backwards silently
 * turns a quiet reading into a loud one.
 */
export declare function exceedance(levels: readonly number[], percent: number): number;
/**
 * Equivalent continuous level: the average of the *energy*, converted back to dB.
 *
 * Averaging decibels arithmetically is wrong — they are logarithmic — and it understates
 * the effect of short loud events, which is exactly what a guest complains about.
 */
export declare function leq(levels: readonly number[]): number;
export declare function summarise(levels: readonly number[]): LevelStats;
//# sourceMappingURL=stats.d.ts.map