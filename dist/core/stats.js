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
/**
 * Exceedance percentile: `percentile(levels, 90)` is the level exceeded 90 % of the time,
 * i.e. a LOW value. This is the acoustics convention and it is the inverse of the ordinary
 * statistical percentile — worth being explicit about, because getting it backwards silently
 * turns a quiet reading into a loud one.
 */
export function exceedance(levels, percent) {
    if (levels.length === 0)
        return Number.NaN;
    const sorted = [...levels].sort((a, b) => a - b);
    // Exceeded `percent` % of the time -> the (100 - percent) th ordinary percentile.
    const rank = ((100 - percent) / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high)
        return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}
/**
 * Equivalent continuous level: the average of the *energy*, converted back to dB.
 *
 * Averaging decibels arithmetically is wrong — they are logarithmic — and it understates
 * the effect of short loud events, which is exactly what a guest complains about.
 */
export function leq(levels) {
    if (levels.length === 0)
        return Number.NaN;
    let energy = 0;
    for (const level of levels)
        energy += 10 ** (level / 10);
    return 10 * Math.log10(energy / levels.length);
}
export function summarise(levels) {
    if (levels.length === 0) {
        return { l10: Number.NaN, l50: Number.NaN, l90: Number.NaN, leq: Number.NaN, min: Number.NaN, max: Number.NaN, count: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const level of levels) {
        if (level < min)
            min = level;
        if (level > max)
            max = level;
    }
    return {
        l10: exceedance(levels, 10),
        l50: exceedance(levels, 50),
        l90: exceedance(levels, 90),
        leq: leq(levels),
        min,
        max,
        count: levels.length,
    };
}
