CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ci_provider" AS ENUM ('github_actions', 'circleci', 'buildkite');
CREATE TYPE "build_conclusion" AS ENUM ('success', 'failure', 'cancelled', 'flaky');
CREATE TYPE "test_result_status" AS ENUM ('pass', 'fail', 'flaky', 'skipped');
CREATE TYPE "waste_flag_type" AS ENUM ('docs_only_trigger', 'always_flaky_test', 'oversized_runner', 'redundant_matrix', 'cache_miss_churn');
CREATE TYPE "waste_flag_status" AS ENUM ('active', 'resolved', 'dismissed');

ALTER TABLE "Organization"
  ADD COLUMN "githubInstallationId" TEXT,
  ADD COLUMN "monthlySpendCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "slackWebhookUrl" TEXT,
  ADD COLUMN "emailDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emailDigestSchedule" TEXT NOT NULL DEFAULT 'Monday 09:00';

CREATE UNIQUE INDEX "Organization_githubInstallationId_key" ON "Organization"("githubInstallationId");

CREATE TABLE "repos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "provider" "ci_provider" NOT NULL,
  "external_id" TEXT NOT NULL,
  "default_branch" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "builds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" "ci_provider" NOT NULL,
  "external_id" TEXT NOT NULL,
  "org_id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "branch" TEXT NOT NULL,
  "pr_number" INTEGER,
  "triggered_by" TEXT,
  "team" TEXT,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "duration_seconds" INTEGER,
  "cost_cents" INTEGER NOT NULL DEFAULT 0,
  "runner_type" TEXT,
  "runner_size" TEXT,
  "conclusion" "build_conclusion",
  "changed_files" JSONB NOT NULL DEFAULT '[]',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "build_id" UUID NOT NULL,
  "external_id" TEXT,
  "name" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "duration_seconds" INTEGER,
  "cost_cents" INTEGER NOT NULL DEFAULT 0,
  "runner_type" TEXT,
  "runner_size" TEXT,
  "conclusion" "build_conclusion",
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "test_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "build_id" UUID NOT NULL,
  "suite" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "test_result_status" NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "flaky_count_30d" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waste_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "repo_id" UUID NOT NULL,
  "build_id" UUID,
  "type" "waste_flag_type" NOT NULL,
  "status" "waste_flag_status" NOT NULL DEFAULT 'active',
  "savings_cents" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recommendation" TEXT NOT NULL,
  "evidence_json" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waste_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repos_provider_external_id_key" ON "repos"("provider", "external_id");
CREATE INDEX "repos_org_id_provider_idx" ON "repos"("org_id", "provider");
CREATE UNIQUE INDEX "builds_provider_external_id_key" ON "builds"("provider", "external_id");
CREATE INDEX "builds_repo_id_started_at_idx" ON "builds"("repo_id", "started_at");
CREATE INDEX "builds_org_id_started_at_idx" ON "builds"("org_id", "started_at");
CREATE INDEX "builds_pr_number_repo_id_idx" ON "builds"("pr_number", "repo_id");
CREATE UNIQUE INDEX "workflow_jobs_build_id_external_id_key" ON "workflow_jobs"("build_id", "external_id");
CREATE INDEX "workflow_jobs_build_id_started_at_idx" ON "workflow_jobs"("build_id", "started_at");
CREATE INDEX "test_results_build_id_suite_idx" ON "test_results"("build_id", "suite");
CREATE INDEX "test_results_name_suite_idx" ON "test_results"("name", "suite");
CREATE UNIQUE INDEX "waste_flags_repo_id_build_id_type_key" ON "waste_flags"("repo_id", "build_id", "type");
CREATE INDEX "waste_flags_org_id_type_status_idx" ON "waste_flags"("org_id", "type", "status");
CREATE INDEX "waste_flags_repo_id_first_seen_at_idx" ON "waste_flags"("repo_id", "first_seen_at");

ALTER TABLE "repos" ADD CONSTRAINT "repos_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builds" ADD CONSTRAINT "builds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builds" ADD CONSTRAINT "builds_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_jobs" ADD CONSTRAINT "workflow_jobs_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_flags" ADD CONSTRAINT "waste_flags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_flags" ADD CONSTRAINT "waste_flags_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_flags" ADD CONSTRAINT "waste_flags_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
