import type { PrismaClient } from "@proxkey/db";

export interface DigestData {
  periodStart: Date;
  periodEnd: Date;
  totalSpendCents: number;
  wowDeltaPercent: number;
  topRepos: Array<{ id: string; name: string; spendCents: number }>;
  topWasteFlags: Array<{
    id: string;
    flagType: string;
    repoName: string;
    savingsEstimateCents: number;
  }>;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function loadDigestData(
  prisma: PrismaClient,
  orgId: string,
  now: Date = new Date(),
): Promise<DigestData> {
  const periodStart = startOfMonth(now);
  const periodEnd = now;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const wowCurrentStart = new Date(now.getTime() - oneWeekMs);
  const wowPreviousStart = new Date(now.getTime() - 2 * oneWeekMs);

  const [monthAgg, currentWeek, prevWeek, topReposAgg, topFlagsRaw] =
    await Promise.all([
      prisma.build.aggregate({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: periodStart },
        },
        _sum: { costCents: true },
      }),
      prisma.build.aggregate({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: wowCurrentStart },
        },
        _sum: { costCents: true },
      }),
      prisma.build.aggregate({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: wowPreviousStart, lt: wowCurrentStart },
        },
        _sum: { costCents: true },
      }),
      prisma.build.groupBy({
        by: ["repoId"],
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: periodStart },
        },
        _sum: { costCents: true },
        orderBy: { _sum: { costCents: "desc" } },
        take: 3,
      }),
      prisma.wasteFlag.findMany({
        where: { orgId, resolvedAt: null },
        orderBy: { savingsEstimateCents: "desc" },
        take: 3,
        include: {
          build: { include: { repo: { select: { fullName: true } } } },
        },
      }),
    ]);

  const totalSpendCents = monthAgg._sum.costCents ?? 0;
  const wowDeltaPercent = pctDelta(
    currentWeek._sum.costCents ?? 0,
    prevWeek._sum.costCents ?? 0,
  );

  const repoIds = topReposAgg.map((r) => r.repoId);
  const repos = await prisma.repo.findMany({
    where: { id: { in: repoIds } },
    select: { id: true, fullName: true },
  });
  const repoNameById = new Map(repos.map((r) => [r.id, r.fullName]));

  const topRepos = topReposAgg.map((r) => ({
    id: r.repoId,
    name: repoNameById.get(r.repoId) ?? "(deleted)",
    spendCents: r._sum.costCents ?? 0,
  }));

  const topWasteFlags = topFlagsRaw.map((f) => ({
    id: f.id,
    flagType: f.flagType,
    repoName: f.build?.repo.fullName ?? "(unknown)",
    savingsEstimateCents: f.savingsEstimateCents,
  }));

  return {
    periodStart,
    periodEnd,
    totalSpendCents,
    wowDeltaPercent,
    topRepos,
    topWasteFlags,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildEmailHtml(orgName: string, d: DigestData): string {
  const sign = d.wowDeltaPercent > 0 ? "+" : "";
  const repoRows = d.topRepos
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td style="text-align:right">${formatCents(r.spendCents)}</td></tr>`,
    )
    .join("");
  const flagRows = d.topWasteFlags
    .map(
      (f) =>
        `<tr><td>${f.flagType}</td><td>${f.repoName}</td><td style="text-align:right">${formatCents(f.savingsEstimateCents)}</td></tr>`,
    )
    .join("");
  return `
    <h2>${orgName} — CI spend this month</h2>
    <p>Total spend: <strong>${formatCents(d.totalSpendCents)}</strong></p>
    <p>Week over week: <strong>${sign}${String(d.wowDeltaPercent)}%</strong></p>
    <h3>Top repos</h3>
    <table cellpadding="6">${repoRows}</table>
    <h3>Top waste flags</h3>
    <table cellpadding="6">${flagRows}</table>
  `;
}

export function buildSlackBlocks(orgName: string, d: DigestData): unknown {
  const sign = d.wowDeltaPercent > 0 ? "+" : "";
  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${orgName} — CI spend digest` },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*This month*\n${formatCents(d.totalSpendCents)}`,
          },
          {
            type: "mrkdwn",
            text: `*WoW change*\n${sign}${String(d.wowDeltaPercent)}%`,
          },
        ],
      },
      ...(d.topRepos.length > 0
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "*Top repos*\n" +
                  d.topRepos
                    .map(
                      (r) => `• ${r.name} — ${formatCents(r.spendCents)}`,
                    )
                    .join("\n"),
              },
            },
          ]
        : []),
      ...(d.topWasteFlags.length > 0
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "*Top waste flags*\n" +
                  d.topWasteFlags
                    .map(
                      (f) =>
                        `• \`${f.flagType}\` (${f.repoName}) — save ${formatCents(f.savingsEstimateCents)}`,
                    )
                    .join("\n"),
              },
            },
          ]
        : []),
    ],
  };
}
