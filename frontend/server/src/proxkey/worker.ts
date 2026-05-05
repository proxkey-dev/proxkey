import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { COST_ATTRIBUTION_QUEUE_NAME, type CostAttributionJob } from './ci-queue'
import { loadConfig } from './config'
import { runCostAttribution } from './cost-attribution'
import { prisma } from './db'

async function start(): Promise<void> {
  const config = loadConfig()

  if (!config.REDIS_URL) {
    console.log(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message: 'REDIS_URL is not set; cost attribution worker did not start.' }))
    return
  }

  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  })

  const worker = new Worker<CostAttributionJob>(
    COST_ATTRIBUTION_QUEUE_NAME,
    async (job) => {
      await runCostAttribution(prisma, job.data)
    },
    { connection },
  )

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: `received ${signal}; draining worker` }))
    await worker.close()
    connection.disconnect()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.once('SIGTERM', (signal) => {
    void shutdown(signal)
  })
  process.once('SIGINT', (signal) => {
    void shutdown(signal)
  })

  console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: 'cost attribution worker consuming BullMQ jobs' }))
}

if (require.main === module) {
  void start()
}
