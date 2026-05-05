import 'dotenv/config'
import argon2 from 'argon2'
import {
  OrganizationMembershipRole,
  PlanTier,
  PrismaClient,
  ReportSource,
  ReportStatus,
  Severity,
  SubscriptionStatus,
  TriageArtifactType,
  UserRole,
  UserStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

function createSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash('ChangeMe123!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  const organization = await prisma.organization.upsert({
    where: { slug: createSlug('Acme Engineering Ops') },
    update: {
      name: 'Acme Engineering Ops',
      plan: PlanTier.TEAM,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
    create: {
      name: 'Acme Engineering Ops',
      slug: createSlug('Acme Engineering Ops'),
      domain: 'proxkey.local',
      plan: PlanTier.TEAM,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  })

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'owner@proxkey.local' },
      update: { orgId: organization.id, passwordHash, name: 'Org Owner', role: UserRole.OWNER, status: UserStatus.ACTIVE },
      create: {
        orgId: organization.id,
        email: 'owner@proxkey.local',
        passwordHash,
        name: 'Org Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    }),
    prisma.user.upsert({
      where: { email: 'triage@proxkey.local' },
      update: { orgId: organization.id, passwordHash, name: 'Checkout Platform', role: UserRole.TRIAGE_LEAD, status: UserStatus.ACTIVE },
      create: {
        orgId: organization.id,
        email: 'triage@proxkey.local',
        passwordHash,
        name: 'Checkout Platform',
        role: UserRole.TRIAGE_LEAD,
        status: UserStatus.ACTIVE,
      },
    }),
    prisma.user.upsert({
      where: { email: 'engineer@proxkey.local' },
      update: { orgId: organization.id, passwordHash, name: 'Platform Engineer', role: UserRole.EMPLOYEE, status: UserStatus.ACTIVE },
      create: {
        orgId: organization.id,
        email: 'engineer@proxkey.local',
        passwordHash,
        name: 'Platform Engineer',
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
      },
    }),
  ])

  const [owner, triageLead] = users

  await prisma.organization.update({
    where: { id: organization.id },
    data: { createdByUserId: owner.id },
  })

  for (const [user, role] of [
    [owner, OrganizationMembershipRole.OWNER],
    [triageLead, OrganizationMembershipRole.ADMIN],
    [users[2], OrganizationMembershipRole.MEMBER],
  ] as const) {
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: { role },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role,
      },
    })
  }

  const cluster = await prisma.packetCluster.upsert({
    where: {
      orgId_key: {
        orgId: organization.id,
        key: 'seed-checkout-callback',
      },
    },
    update: {
      title: 'Checkout callback failures after auth deploy',
      component: 'payment-callback',
      severity: Severity.HIGH,
      packetCount: 1,
      lastSeenAt: new Date(),
    },
    create: {
      orgId: organization.id,
      key: 'seed-checkout-callback',
      title: 'Checkout callback failures after auth deploy',
      component: 'payment-callback',
      severity: Severity.HIGH,
      packetCount: 1,
      metadataJson: {
        classification: 'Release regression',
        signalNames: ['payment_flow', 'auth_flow', 'queue_depth'],
      },
    },
  })

  const report = await prisma.report.create({
    data: {
      orgId: organization.id,
      clusterId: cluster.id,
      source: ReportSource.SUPPORT,
      title: 'Checkout callback failures after auth deploy',
      rawText:
        'Support: Apple Pay closes, order never confirms. Slack: same payment spinner as yesterday and queue depth spiked. CI: checkout-callback.test.ts failed on main after auth release.',
      logs: 'trace_id=chk_seed_931 status=500 component=payment-callback queue_depth=184',
      status: ReportStatus.NEEDS_REVIEW,
      metadataJson: {
        intake: 'packet',
        sourceKind: 'support',
      },
      triageArtifacts: {
        create: [
          {
            type: TriageArtifactType.LOG,
            content: 'trace_id=chk_seed_931 status=500 component=payment-callback queue_depth=184',
          },
          {
            type: TriageArtifactType.METADATA,
            content: JSON.stringify({ slackThread: 'checkout-platform/seed', ciShard: 'test_shard_12' }),
          },
        ],
      },
      triageResult: {
        create: {
          summary:
            'Payment callback failures recur across CI, support, and Slack evidence after the latest auth deploy.',
          classification: 'Release regression',
          severity: Severity.HIGH,
          severityLabel: 'SEV-2',
          component: 'payment-callback',
          suspectedRootCause: 'Recent auth deploy likely changed payment callback completion behavior.',
          clusterId: cluster.id,
          suggestedOwnerId: triageLead.id,
          confidence: 0.91,
          needsReview: true,
          requestMoreInfo: false,
          evidence: [
            {
              id: 'seed:support',
              source: 'SUPPORT',
              type: 'raw_text',
              title: 'Support escalation',
              content: 'Apple Pay closes, order never confirms.',
              provenance: { reportId: 'seed', receivedAt: new Date().toISOString() },
            },
          ],
          extractedSignals: [
            { name: 'trace_id', value: 'chk_seed_931', confidence: 0.95, provenance: 'logs' },
            { name: 'queue_depth', value: 'queue_depth', confidence: 0.8, provenance: 'raw_evidence' },
          ],
          reproSteps: ['Close Apple Pay after checkout authorization', 'Observe order confirmation spinner'],
          missingInfo: [],
          uncertainty: [],
          duplicateCandidates: [],
          recommendedActions: ['Rollback or pause the candidate deploy and attach payment session traces.'],
          nextAction: 'Rollback or pause the candidate deploy and attach payment session traces.',
        },
      },
    },
  })

  console.log({
    organizationId: organization.id,
    ownerEmail: owner.email,
    triageLeadEmail: triageLead.email,
    reportId: report.id,
    packetId: report.id,
    seededPassword: 'ChangeMe123!',
  })
}

main()
  .catch(async (error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
