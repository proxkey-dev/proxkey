import { describe, expect, it } from "vitest";
import {
  calculateJobCost,
  calculateJobCostFromLabels,
  pickRunnerLabel,
} from "./costs.js";

describe("calculateJobCost", () => {
  it("rounds duration UP to the nearest minute", () => {
    expect(calculateJobCost("ubuntu-latest", 1)).toBe(1);
    expect(calculateJobCost("ubuntu-latest", 60)).toBe(1);
    expect(calculateJobCost("ubuntu-latest", 61)).toBe(2);
    expect(calculateJobCost("ubuntu-latest", 119)).toBe(2);
    expect(calculateJobCost("ubuntu-latest", 120)).toBe(2);
  });

  it("prices ubuntu-latest at 0.8 cents/min (5 min = 4c)", () => {
    expect(calculateJobCost("ubuntu-latest", 300)).toBe(4);
  });

  it("prices windows-latest at 1.6 cents/min", () => {
    expect(calculateJobCost("windows-latest", 60)).toBe(2);
    expect(calculateJobCost("windows-latest", 600)).toBe(16);
  });

  it("prices macos-latest at 8.0 cents/min", () => {
    expect(calculateJobCost("macos-latest", 60)).toBe(8);
    expect(calculateJobCost("macos-latest", 600)).toBe(80);
  });

  it("prices macos xlarge at 12.0 cents/min", () => {
    expect(calculateJobCost("macos-14-xlarge", 60)).toBe(12);
    expect(calculateJobCost("macos-13-xlarge", 600)).toBe(120);
  });

  it("prices ubuntu-4-core at 1.6 cents/min", () => {
    expect(calculateJobCost("ubuntu-4-core", 60)).toBe(2);
  });

  it("prices ubuntu-8-core at 3.2 cents/min", () => {
    expect(calculateJobCost("ubuntu-8-core", 60)).toBe(4);
    expect(calculateJobCost("ubuntu-8-core", 600)).toBe(32);
  });

  it("prices ubuntu-16-core at 6.4 cents/min", () => {
    expect(calculateJobCost("ubuntu-16-core", 60)).toBe(7);
    expect(calculateJobCost("ubuntu-16-core", 600)).toBe(64);
  });

  it("returns 0 for self-hosted", () => {
    expect(calculateJobCost("self-hosted", 600)).toBe(0);
  });

  it("returns 0 for non-positive duration", () => {
    expect(calculateJobCost("ubuntu-latest", 0)).toBe(0);
    expect(calculateJobCost("ubuntu-latest", -10)).toBe(0);
  });

  it("falls back to ubuntu pricing for unknown labels", () => {
    expect(calculateJobCost("totally-fake-runner", 60)).toBe(1);
  });

  it("is case insensitive on the label", () => {
    expect(calculateJobCost("Ubuntu-Latest", 60)).toBe(1);
  });
});

describe("pickRunnerLabel", () => {
  it("returns the most specific known label", () => {
    expect(pickRunnerLabel(["self-hosted", "linux", "x64", "macos-14-xlarge"])).toBe(
      "macos-14-xlarge",
    );
    expect(pickRunnerLabel(["ubuntu-latest", "self-hosted"])).toBe(
      "ubuntu-latest",
    );
  });

  it("falls back to ubuntu-latest for empty arrays", () => {
    expect(pickRunnerLabel([])).toBe("ubuntu-latest");
  });

  it("recognizes self-hosted when no other label matches", () => {
    expect(pickRunnerLabel(["self-hosted", "linux", "arm64"])).toBe(
      "self-hosted",
    );
  });
});

describe("calculateJobCostFromLabels", () => {
  it("composes pickRunnerLabel + calculateJobCost", () => {
    expect(
      calculateJobCostFromLabels(["self-hosted", "linux"], 600),
    ).toBe(0);
    expect(
      calculateJobCostFromLabels(["macos-latest"], 60),
    ).toBe(8);
  });
});
