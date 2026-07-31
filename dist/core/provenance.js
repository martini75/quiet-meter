/**
 * Where a reading came from, and how much to trust it.
 *
 * The whole reason this library exists as a separate package is that an uncalibrated phone
 * microphone **cannot** report absolute dB SPL. Response varies by handset model, by OS
 * version, and by whether the platform applied automatic gain control behind your back.
 *
 * So the rule enforced here: a reading carries dB SPL **only** when a calibration offset is
 * present. Otherwise it carries device-relative dBFS and a comparable score, and says so.
 * A number presented as "27 dB" that came from an uncalibrated phone is not a measurement,
 * it is a decoration — and it is the first thing a technical reviewer will pull on.
 */
/** Uncertainty of the capture method itself, before any calibration uncertainty. */
const METHOD_MARGIN_DB = {
    // Raw frames: we control the maths, so the error is dominated by the transducer.
    "raw-frames": 3,
    // Platform metering: the OS computed the level with an algorithm it does not document.
    "platform-metering": 6,
};
/** Below this, a reading says more about the moment than about the place. */
export const MIN_REPRESENTATIVE_MS = 30_000;
export function buildProvenance(input) {
    const warnings = [];
    const methodMargin = METHOD_MARGIN_DB[input.method];
    const calibrationMargin = input.calibration?.marginDb ?? 0;
    // Independent uncertainties add in quadrature, not linearly.
    const marginDb = input.calibration
        ? Math.round(Math.sqrt(methodMargin ** 2 + calibrationMargin ** 2) * 10) / 10
        : methodMargin;
    if (!input.calibration) {
        warnings.push("Uncalibrated: levels are device-relative (dBFS) and cannot be reported as dB SPL.");
    }
    if (input.durationMs < MIN_REPRESENTATIVE_MS) {
        warnings.push(`Short measurement (${Math.round(input.durationMs / 1000)}s): background level is unreliable below ${MIN_REPRESENTATIVE_MS / 1000}s.`);
    }
    if (input.device.agcSuspected) {
        warnings.push("Automatic gain control could not be disabled: quiet passages may be amplified toward the mean.");
    }
    if (input.samples < 10) {
        warnings.push("Too few level samples for meaningful percentiles.");
    }
    return {
        method: input.method,
        calibrated: Boolean(input.calibration),
        calibration: input.calibration,
        marginDb,
        device: input.device,
        sampleRateHz: input.sampleRateHz,
        durationMs: input.durationMs,
        samples: input.samples,
        startedAt: input.startedAt,
        library: input.library,
        warnings,
    };
}
