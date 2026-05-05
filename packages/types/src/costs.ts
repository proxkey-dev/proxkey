/**
 * GitHub Actions runner pricing.
 *
 * Source of truth for converting (runner label, duration) → integer cents.
 * All money is integer cents.
 */

const SECONDS_PER_MINUTE = 60;

/**
 * Per-minute pricing in tenths of a cent (so we can multiply by integer
 * minutes and stay in integer math, avoiding floating-point drift).
 *
 *   8  tenths = 0.8 cents/min  (ubuntu-latest)
 *   16 tenths = 1.6 cents/min
 *   80 tenths = 8.0 cents/min
 *  120 tenths = 12.0 cents/min
 */
const RUNNER_RATE_TENTHS_PER_MINUTE: Readonly<Record<string, number>> = {
  // Standard Ubuntu (2 vCPU)
  "ubuntu-latest": 8,
  "ubuntu-22.04": 8,
  "ubuntu-20.04": 8,

  // Larger Ubuntu runners
  "ubuntu-4-core": 16,
  "ubuntu-8-core": 32,
  "ubuntu-16-core": 64,

  // Windows
  "windows-latest": 16,
  "windows-2022": 16,

  // macOS standard
  "macos-latest": 80,
  "macos-14": 80,
  "macos-13": 80,

  // macOS xlarge
  "macos-13-xlarge": 120,
  "macos-14-xlarge": 120,

  // Self-hosted runners cannot be priced from GitHub's table.
  "self-hosted": 0,
};

/** Runner labels we recognise. */
export type KnownRunnerLabel = keyof typeof RUNNER_RATE_TENTHS_PER_MINUTE;

/**
 * Returns true if we have a price for this exact runner label.
 *
 * Self-hosted is included because we _know_ we cannot price it
 * (rate = 0 cents) — distinct from "unknown label", which we treat
 * as ubuntu-latest below.
 */
export function isKnownRunner(label: string): label is KnownRunnerLabel {
  return Object.prototype.hasOwnProperty.call(
    RUNNER_RATE_TENTHS_PER_MINUTE,
    label,
  );
}

/**
 * Pick the most specific known label out of a list of runner labels
 * (workflow_job.labels can include ["self-hosted", "linux", "x64", ...]).
 *
 * Order of preference:
 *   1. Any explicit known label.
 *   2. self-hosted if present (priced at 0).
 *   3. fallback to "ubuntu-latest" (sane default for unknown OSS runners).
 */
export function pickRunnerLabel(labels: readonly string[]): string {
  if (labels.length === 0) {
    return "ubuntu-latest";
  }

  const lowered = labels.map((label) => label.toLowerCase().trim());

  // Largest/most-expensive labels first so a job advertising both
  // "macos-14" and "macos-14-xlarge" is priced at the xlarge rate.
  const PRIORITY: readonly string[] = [
    "macos-14-xlarge",
    "macos-13-xlarge",
    "macos-14",
    "macos-13",
    "macos-latest",
    "ubuntu-16-core",
    "ubuntu-8-core",
    "ubuntu-4-core",
    "windows-2022",
    "windows-latest",
    "ubuntu-22.04",
    "ubuntu-20.04",
    "ubuntu-latest",
    "self-hosted",
  ];

  for (const candidate of PRIORITY) {
    if (lowered.includes(candidate)) {
      return candidate;
    }
  }

  return "ubuntu-latest";
}

/**
 * Calculate the integer-cent cost of a single CI job.
 *
 * - durationSeconds is rounded UP to the nearest whole minute (this is
 *   how GitHub bills its hosted runners).
 * - Self-hosted runners always return 0 (we cannot price them).
 * - Unknown runner labels fall back to ubuntu-latest pricing so we still
 *   produce something useful instead of silently dropping spend.
 *
 * Returns an integer number of cents.
 */
export function calculateJobCost(
  runnerLabel: string,
  durationSeconds: number,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  const normalized = runnerLabel.toLowerCase().trim();
  const rateTenths =
    RUNNER_RATE_TENTHS_PER_MINUTE[normalized] ??
    RUNNER_RATE_TENTHS_PER_MINUTE["ubuntu-latest"]!;

  if (rateTenths === 0) {
    return 0;
  }

  const billedMinutes = Math.ceil(durationSeconds / SECONDS_PER_MINUTE);
  const totalTenths = billedMinutes * rateTenths;

  // Round UP to integer cents — same direction as the carrier rounds.
  return Math.ceil(totalTenths / 10);
}

/**
 * Variant that takes the full label array straight off `workflow_job.labels`.
 */
export function calculateJobCostFromLabels(
  labels: readonly string[],
  durationSeconds: number,
): number {
  return calculateJobCost(pickRunnerLabel(labels), durationSeconds);
}

export const COST_TABLE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(RUNNER_RATE_TENTHS_PER_MINUTE).map(([label, tenths]) => [
      label,
      tenths / 10,
    ]),
  ),
);
