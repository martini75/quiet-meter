# quiet-meter

Measure how quiet a place is, and be honest about how much the number is worth.

Built for [Silenci](https://silenci.app), where verified quiet is the product, but the core has
no dependencies and no platform APIs — it is meant to be reused.

```
quiet-meter          platform-free core: signal, statistics, scoring, provenance
quiet-meter/web      Web Audio API capture
quiet-meter/expo     Expo / React Native capture
```

## The problem this package refuses to hide

**An uncalibrated phone microphone cannot report absolute dB SPL.** Response varies by handset
model, by OS version, and by whether the platform quietly applied automatic gain control.
Most "sound level meter" apps print a decibel figure anyway.

This library will not. A reading carries `spl` **only** when a calibration offset was supplied.
Otherwise it carries device-relative `dbfs`, a comparable `score`, and a `provenance` block that
says exactly what was and was not known.

```ts
const reading = measurement.result();

reading.spl;                    // null unless calibrated. Always.
reading.score;                  // { value: 78, basis: "dbfs", margin: 6.4 }
reading.provenance.warnings;    // ["Uncalibrated: levels are device-relative …"]
```

That constraint is the whole reason this is a package rather than a function in an app.

## Why L90 and not the average

A place is not described by its mean level. The library reports exceedance percentiles:

- **L90** — the level exceeded 90 % of the time: the *background*, what you hear when nothing
  is happening. For "is this place quiet?", L90 is the answer, and it is what the score uses.
- **L50** — the median.
- **L10** — exceeded only 10 % of the time: the *intrusive* level. Passing cars, a door, a dog.
- **Leq** — the energy average, which is not the arithmetic average of decibels.

A low L90 with a high L10 is a quiet place with interruptions. That is a different product from
a place that hums constantly, and a single averaged number erases the difference.

## Usage

```ts
import { QuietMeasurement } from "quiet-meter";

const measurement = new QuietMeasurement({
  device: { platform: "web", model: "iPhone 15 Pro" },
  // Omit `calibration` and the reading stays device-relative — by design.
  calibration: { offsetDb: 100, source: "reference-meter", marginDb: 2 },
});

// Raw PCM (browser), or…
measurement.pushFrame(float32Samples, 48_000);
// …a level the platform already computed (Expo metering).
measurement.pushLevel(-58.2);

const reading = measurement.result();
```

Anything that can supply either raw frames or dBFS levels can drive the core. That is what keeps
platform code out of it.

## Calibration

`offsetDb` is added to dBFS to obtain dB SPL. Three sources, in descending order of trust:

| Source | What it means | Typical margin |
|---|---|---|
| `reference-meter` | Compared against a class 1/2 sound level meter, same place, same time | 2-4 dB |
| `device-profile` | A stored offset for this handset model, derived from such a session | 4-6 dB |
| `user-supplied` | Someone typed a number | 8 dB+ |

Method uncertainty (3 dB for raw frames, 6 dB for platform metering) combines with the
calibration margin **in quadrature**, and propagates through the scoring curve so the score
carries its own error bar. A score of 72 ± 9 should never be printed as "72".

## Scoring

0-100, higher is quieter, derived from the background level.

- **Calibrated** → anchored to dB SPL against published references: the WHO night guideline at
  40 dB(A), a quiet rural night near 25-30, conversation around 60.
- **Uncalibrated** → anchored to dBFS. Comparable between readings **taken the same way on the
  same device**, and nothing further. `score.basis` says which, so a consumer can refuse to
  compare across devices.

## Status

Core is implemented and tested. The `web` and `expo` adapters are next; the core API was shaped
around what each platform can actually deliver — the browser gives raw PCM, Expo's recorder gives
only a metering level, which is why both input paths exist.

## Tests

```
bun test
```

22 tests covering the signal maths against published references (A-weighting is checked at
100 Hz, 1 kHz and 4 kHz), the exceedance convention (L90 must come out *lower* than L10 — getting
that backwards silently turns a quiet reading into a loud one), uncertainty propagation, and the
guarantee that `spl` is null without calibration.
