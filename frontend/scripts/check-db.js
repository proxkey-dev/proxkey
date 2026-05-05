import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const url =
    process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL
  if (!url) {
    throw new Error('Set PRISMA_DATABASE_URL or DATABASE_URL or NEON_DATABASE_URL')
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    // Basic connectivity check: run a trivial query
    const now = await prisma.$queryRaw`SELECT NOW() as now`
    console.log('DB time:', now?.[0]?.now ?? now)

    // Check counts on a couple of tables
    const [userCount, routeCount, apiKeyCount] = await Promise.all([
      prisma.user.count(),
      prisma.proxyRoute.count(),
      prisma.apiKey.count(),
    ])
    console.log('Counts => users:', userCount, 'routes:', routeCount, 'apiKeys:', apiKeyCount)

    console.log('Database check: OK')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Database check failed:', err)
  process.exitCode = 1
})
