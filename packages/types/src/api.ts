/**
 * Wire-level types for the public REST API. These are the shapes
 * the dashboard frontend consumes — keep them stable.
 */

export interface ApiError {
  error: string;
  code: string;
}

export interface AuthMe {
  id: string;
  email: string;
  name: string;
  orgs: Array<{ id: string; name: string; role: string }>;
}

export interface SpendSummary {
  thisMonthCents: number;
  lastMonthCents: number;
  weeklyTrend: Array<{ week: string; cents: number }>;
}

export type SpendBreakdownGroupBy = "repo" | "author" | "workflow";
export type SpendPeriod = "7d" | "30d" | "90d";

export interface SpendBreakdownRow {
  label: string;
  costCents: number;
  buildCount: number;
  avgCostCents: number;
  deltaPercent: number;
}

export interface SpendBreakdown {
  rows: SpendBreakdownRow[];
}

export interface BuildSummary {
  id: string;
  externalId: string;
  branch: string;
  prNumber: number | null;
  triggeredBy: string | null;
  status: string;
  conclusion: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  costCents: number;
  jobCount: number;
  wasteFlagCount: number;
  repo: { id: string; name: string };
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  limit: number;
  total: number;
}

export interface RepoWithSpend {
  id: string;
  name: string;
  defaultBranch: string;
  monthlySpendCents: number;
  buildCount: number;
  wasteFlagCount: number;
}

export interface RepoSpendSeries {
  buckets: Array<{ date: string; costCents: number; buildCount: number }>;
}

export interface WasteFlagDto {
  id: string;
  type: string;
  status: string;
  savingsEstimateCents: number;
  recommendation: string;
  evidence: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  repo: { id: string; name: string };
  build: {
    id: string;
    branch: string;
    prNumber: number | null;
    costCents: number;
  } | null;
}

export interface FlakyTestDto {
  testName: string;
  suite: string;
  repoName: string;
  flakyCount30d: number;
  estimatedWasteCents: number;
  lastSeen: string;
}
