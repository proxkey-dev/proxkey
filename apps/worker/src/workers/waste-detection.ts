/**
 * Pure waste-flag detection. Kept free of Prisma so it stays easy to
 * unit-test. The attribute-build worker is responsible for loading data
 * and persisting findings.
 *
 * Rules — straight from the spec:
 *
 *  - DOCS_ONLY_TRIGGER: every changed file matches docs patterns
 *    AND the build ran > 1 job AND total spend > 50 cents.
 *    savings = build.costCents
 *
 *  - OVERSIZED_RUNNER: any job on macos-latest or windows-latest with
 *    durationSeconds < 120.
 *    savings = job.costCents * 0.5
 *
 *  - REDUNDANT_MATRIX: same job name ran > 3 times in this build with
 *    identical conclusion.
 *    savings = (count - 1) * avgJobCost
 *
 *  - CACHE_MISS_CHURN: job name contains "cache" AND failure rate > 60%
 *    over the last 10 runs of jobs by that name in the repo.
 *    savings = avgCostCents * failureRate * 30
 */

import { WasteFlagType } from "@proxkey/db";

export interface WasteFinding {
  flagType: WasteFlagType;
  savingsEstimateCents: number;
  details: Record<string, unknown>;
  /** Pointer to the specific job that triggered the flag (when applicable). */
  anchorJobName?: string;
}

export interface WasteJobInput {
  id: string;
  name: string;
  conclusion: string | null;
  durationSeconds: number | null;
  costCents: number;
  /** Comma-joined raw labels; lower-cased downstream. */
  runnerLabels: string;
}

export interface WasteHistoryEntry {
  jobName: string;
  conclusion: string | null;
}

export interface WasteDetectionInput {
  buildCostCents: number;
  changedFiles: readonly string[];
  jobs: readonly WasteJobInput[];
  /** Last N runs (per cache-named job name) for this repo. */
  recentJobHistoryByName: ReadonlyMap<string, readonly WasteHistoryEntry[]>;
}

const DOCS_PATTERNS: ReadonlyArray<RegExp> = [
  /\.md$/i,
  /^docs\//i,
  /\.txt$/i,
  /\.rst$/i,
  /^license$/i,
  /^license\..*/i,
  /^changelog$/i,
  /^changelog\..*/i,
];

function isDocsOnly(path: string): boolean {
  const trimmed = path.trim();
  if (trimmed.length === 0) return false;
  return DOCS_PATTERNS.some((re) => re.test(trimmed));
}

function detectDocsOnly(input: WasteDetectionInput): WasteFinding | null {
  if (input.changedFiles.length === 0) return null;
  if (!input.changedFiles.every(isDocsOnly)) return null;
  if (input.jobs.length <= 1) return null;
  if (input.buildCostCents <= 50) return null;
  return {
    flagType: WasteFlagType.DOCS_ONLY_TRIGGER,
    savingsEstimateCents: input.buildCostCents,
    details: {
      changedFiles: input.changedFiles.slice(0, 50),
      jobCount: input.jobs.length,
    },
  };
}

function detectOversizedRunner(input: WasteDetectionInput): WasteFinding[] {
  const findings: WasteFinding[] = [];
  for (const job of input.jobs) {
    const labels = job.runnerLabels.toLowerCase();
    const isLargeMac = labels.includes("macos-latest");
    const isLargeWin = labels.includes("windows-latest");
    if (!(isLargeMac || isLargeWin)) continue;
    if (job.durationSeconds === null || job.durationSeconds >= 120) continue;
    findings.push({
      flagType: WasteFlagType.OVERSIZED_RUNNER,
      savingsEstimateCents: Math.max(1, Math.round(job.costCents * 0.5)),
      details: {
        jobName: job.name,
        durationSeconds: job.durationSeconds,
        runner: isLargeMac ? "macos-latest" : "windows-latest",
        costCents: job.costCents,
      },
      anchorJobName: job.name,
    });
  }
  return findings;
}

function detectRedundantMatrix(input: WasteDetectionInput): WasteFinding[] {
  const findings: WasteFinding[] = [];
  // Group by (name, conclusion). > 3 with identical conclusion qualifies.
  const groups = new Map<
    string,
    { name: string; conclusion: string | null; jobs: WasteJobInput[] }
  >();
  for (const job of input.jobs) {
    const key = `${job.name}::${job.conclusion ?? "null"}`;
    const g = groups.get(key) ?? {
      name: job.name,
      conclusion: job.conclusion,
      jobs: [],
    };
    g.jobs.push(job);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    if (g.jobs.length <= 3) continue;
    const totalCost = g.jobs.reduce((s, j) => s + j.costCents, 0);
    const avgCost = Math.round(totalCost / g.jobs.length);
    findings.push({
      flagType: WasteFlagType.REDUNDANT_MATRIX,
      savingsEstimateCents: Math.max(1, (g.jobs.length - 1) * avgCost),
      details: {
        jobName: g.name,
        conclusion: g.conclusion,
        count: g.jobs.length,
        avgCostCents: avgCost,
      },
      anchorJobName: g.name,
    });
  }
  return findings;
}

function detectCacheMissChurn(input: WasteDetectionInput): WasteFinding[] {
  const findings: WasteFinding[] = [];
  for (const job of input.jobs) {
    if (!job.name.toLowerCase().includes("cache")) continue;
    const history = input.recentJobHistoryByName.get(job.name);
    if (!history || history.length === 0) continue;
    const last10 = history.slice(0, 10);
    const failures = last10.filter((h) => {
      const c = (h.conclusion ?? "").toLowerCase();
      return c === "failure" || c === "cancelled" || c === "timed_out";
    }).length;
    const failureRate = failures / last10.length;
    if (failureRate <= 0.6) continue;
    findings.push({
      flagType: WasteFlagType.CACHE_MISS_CHURN,
      savingsEstimateCents: Math.max(
        1,
        Math.round(job.costCents * failureRate * 30),
      ),
      details: {
        jobName: job.name,
        windowSize: last10.length,
        failures,
        failureRate: Number(failureRate.toFixed(2)),
        avgCostCents: job.costCents,
      },
      anchorJobName: job.name,
    });
  }
  return findings;
}

export function detectWasteFlags(
  input: WasteDetectionInput,
): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const docsOnly = detectDocsOnly(input);
  if (docsOnly) findings.push(docsOnly);
  findings.push(...detectOversizedRunner(input));
  findings.push(...detectRedundantMatrix(input));
  findings.push(...detectCacheMissChurn(input));
  return findings;
}
