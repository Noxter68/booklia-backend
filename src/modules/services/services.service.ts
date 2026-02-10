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

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateServiceDto) {
    // REQUEST requires priceCents
    if (dto.kind === ServiceKind.REQUEST && !dto.priceCents) {
      throw new BadRequestException('REQUEST services require a price');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { tagIds, availableFromDate, availableToDate, deadlineAt, status, ...serviceData } = dto;

    return this.prisma.service.create({
      data: {
        ...serviceData,
        status: status || ServiceStatus.DRAFT,
        deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
        availableFromDate: availableFromDate ? new Date(availableFromDate) : undefined,
        availableToDate: availableToDate ? new Date(availableToDate) : undefined,
        expiresAt,
        createdByUserId: userId,
        tags: tagIds?.length
          ? {
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        createdBy: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                city: true,
                images: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
            reputation: true,
          },
        },
      },
    });
  }

  async update(userId: string, serviceId: string, dto: UpdateServiceDto) {
    const service = await this.findOneOrFail(serviceId);

    if (service.createdByUserId !== userId) {
      throw new ForbiddenException('You can only update your own services');
    }

    const { tagIds, availableFromDate, availableToDate, deadlineAt, ...updateData } = dto;

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...updateData,
        deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
        availableFromDate: availableFromDate ? new Date(availableFromDate) : undefined,
        availableToDate: availableToDate ? new Date(availableToDate) : undefined,
        tags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });
  }

  async publish(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);

    if (service.createdByUserId !== userId) {
      throw new ForbiddenException('You can only publish your own services');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: ServiceStatus.PUBLISHED },
    });
  }

  async pause(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);

    if (service.createdByUserId !== userId) {
      throw new ForbiddenException('You can only pause your own services');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: ServiceStatus.PAUSED },
    });
  }

  async findOne(serviceId: string) {
    return this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        createdBy: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                city: true,
                images: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
            reputation: true,
          },
        },
      },
    });
  }

  async findOneOrFail(serviceId: string) {
    const service = await this.findOne(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async search(dto: SearchServicesDto) {
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

    // City search (text-based)
    if (dto.city) {
      where.OR = [
        { city: { contains: dto.city, mode: 'insensitive' } },
        {
          createdBy: {
            profile: {
              city: { contains: dto.city, mode: 'insensitive' },
            },
          },
        },
      ];
    }

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

    // If geolocation search is requested, we'll need to do a two-step search
    // First get all services, then filter by distance
    const useGeoSearch = dto.lat !== undefined && dto.lng !== undefined;

    let services;
    let total;

    if (useGeoSearch) {
      // For geo search, we need to fetch more services and filter by distance
      // This is a simple implementation; for production, use PostGIS or a geo library
      const radius = dto.radius || 10;

      // Rough bounding box calculation (1 degree ≈ 111 km)
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((dto.lat! * Math.PI) / 180));

      const geoWhere: Prisma.ServiceWhereInput = {
        ...where,
        latitude: {
          gte: dto.lat! - latDelta,
          lte: dto.lat! + latDelta,
        },
        longitude: {
          gte: dto.lng! - lngDelta,
          lte: dto.lng! + lngDelta,
        },
      };

      const allServices = await this.prisma.service.findMany({
        where: geoWhere,
        include: {
          category: true,
          tags: { include: { tag: true } },
          createdBy: {
            select: {
              id: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                  city: true,
                  images: {
                    orderBy: { sortOrder: 'asc' },
                    take: 1,
                  },
                },
              },
              reputation: true,
            },
          },
        },
        orderBy: [
          { boostedUntil: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      // Filter by actual distance and sort
      const filteredServices = allServices
        .map((service) => {
          if (service.latitude && service.longitude) {
            const distance = this.calculateDistance(
              dto.lat!,
              dto.lng!,
              service.latitude,
              service.longitude
            );
            return { ...service, distance };
          }
          return { ...service, distance: Infinity };
        })
        .filter((s) => s.distance <= radius)
        .sort((a, b) => {
          // Boosted services first, then by distance
          if (a.boostedUntil && b.boostedUntil) {
            return b.boostedUntil.getTime() - a.boostedUntil.getTime();
          }
          if (a.boostedUntil) return -1;
          if (b.boostedUntil) return 1;
          return a.distance - b.distance;
        });

      total = filteredServices.length;
      services = filteredServices.slice(dto.offset || 0, (dto.offset || 0) + (dto.limit || 20));
    } else {
      [services, total] = await Promise.all([
        this.prisma.service.findMany({
          where,
          include: {
            category: true,
            tags: { include: { tag: true } },
            createdBy: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true, city: true } },
                reputation: true,
              },
            },
          },
          orderBy: [
            { boostedUntil: 'desc' },
            { createdAt: 'desc' },
          ],
          take: dto.limit,
          skip: dto.offset,
        }),
        this.prisma.service.count({ where }),
      ]);
    }

    return {
      data: services,
      total,
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  // Haversine formula to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

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

  async findPublishedByUser(userId: string) {
    return this.prisma.service.findMany({
      where: {
        createdByUserId: userId,
        status: ServiceStatus.PUBLISHED,
        expiresAt: { gt: new Date() },
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        createdBy: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                city: true,
                images: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
            reputation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, serviceId: string) {
    const service = await this.findOneOrFail(serviceId);

    if (service.createdByUserId !== userId) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.prisma.service.delete({ where: { id: serviceId } });
    return { success: true };
  }

  async suggest(query: string, limit = 5) {
    if (!query || query.length < 2) {
      return [];
    }

    const services = await this.prisma.service.findMany({
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
        createdBy: {
          select: {
            profile: { select: { displayName: true, city: true } },
          },
        },
      },
      take: limit,
      orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
    });

    return services;
  }
}
