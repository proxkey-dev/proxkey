import { Redis, type RedisOptions } from "ioredis";

export function createRedisConnection(redisUrl: string): Redis {
  const url = new URL(redisUrl);
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }
  if (url.username) {
    options.username = decodeURIComponent(url.username);
  }
  if (url.hostname) {
    options.host = url.hostname;
  }
  if (url.port) {
    options.port = Number(url.port);
  }
  if (url.pathname && url.pathname !== "/") {
    const db = Number(url.pathname.replace("/", ""));
    if (!Number.isNaN(db)) {
      options.db = db;
    }
  }
  if (url.protocol === "rediss:") {
    options.tls = {};
  }
  return new Redis(options);
}
