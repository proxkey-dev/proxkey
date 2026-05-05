import { performTriage } from './triage'
import type { ProxKeyConfig } from './config'
import type { QueueJobData } from './types'

export type QueueDriver = {
  enqueue(job: QueueJobData): Promise<void>
}

export const TRIAGE_QUEUE_NAME = 'triage'

export class InlineQueueDriver implements QueueDriver {
  constructor(private readonly config: ProxKeyConfig) {}

  async enqueue(job: QueueJobData): Promise<void> {
    queueMicrotask(() => {
      void performTriage(this.config, job)
    })
  }
}

type DynamicModule = {
  Queue: new (
    name: string,
    options: { connection: unknown },
  ) => {
    add(name: string, data: QueueJobData): Promise<void>
  }
}

async function loadBullMqModule(): Promise<DynamicModule> {
  return (await new Function('return import("bullmq")')()) as DynamicModule
}

async function loadRedis(url: string): Promise<unknown> {
  const module = (await new Function('return import("ioredis")')()) as {
    default: new (connectionString: string, options?: Record<string, unknown>) => unknown
  }

  return new module.default(url, {
    maxRetriesPerRequest: null,
  })
}

export class BullMqQueueDriver implements QueueDriver {
  private queuePromise: Promise<{ add(name: string, data: QueueJobData): Promise<void> }> | null =
    null

  constructor(private readonly config: ProxKeyConfig) {}

  private async getQueue() {
    if (!this.config.REDIS_URL) {
      throw new Error('REDIS_URL is required when REDIS_ENABLED=true')
    }

    if (!this.queuePromise) {
      this.queuePromise = Promise.all([loadBullMqModule(), loadRedis(this.config.REDIS_URL)]).then(
        ([bullmq, connection]) => {
          return new bullmq.Queue(TRIAGE_QUEUE_NAME, {
            connection,
          })
        },
      )
    }

    return this.queuePromise
  }

  async enqueue(job: QueueJobData): Promise<void> {
    const queue = await this.getQueue()
    await queue.add('triage', job)
  }
}

export function createQueueDriver(config: ProxKeyConfig): QueueDriver {
  if (config.useRedisQueue) {
    return new BullMqQueueDriver(config)
  }

  return new InlineQueueDriver(config)
}
