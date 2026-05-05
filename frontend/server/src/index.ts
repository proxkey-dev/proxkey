import { createServer } from './proxkey/server'
import type { ProxKeyConfig } from './proxkey/config'

async function start(): Promise<void> {
  const server = await createServer()
  const config = server.config as ProxKeyConfig

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    server.log.info({ signal }, 'Shutting down ProxKey API')
    await server.close()
    process.exit(0)
  }

  process.once('SIGTERM', (signal) => {
    void shutdown(signal)
  })
  process.once('SIGINT', (signal) => {
    void shutdown(signal)
  })

  try {
    await server.listen({
      host: config.HOST,
      port: config.PORT,
    })

    server.log.info(
      {
        env: config.NODE_ENV,
        host: config.HOST,
        port: config.PORT,
        version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.BUILD_VERSION ?? 'dev',
        cors: config.frontendOrigins,
        auth0: Boolean(config.AUTH0_DOMAIN),
        redis: config.useRedisQueue,
      },
      'ProxKey API started',
    )
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

if (require.main === module) {
  void start()
}
