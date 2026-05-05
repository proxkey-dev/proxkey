import { WasteFlagType } from "@proxkey/db";
import { describe, expect, it } from "vitest";
import {
  detectWasteFlags,
  type WasteHistoryEntry,
  type WasteJobInput,
} from "./waste-detection.js";

function job(
  overrides: Partial<WasteJobInput> & { name: string },
): WasteJobInput {
  return {
    id: overrides.id ?? `id-${overrides.name}-${String(Math.random())}`,
    name: overrides.name,
    conclusion: overrides.conclusion ?? "SUCCESS",
    durationSeconds: overrides.durationSeconds ?? 300,
    costCents: overrides.costCents ?? 100,
    runnerLabels: overrides.runnerLabels ?? "ubuntu-latest",
  };
}

describe("DOCS_ONLY_TRIGGER", () => {
  it("fires when all changed files are docs and >1 job + spend > 50c", () => {
    const findings = detectWasteFlags({
      buildCostCents: 200,
      changedFiles: ["README.md", "docs/index.md", "LICENSE", "CHANGELOG.md"],
      jobs: [job({ name: "build" }), job({ name: "test" })],
      recentJobHistoryByName: new Map(),
    });
    const docs = findings.find(
      (f) => f.flagType === WasteFlagType.DOCS_ONLY_TRIGGER,
    );
    expect(docs).toBeDefined();
    expect(docs?.savingsEstimateCents).toBe(200);
  });

  it("does not fire when any non-docs file is touched", () => {
    const findings = detectWasteFlags({
      buildCostCents: 200,
      changedFiles: ["README.md", "src/server.ts"],
      jobs: [job({ name: "build" }), job({ name: "test" })],
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.DOCS_ONLY_TRIGGER),
    ).toBeUndefined();
  });

  it("does not fire when total cost is too small (<=50c)", () => {
    const findings = detectWasteFlags({
      buildCostCents: 30,
      changedFiles: ["README.md"],
      jobs: [job({ name: "a" }), job({ name: "b" })],
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.DOCS_ONLY_TRIGGER),
    ).toBeUndefined();
  });

  it("does not fire when only one job ran", () => {
    const findings = detectWasteFlags({
      buildCostCents: 200,
      changedFiles: ["README.md"],
      jobs: [job({ name: "a" })],
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.DOCS_ONLY_TRIGGER),
    ).toBeUndefined();
  });
});

describe("OVERSIZED_RUNNER", () => {
  it("fires for short macos-latest jobs", () => {
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [
        job({
          name: "lint",
          runnerLabels: "macos-latest",
          durationSeconds: 60,
          costCents: 80,
        }),
      ],
      recentJobHistoryByName: new Map(),
    });
    const oversized = findings.find(
      (f) => f.flagType === WasteFlagType.OVERSIZED_RUNNER,
    );
    expect(oversized).toBeDefined();
    expect(oversized?.savingsEstimateCents).toBe(40);
  });

  it("does not fire when duration >= 120s", () => {
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [
        job({
          name: "lint",
          runnerLabels: "macos-latest",
          durationSeconds: 120,
        }),
      ],
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.OVERSIZED_RUNNER),
    ).toBeUndefined();
  });

  it("does not fire on ubuntu-latest", () => {
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [
        job({
          name: "lint",
          runnerLabels: "ubuntu-latest",
          durationSeconds: 30,
        }),
      ],
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.OVERSIZED_RUNNER),
    ).toBeUndefined();
  });
});

describe("REDUNDANT_MATRIX", () => {
  it("fires when 4+ identical jobs ran", () => {
    const jobs: WasteJobInput[] = [
      job({ name: "test", costCents: 100 }),
      job({ name: "test", costCents: 100 }),
      job({ name: "test", costCents: 100 }),
      job({ name: "test", costCents: 100 }),
    ];
    const findings = detectWasteFlags({
      buildCostCents: 400,
      changedFiles: [],
      jobs,
      recentJobHistoryByName: new Map(),
    });
    const redundant = findings.find(
      (f) => f.flagType === WasteFlagType.REDUNDANT_MATRIX,
    );
    expect(redundant).toBeDefined();
    // (count - 1) * avgJobCost = 3 * 100
    expect(redundant?.savingsEstimateCents).toBe(300);
  });

  it("does not fire at exactly 3 jobs", () => {
    const jobs = [
      job({ name: "test" }),
      job({ name: "test" }),
      job({ name: "test" }),
    ];
    const findings = detectWasteFlags({
      buildCostCents: 300,
      changedFiles: [],
      jobs,
      recentJobHistoryByName: new Map(),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.REDUNDANT_MATRIX),
    ).toBeUndefined();
  });
});

describe("CACHE_MISS_CHURN", () => {
  it("fires when failure rate > 60% over last 10 runs", () => {
    const history: WasteHistoryEntry[] = [
      ...Array(7)
        .fill(null)
        .map(() => ({ jobName: "cache-build", conclusion: "FAILURE" })),
      ...Array(3)
        .fill(null)
        .map(() => ({ jobName: "cache-build", conclusion: "SUCCESS" })),
    ];
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [job({ name: "cache-build", costCents: 100 })],
      recentJobHistoryByName: new Map([["cache-build", history]]),
    });
    const cache = findings.find(
      (f) => f.flagType === WasteFlagType.CACHE_MISS_CHURN,
    );
    expect(cache).toBeDefined();
    expect(cache?.savingsEstimateCents).toBeGreaterThan(0);
  });

  it("does not fire at exactly 60% failure rate", () => {
    const history: WasteHistoryEntry[] = [
      ...Array(6)
        .fill(null)
        .map(() => ({ jobName: "cache-x", conclusion: "FAILURE" })),
      ...Array(4)
        .fill(null)
        .map(() => ({ jobName: "cache-x", conclusion: "SUCCESS" })),
    ];
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [job({ name: "cache-x" })],
      recentJobHistoryByName: new Map([["cache-x", history]]),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.CACHE_MISS_CHURN),
    ).toBeUndefined();
  });

  it("does not fire on jobs without 'cache' in the name", () => {
    const findings = detectWasteFlags({
      buildCostCents: 100,
      changedFiles: [],
      jobs: [job({ name: "build" })],
      recentJobHistoryByName: new Map([
        [
          "build",
          Array(10)
            .fill(null)
            .map(() => ({ jobName: "build", conclusion: "FAILURE" })),
        ],
      ]),
    });
    expect(
      findings.find((f) => f.flagType === WasteFlagType.CACHE_MISS_CHURN),
    ).toBeUndefined();
  });
});
