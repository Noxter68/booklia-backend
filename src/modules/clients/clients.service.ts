import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateBusinessClientDto, UpdateBusinessClientDto } from './dto/client.dto';

export type ClientTrustLevel = 'fiable' | 'peu_fiable' | 'attention';

export interface ClientStats {
  totalBookings: number;
  completedBookings: number;
  canceledByClient: number;
  totalRevenueCents: number;
  servicesUsed: string[];
  completionRate: number;
  trustLevel: ClientTrustLevel;
  lastBookingAt: Date | null;
}

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Auto-create or return existing BusinessClient record.
   * Called from BookingsService.create() when a booking is made.
   */
  async ensureClient(businessId: string, userId: string) {
    return this.prisma.businessClient.upsert({
      where: { businessId_userId: { businessId, userId } },
      create: { businessId, userId },
      update: {},
    });
  }

  /**
   * Manually create a client from the dashboard.
   * Creates or finds a User by email, then creates a BusinessClient.
   */
  async createClient(businessId: string, dto: CreateBusinessClientDto) {
    // Find or create user by email
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          name: dto.name.trim(),
        },
      });
    }

    // Check if already a client of this business
    const existing = await this.prisma.businessClient.findUnique({
      where: { businessId_userId: { businessId, userId: user.id } },
    });

    if (existing) {
      throw new BadRequestException('Ce client existe déjà pour votre établissement');
    }

    // Create the BusinessClient
    const client = await this.prisma.businessClient.create({
      data: {
        businessId,
        userId: user.id,
        phone: dto.phone || null,
        address: dto.address || null,
        notes: dto.notes || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return client;
  }

  /**
   * Check if a client is blocked for a given business.
   */
  async isClientBlocked(businessId: string, userId: string): Promise<boolean> {
    const client = await this.prisma.businessClient.findUnique({
      where: { businessId_userId: { businessId, userId } },
      select: { isBlocked: true },
    });
    return client?.isBlocked ?? false;
  }

  /**
   * Get all clients for a business, with computed stats.
   * Fetches all bookings in a single query and aggregates per-client in
   * memory to avoid N+1 (previously one query per client).
   */
  async getClientsForBusiness(businessId: string, search?: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const where: any = { businessId };
    if (search && search.trim()) {
      const q = search.trim();
      where.user = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const clients = await this.prisma.businessClient.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (clients.length === 0) {
      return [];
    }

    const clientUserIds = clients.map((c) => c.userId);

    const bookings = await this.prisma.booking.findMany({
      where: {
        requesterId: { in: clientUserIds },
        providerId: business.ownerId,
        businessService: { businessId },
      },
      select: {
        requesterId: true,
        status: true,
        agreedPriceCents: true,
        canceledById: true,
        businessService: { select: { name: true } },
        createdAt: true,
      },
    });

    const bookingsByClient = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const bucket = bookingsByClient.get(b.requesterId) ?? [];
      bucket.push(b);
      bookingsByClient.set(b.requesterId, bucket);
    }

    return clients.map((client) => ({
      ...client,
      stats: this.computeClientStats(
        bookingsByClient.get(client.userId) ?? [],
        client.userId,
      ),
    }));
  }

  /**
   * Pure stat aggregation from a pre-fetched booking list.
   * Shared between list (batch fetch) and single-client (cached) paths.
   */
  private computeClientStats(
    bookings: Array<{
      status: string;
      agreedPriceCents: number | null;
      canceledById: string | null;
      businessService: { name: string } | null;
      createdAt: Date;
    }>,
    clientUserId: string,
  ): ClientStats {
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(
      (b) => b.status === 'COMPLETED',
    ).length;
    const canceledByClient = bookings.filter(
      (b) => b.status === 'CANCELED' && b.canceledById === clientUserId,
    ).length;
    const totalRevenueCents = bookings
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + (b.agreedPriceCents || 0), 0);

    const servicesUsed = [
      ...new Set(
        bookings
          .map((b) => b.businessService?.name)
          .filter((n): n is string => !!n),
      ),
    ];

    const resolvedBookings = completedBookings + canceledByClient;
    const completionRate =
      resolvedBookings > 0 ? completedBookings / resolvedBookings : 1;

    let trustLevel: ClientTrustLevel;
    if (resolvedBookings < 2) {
      trustLevel = 'fiable';
    } else if (completionRate >= 0.8) {
      trustLevel = 'fiable';
    } else if (completionRate >= 0.5) {
      trustLevel = 'peu_fiable';
    } else {
      trustLevel = 'attention';
    }

    const lastBookingAt =
      bookings.length > 0
        ? [...bookings].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          )[0].createdAt
        : null;

    return {
      totalBookings,
      completedBookings,
      canceledByClient,
      totalRevenueCents,
      servicesUsed,
      completionRate,
      trustLevel,
      lastBookingAt,
    };
  }

  /**
   * Get detailed stats for a single client-business pair.
   * Cached in Redis for 120 seconds.
   */
  async getClientStats(
    businessId: string,
    clientUserId: string,
    providerId: string,
  ): Promise<ClientStats> {
    const cacheKey = CacheService.clientStatsKey(businessId, clientUserId);
    const cached = await this.cacheService.get<ClientStats>(cacheKey);
    if (cached) return cached;

    const bookings = await this.prisma.booking.findMany({
      where: {
        requesterId: clientUserId,
        providerId,
        businessService: { businessId },
      },
      select: {
        status: true,
        agreedPriceCents: true,
        canceledById: true,
        businessService: { select: { name: true } },
        createdAt: true,
      },
    });

    const stats = this.computeClientStats(bookings, clientUserId);

    await this.cacheService.set(
      cacheKey,
      stats,
      CacheService.TTL.CLIENT_STATS,
    );

    return stats;
  }

  /**
   * Get a single client with full detail.
   */
  async getClientDetail(businessId: string, clientId: string) {
    const client = await this.prisma.businessClient.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!client || client.businessId !== businessId) {
      throw new NotFoundException('Client non trouvé');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    const stats = await this.getClientStats(
      businessId,
      client.userId,
      business!.ownerId,
    );

    return { ...client, stats };
  }

  /**
   * Get booking history for a specific client.
   */
  async getClientBookings(businessId: string, clientId: string) {
    const client = await this.prisma.businessClient.findUnique({
      where: { id: clientId },
      select: { userId: true, businessId: true },
    });

    if (!client || client.businessId !== businessId) {
      throw new NotFoundException('Client non trouvé');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    return this.prisma.booking.findMany({
      where: {
        requesterId: client.userId,
        providerId: business!.ownerId,
        businessService: { businessId },
      },
      include: {
        businessService: { select: { name: true, priceCents: true, durationMinutes: true } },
        employee: { select: { firstName: true, lastName: true } },
        invoice: { select: { id: true, status: true, emailSentAt: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Client growth stats: daily count of new clients over a date range.
   * Returns baseCount (clients before `from`) + daily new client counts.
   */
  async getClientGrowthStats(businessId: string, from: Date, to: Date) {
    const [baseCount, newClients] = await Promise.all([
      this.prisma.businessClient.count({
        where: {
          businessId,
          createdAt: { lt: from },
        },
      }),
      this.prisma.businessClient.findMany({
        where: {
          businessId,
          createdAt: { gte: from, lte: to },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const dayMap = new Map<string, number>();
    for (const c of newClients) {
      const day = c.createdAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }

    const daily = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return { baseCount, daily };
  }

  /**
   * Update client metadata (block, notes, phone, address).
   */
  async updateClient(
    businessId: string,
    clientId: string,
    dto: UpdateBusinessClientDto,
  ) {
    const client = await this.prisma.businessClient.findUnique({
      where: { id: clientId },
    });

    if (!client || client.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.businessClient.update({
      where: { id: clientId },
      data: dto,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
  }
}
