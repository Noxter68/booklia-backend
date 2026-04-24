import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private readonly logger = new Logger(CacheService.name);
  private isConnected = false;

  // Default TTL values in seconds
  static readonly TTL = {
    SEARCH: 60, // 1 minute for search results
    CATEGORIES: 300, // 5 minutes for categories
    BUSINESS_PAGE: 120, // 2 minutes for business pages
    SERVICES: 180, // 3 minutes for services list
    CLIENT_STATS: 120, // 2 minutes for client stats
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured - caching disabled');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.redis.connect();
      this.isConnected = true;
      this.logger.log('Redis connected successfully');

      this.redis.on('error', (err) => {
        this.logger.error('Redis error:', err.message);
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis reconnected');
      });
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis disconnected');
    }
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a cached value with TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis || !this.isConnected) return;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a specific key
   */
  async del(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.redis || !this.isConnected) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Deleted ${keys.length} cache keys matching ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Helper to generate cache keys for business search
   */
  static searchKey(params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .map((k) => `${k}:${params[k]}`)
      .join('|');
    return `search:business:${sortedParams}`;
  }

  /**
   * Helper to generate cache key for business by slug
   */
  static businessKey(slug: string): string {
    return `business:slug:${slug}`;
  }

  /**
   * Helper to generate cache key for categories
   */
  static categoriesKey(): string {
    return 'categories:all';
  }

  /**
   * Helper to generate cache key for client stats
   */
  static clientStatsKey(businessId: string, userId: string): string {
    return `client-stats:${businessId}:${userId}`;
  }

  /**
   * Check if caching is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Atomically acquire a named lock with a TTL (leader election for cron jobs).
   * Returns true if the lock was acquired by this caller.
   *
   * If Redis is unavailable, returns true (fail-open): the cron still runs,
   * but may duplicate work until Redis is restored. Downstream jobs must stay
   * idempotent. Without Redis we don't have a way to coordinate replicas.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redis || !this.isConnected) return true;
    try {
      const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Lock acquire error for ${key}:`, error);
      return true;
    }
  }
}
