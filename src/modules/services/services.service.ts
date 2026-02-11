/**
 * Services Service
 *
 * Handles all business logic for P2P service listings.
 * Services can be OFFERS (someone proposing) or REQUESTS (someone looking).
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import { ServiceKind, ServiceStatus, Prisma } from '@prisma/client';

// ============================================
// CONSTANTS
// ============================================

const SERVICE_EXPIRY_DAYS = 30;
const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 10;
const KM_PER_DEGREE = 111;

/** Reusable include for service queries with creator profile */
const SERVICE_INCLUDE = {
  category: true,
  tags: { include: { tag: true } },
  createdBy: {
    select: {
      id: true,
      profile: {
        select: {
          displayName: true,
          avatarUrl: true,
          coverUrl: true,
          city: true,
          images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
      reputation: true,
    },
  },
} as const;

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /** Creates a new service. REQUEST type requires a price. */
  async create(userId: string, dto: CreateServiceDto) {
    if (dto.kind === ServiceKind.REQUEST && !dto.priceCents) {
      throw new BadRequestException('REQUEST services require a price');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SERVICE_EXPIRY_DAYS);

    const { tagIds, availableFromDate, availableToDate, deadlineAt, status, ...data } = dto;

    return this.prisma.service.create({
      data: {
        ...data,
        status: status || ServiceStatus.DRAFT,
        deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
        availableFromDate: availableFromDate ? new Date(availableFromDate) : undefined,
        availableToDate: availableToDate ? new Date(availableToDate) : undefined,
        expiresAt,
        createdByUserId: userId,
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: SERVICE_INCLUDE,
    });
  }

  /** Updates a service. Only owner can update. */
  async update(userId: string, serviceId: string, dto: UpdateServiceDto) {
    const service = await this.findOneOrFail(serviceId);
    this.assertOwnership(userId, service);

    const { tagIds, availableFromDate, availableToDate, deadlineAt, ...data } = dto;

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...data,
        deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
        availableFromDate: availableFromDate ? new Date(availableFromDate) : undefined,
        availableToDate: availableToDate ? new Date(availableToDate) : undefined,
        tags: tagIds ? { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: { category: true, tags: { include: { tag: true } } },
    });
  }

  /** Deletes a service. Only owner can delete. */
  async delete(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);
    this.assertOwnership(userId, service);
    await this.prisma.service.delete({ where: { id: serviceId } });
    return { success: true };
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  /** Publishes a service (visible in search). */
  async publish(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);
    this.assertOwnership(userId, service);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: ServiceStatus.PUBLISHED },
    });
  }

  /** Pauses a service (hidden from search). */
  async pause(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);
    this.assertOwnership(userId, service);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: ServiceStatus.PAUSED },
    });
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /** Finds a service by ID with all relations. */
  async findOne(serviceId: string) {
    return this.prisma.service.findUnique({
      where: { id: serviceId },
      include: SERVICE_INCLUDE,
    });
  }

  /** Finds a service or throws NotFoundException. */
  async findOneOrFail(serviceId: string) {
    const service = await this.findOne(serviceId);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  /** Gets all services by user (including drafts). */
  async findByUser(userId: string) {
    return this.prisma.service.findMany({
      where: { createdByUserId: userId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Gets published services for public profile. */
  async findPublishedByUser(userId: string) {
    return this.prisma.service.findMany({
      where: {
        createdByUserId: userId,
        status: ServiceStatus.PUBLISHED,
        expiresAt: { gt: new Date() },
      },
      include: SERVICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // SEARCH & SUGGESTIONS
  // ============================================

  /** Searches services with filters. Supports text, geo, and various filters. */
  async search(dto: SearchServicesDto) {
    const where = this.buildSearchWhere(dto);
    const useGeoSearch = dto.lat !== undefined && dto.lng !== undefined;

    return useGeoSearch ? this.searchWithGeo(where, dto) : this.searchStandard(where, dto);
  }

  /** Quick suggestions for autocomplete. */
  async suggest(query: string, limit = 5) {
    if (!query || query.length < 2) return [];

    return this.prisma.service.findMany({
      where: {
        status: ServiceStatus.PUBLISHED,
        expiresAt: { gt: new Date() },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        kind: true,
        category: { select: { name: true } },
        createdBy: { select: { profile: { select: { displayName: true, city: true } } } },
      },
      take: limit,
      orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /** Builds Prisma where clause from search DTO. */
  private buildSearchWhere(dto: SearchServicesDto): Prisma.ServiceWhereInput {
    const where: Prisma.ServiceWhereInput = {
      status: ServiceStatus.PUBLISHED,
      expiresAt: { gt: new Date() },
    };

    if (dto.kind) where.kind = dto.kind;
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.urgency) where.urgency = dto.urgency;
    if (dto.isRecurring !== undefined) where.isRecurring = dto.isRecurring;

    if (dto.priceMin || dto.priceMax) {
      where.priceCents = {};
      if (dto.priceMin) where.priceCents.gte = dto.priceMin;
      if (dto.priceMax) where.priceCents.lte = dto.priceMax;
    }

    // City search (service or creator)
    if (dto.city) {
      where.OR = [
        { city: { contains: dto.city, mode: 'insensitive' } },
        { createdBy: { profile: { city: { contains: dto.city, mode: 'insensitive' } } } },
      ];
    }

    // Text search
    if (dto.q) {
      const textConditions = [
        { title: { contains: dto.q, mode: 'insensitive' as const } },
        { description: { contains: dto.q, mode: 'insensitive' as const } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: textConditions }];
        delete where.OR;
      } else {
        where.OR = textConditions;
      }
    }

    return where;
  }

  /** Standard search without geolocation. */
  private async searchStandard(where: Prisma.ServiceWhereInput, dto: SearchServicesDto) {
    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          category: true,
          tags: { include: { tag: true } },
          createdBy: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true, coverUrl: true, city: true } },
              reputation: true,
            },
          },
        },
        orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
        take: dto.limit,
        skip: dto.offset,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { data: services, total, limit: dto.limit, offset: dto.offset };
  }

  /** Search with geolocation (bounding box + Haversine). */
  private async searchWithGeo(where: Prisma.ServiceWhereInput, dto: SearchServicesDto) {
    const radius = dto.radius || DEFAULT_RADIUS_KM;
    const { lat, lng } = dto as { lat: number; lng: number };

    // Bounding box filter
    const latDelta = radius / KM_PER_DEGREE;
    const lngDelta = radius / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));

    const geoWhere: Prisma.ServiceWhereInput = {
      ...where,
      latitude: { gte: lat - latDelta, lte: lat + latDelta },
      longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    const allServices = await this.prisma.service.findMany({
      where: geoWhere,
      include: SERVICE_INCLUDE,
      orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
    });

    // Filter by actual distance and sort (boosted first, then by distance)
    const filtered = allServices
      .map((s) => ({
        ...s,
        distance: s.latitude && s.longitude ? this.haversine(lat, lng, s.latitude, s.longitude) : Infinity,
      }))
      .filter((s) => s.distance <= radius)
      .sort((a, b) => {
        if (a.boostedUntil && b.boostedUntil) return b.boostedUntil.getTime() - a.boostedUntil.getTime();
        if (a.boostedUntil) return -1;
        if (b.boostedUntil) return 1;
        return a.distance - b.distance;
      });

    const total = filtered.length;
    const services = filtered.slice(dto.offset || 0, (dto.offset || 0) + (dto.limit || 20));

    return { data: services, total, limit: dto.limit, offset: dto.offset };
  }

  /** Haversine formula for distance calculation. */
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Asserts user owns the service. */
  private assertOwnership(userId: string, service: { createdByUserId: string }) {
    if (service.createdByUserId !== userId) {
      throw new ForbiddenException('You can only modify your own services');
    }
  }
}
