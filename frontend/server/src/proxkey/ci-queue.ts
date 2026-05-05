import type { ProxKeyConfig } from './config'

export const COST_ATTRIBUTION_QUEUE_NAME = 'cost-attribution'

export type CostAttributionJob = {
  buildId: string
}

export type CostAttributionQueue = {
  enqueue(job: CostAttributionJob): Promise<void>
  close(): Promise<void>
}

type BullMqQueueModule = {
  Queue: new (name: string, options: { connection: unknown }) => {
    add(name: string, data: CostAttributionJob): Promise<void>
    close(): Promise<void>
  }
}

type QueueInstance = {
  add(name: string, data: CostAttributionJob): Promise<void>
  close(): Promise<void>
}

type RedisModule = {
  default: new (connectionString: string, options?: Record<string, unknown>) => {
    disconnect(): void
  }
}

async function loadBullMq(): Promise<BullMqQueueModule> {
  return (await import('bullmq')) as unknown as BullMqQueueModule
}

async function loadRedis(url: string): Promise<{ disconnect(): void }> {
  const module = (await import('ioredis')) as unknown as RedisModule
  return new module.default(url, {
    maxRetriesPerRequest: null,
  })
}

export class InlineCostAttributionQueue implements CostAttributionQueue {
  constructor(private readonly processor: (job: CostAttributionJob) => Promise<void>) {}

  async enqueue(job: CostAttributionJob): Promise<void> {
    queueMicrotask(() => {
      void this.processor(job)
    })
  }

  async close(): Promise<void> {
    return undefined
  }
}

export class BullMqCostAttributionQueue implements CostAttributionQueue {
  private queuePromise: Promise<{
    queue: QueueInstance
    connection: { disconnect(): void }
  }> | null = null

  constructor(private readonly config: ProxKeyConfig) {}

  private async getQueue() {
    if (!this.config.REDIS_URL) {
      throw new Error('REDIS_URL is required for BullMQ cost attribution')
    }

    if (!this.queuePromise) {
      this.queuePromise = Promise.all([loadBullMq(), loadRedis(this.config.REDIS_URL)]).then(([bullmq, connection]) => ({
        queue: new bullmq.Queue(COST_ATTRIBUTION_QUEUE_NAME, { connection }),
        connection,
      }))
    }

    return this.queuePromise
  }

  async enqueue(job: CostAttributionJob): Promise<void> {
    const { queue } = await this.getQueue()
    await queue.add('attribute-build-cost', job)
  }

  async close(): Promise<void> {
    if (!this.queuePromise) {
      return
    }

    const { queue, connection } = await this.queuePromise
    await queue.close()
    connection.disconnect()
  }
}

export function createCostAttributionQueue(config: ProxKeyConfig, processor: (job: CostAttributionJob) => Promise<void>): CostAttributionQueue {
  if (config.useRedisQueue) {
    return new BullMqCostAttributionQueue(config)
  }

  return new InlineCostAttributionQueue(processor)
}
