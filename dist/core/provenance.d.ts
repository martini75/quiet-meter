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
export type CalibrationSource = 
/** Compared against a class 1/2 sound level meter, same place, same time. */
"reference-meter"
/** A stored offset for this exact device model, derived from a reference-meter session. */
 | "device-profile"
/** The user typed an offset. Better than nothing, worse than either of the above. */
 | "user-supplied";
export interface Calibration {
    /** Added to dBFS to obtain dB SPL. Typically a positive number around 90-120. */
    offsetDb: number;
    source: CalibrationSource;
    /** Half-width of the error bar, in dB. Never claim better than the method supports. */
    marginDb: number;
    /** ISO date the calibration was established. Old calibrations drift. */
    establishedAt?: string;
}
export interface DeviceInfo {
    platform: "web" | "ios" | "android" | "node" | "unknown";
    /** e.g. "iPhone 15 Pro". Free-form; used to look up a device profile. */
    model?: string;
    os?: string;
    /** True when the capture chain could not disable automatic gain control. */
    agcSuspected?: boolean;
}
export interface Provenance {
    /** How the level samples were obtained. */
    method: "raw-frames" | "platform-metering";
    /** Whether the reading can be expressed in absolute dB SPL at all. */
    calibrated: boolean;
    calibration?: Calibration;
    /** Total uncertainty half-width in dB, calibration and method combined. */
    marginDb: number;
    device: DeviceInfo;
    sampleRateHz?: number;
    /** Wall-clock length of the measurement. Short samples are not representative. */
    durationMs: number;
    /** How many level samples were collected. */
    samples: number;
    startedAt: string;
    library: string;
    /** Anything the caller should know before believing the number. */
    warnings: string[];
}
/** Below this, a reading says more about the moment than about the place. */
export declare const MIN_REPRESENTATIVE_MS = 30000;
export declare function buildProvenance(input: {
    method: Provenance["method"];
    device: DeviceInfo;
    durationMs: number;
    samples: number;
    startedAt: string;
    library: string;
    sampleRateHz?: number;
    calibration?: Calibration;
}): Provenance;
//# sourceMappingURL=provenance.d.ts.map