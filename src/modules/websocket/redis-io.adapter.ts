import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Socket.io adapter backed by Redis pub/sub so emits propagate across all
 * Railway replicas. Without this, `server.to('user:X').emit(...)` only
 * reaches sockets connected to the same replica as the emitting process.
 *
 * Falls back to the default in-memory adapter when REDIS_URL is missing
 * (local dev, tests) — logs a warning so it's visible.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — socket.io running with in-memory adapter (single-replica only)',
      );
      return;
    }

    try {
      const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
      const subClient = pubClient.duplicate();

      await Promise.all([
        new Promise<void>((r) => pubClient.once('ready', () => r())),
        new Promise<void>((r) => subClient.once('ready', () => r())),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.io Redis adapter connected');
    } catch (err) {
      this.logger.error(
        'Failed to init socket.io Redis adapter — falling back to in-memory',
        err,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
