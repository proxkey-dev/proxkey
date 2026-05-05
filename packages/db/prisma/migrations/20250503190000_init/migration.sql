-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GITHUB_ACTIONS', 'CIRCLECI', 'BUILDKITE');

-- CreateEnum
CREATE TYPE "BuildConclusion" AS ENUM ('SUCCESS', 'FAILURE', 'CANCELLED', 'TIMED_OUT', 'FLAKY');

-- CreateEnum
CREATE TYPE "WasteFlagType" AS ENUM ('DOCS_ONLY_TRIGGER', 'ALWAYS_FLAKY_TEST', 'OVERSIZED_RUNNER', 'REDUNDANT_MATRIX', 'CACHE_MISS_CHURN', 'SERIAL_PARALLELIZABLE');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'TEAM', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "githubInstallationId" TEXT,
    "githubLogin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "monthlyBudgetCents" INTEGER,
    "slackWebhookUrl" TEXT,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digestCronTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repo" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prTitle" TEXT,
    "triggeredBy" TEXT,
    "status" TEXT NOT NULL,
    "conclusion" "BuildConclusion",
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "runnerType" TEXT,
    "runnerSize" TEXT,
    "commitSha" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowJob" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "runnerType" TEXT,
    "runnerSize" TEXT,
    "conclusion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "flakyCount30d" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteFlag" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildId" TEXT,
    "flagType" "WasteFlagType" NOT NULL,
    "savingsEstimateCents" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "DigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Org_githubInstallationId_key" ON "Org"("githubInstallationId");

-- CreateIndex
CREATE UNIQUE INDEX "Org_githubLogin_key" ON "Org"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_githubLogin_key" ON "OrgMember"("orgId", "githubLogin");

-- CreateIndex
CREATE INDEX "Repo_orgId_idx" ON "Repo"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Repo_provider_externalId_key" ON "Repo"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Build_repoId_startedAt_idx" ON "Build"("repoId", "startedAt");

-- CreateIndex
CREATE INDEX "Build_triggeredBy_idx" ON "Build"("triggeredBy");

-- CreateIndex
CREATE INDEX "Build_prNumber_repoId_idx" ON "Build"("prNumber", "repoId");

-- CreateIndex
CREATE UNIQUE INDEX "Build_provider_externalId_key" ON "Build"("provider", "externalId");

-- CreateIndex
CREATE INDEX "WorkflowJob_buildId_idx" ON "WorkflowJob"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowJob_buildId_externalId_key" ON "WorkflowJob"("buildId", "externalId");

-- CreateIndex
CREATE INDEX "TestResult_buildId_idx" ON "TestResult"("buildId");

-- CreateIndex
CREATE INDEX "TestResult_suite_name_idx" ON "TestResult"("suite", "name");

-- CreateIndex
CREATE INDEX "WasteFlag_orgId_flagType_idx" ON "WasteFlag"("orgId", "flagType");

-- CreateIndex
CREATE INDEX "WasteFlag_buildId_idx" ON "WasteFlag"("buildId");

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowJob" ADD CONSTRAINT "WorkflowJob_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteFlag" ADD CONSTRAINT "WasteFlag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteFlag" ADD CONSTRAINT "WasteFlag_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE SET NULL ON UPDATE CASCADE;

