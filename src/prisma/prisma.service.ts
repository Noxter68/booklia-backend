import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const SLOW_QUERY_THRESHOLD_MS = 100;

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super(
      process.env.NODE_ENV !== 'production'
        ? {
            log: [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
          }
        : {},
    );
  }

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      // Log only slow queries to keep noise down. Tweak the threshold via env
      // if you need to widen the net during a perf hunt.
      this.$on('query', (e) => {
        if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
          this.logger.warn(`slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
