import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CacheService } from '../cache/cache.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  CreateBusinessServiceDto,
  UpdateBusinessServiceDto,
  SearchBusinessDto,
  UpdateBusinessHoursDto,
  CreateBusinessCategoryDto,
  UpdateBusinessCategoryDto,
} from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private cacheService: CacheService,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async create(userId: string, dto: CreateBusinessDto) {
    // Check if user already has a business
    const existing = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (existing) {
      throw new ConflictException('Vous avez déjà un business');
    }

    // Generate unique slug
    let slug = this.generateSlug(dto.name);
    let slugExists = await this.prisma.business.findUnique({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${this.generateSlug(dto.name)}-${counter}`;
      slugExists = await this.prisma.business.findUnique({ where: { slug } });
      counter++;
    }

    // Create business
    const business = await this.prisma.business.create({
      data: {
        ...dto,
        slug,
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidate search cache
    await this.cacheService.delByPattern('search:business:*');

    return business;
  }

  async findByOwner(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            availabilities: true,
            services: {
              include: {
                businessService: true,
              },
            },
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: true,
            businessCategory: true,
          },
        },
        hours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        categories: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return business;
  }

  /** Find business by owner ID (public endpoint) */
  async findByOwnerPublic(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId, isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        employees: {
          where: { isActive: true },
          include: {
            availabilities: true,
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: true,
            businessCategory: true,
          },
        },
        hours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        categories: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Return null if no business found (not an error for public endpoint)
    return business;
  }

  async findBySlug(slug: string) {
    // Check cache first
    const cacheKey = CacheService.businessKey(slug);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const business = await this.prisma.business.findUnique({
      where: { slug, isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        employees: {
          where: { isActive: true },
          include: {
            availabilities: true,
            services: {
              include: {
                businessService: true,
              },
            },
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: true,
            businessCategory: true,
          },
        },
        hours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        categories: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Cache the result
    await this.cacheService.set(cacheKey, business, CacheService.TTL.BUSINESS_PAGE);

    return business;
  }

  async findById(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        employees: {
          include: {
            availabilities: true,
          },
        },
        services: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return business;
  }

  async update(userId: string, dto: UpdateBusinessDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Delete old logo from R2 if it's being replaced
    if (dto.logoUrl && business.logoUrl && dto.logoUrl !== business.logoUrl) {
      const oldKey = this.uploadService.extractKeyFromUrl(business.logoUrl);
      if (oldKey) {
        await this.uploadService.deleteFile(oldKey);
      }
    }

    // Delete old cover from R2 if it's being replaced
    if (dto.coverUrl && business.coverUrl && dto.coverUrl !== business.coverUrl) {
      const oldKey = this.uploadService.extractKeyFromUrl(business.coverUrl);
      if (oldKey) {
        await this.uploadService.deleteFile(oldKey);
      }
    }

    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: dto,
      include: {
        employees: true,
        services: true,
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(CacheService.businessKey(business.slug)),
      this.cacheService.delByPattern('search:business:*'),
    ]);

    return updated;
  }

  async search(dto: SearchBusinessDto) {
    const { q, city, categoryId, lat, lng, radius = 10, limit = 20, offset = 0, sortBy = 'popular' } = dto;

    // If geo search, use special method
    if (lat !== undefined && lng !== undefined) {
      return this.searchWithGeo(dto);
    }

    // Check cache first
    const cacheKey = CacheService.searchKey({ q, city, categoryId, limit, offset, sortBy });
    const cached = await this.cacheService.get<{ data: any[]; total: number; limit: number; offset: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {
      isActive: true,
    };

    // Build AND conditions
    const andConditions: any[] = [];

    if (q) {
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (categoryId) {
      // Find child category IDs so searching a parent also matches children
      const childCategories = await this.prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });
      const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];

      // Search by business main category OR by having services in that category
      andConditions.push({
        OR: [
          { categoryId: { in: categoryIds } },
          {
            services: {
              some: {
                categoryId: { in: categoryIds },
                isActive: true,
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Determine sort order based on sortBy parameter
    let orderBy: any[];
    switch (sortBy) {
      case 'recent':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'rating':
        // Sort by owner reputation rating (requires join logic, fallback to recent)
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'popular':
      default:
        orderBy = [
          { subscriptionTier: 'desc' }, // Premium businesses first
          { isVerified: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
    }

    const [data, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include: {
          owner: { select: { name: true } },
          services: {
            where: { isActive: true },
            take: 3,
          },
          _count: {
            select: {
              employees: { where: { isActive: true } },
              services: { where: { isActive: true } },
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.business.count({ where }),
    ]);

    const result = { data, total, limit, offset };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CacheService.TTL.SEARCH);

    return result;
  }

  /** Search businesses with geolocation (bounding box + Haversine distance). */
  private async searchWithGeo(dto: SearchBusinessDto) {
    const { q, categoryId, lat, lng, radius = 10, limit = 20, offset = 0, sortBy = 'distance' } = dto;

    // Round lat/lng to 3 decimals (~111m precision) for better cache hit rate
    const roundedLat = Math.round(lat! * 1000) / 1000;
    const roundedLng = Math.round(lng! * 1000) / 1000;

    // Check cache first
    const cacheKey = CacheService.searchKey({ q, categoryId, lat: roundedLat, lng: roundedLng, radius, limit, offset, sortBy });
    const cached = await this.cacheService.get<{ data: any[]; total: number; limit: number; offset: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const EARTH_RADIUS_KM = 6371;
    const KM_PER_DEGREE = 111;

    // Bounding box filter for initial query
    const latDelta = radius / KM_PER_DEGREE;
    const lngDelta = radius / (KM_PER_DEGREE * Math.cos((lat! * Math.PI) / 180));

    const where: any = {
      isActive: true,
      latitude: { not: null },
      longitude: { not: null },
      AND: [
        { latitude: { gte: lat! - latDelta } },
        { latitude: { lte: lat! + latDelta } },
        { longitude: { gte: lng! - lngDelta } },
        { longitude: { lte: lng! + lngDelta } },
      ],
    };

    // Additional filters
    if (q) {
      where.AND.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (categoryId) {
      const childCategories = await this.prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });
      const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];

      where.AND.push({
        OR: [
          { categoryId: { in: categoryIds } },
          { services: { some: { categoryId: { in: categoryIds }, isActive: true } } },
        ],
      });
    }

    // Get all matching businesses within bounding box
    const candidates = await this.prisma.business.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        services: { where: { isActive: true }, take: 3 },
        _count: {
          select: {
            employees: { where: { isActive: true } },
            services: { where: { isActive: true } },
          },
        },
      },
    });

    // Calculate actual distance using Haversine formula and filter
    const businessesWithDistance = candidates
      .map((business) => {
        const dLat = ((business.latitude! - lat!) * Math.PI) / 180;
        const dLng = ((business.longitude! - lng!) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat! * Math.PI) / 180) *
            Math.cos((business.latitude! * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = EARTH_RADIUS_KM * c;
        return { ...business, distance };
      })
      .filter((b) => b.distance <= radius)
      .sort((a, b) => {
        if (sortBy === 'distance') return a.distance - b.distance;
        if (sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        // Default: popular (tier + verified)
        const tierOrder: Record<string, number> = { PREMIUM: 3, PRO: 2, STARTER: 1 };
        const tierDiff = (tierOrder[b.subscriptionTier] || 0) - (tierOrder[a.subscriptionTier] || 0);
        if (tierDiff !== 0) return tierDiff;
        if (b.isVerified !== a.isVerified) return b.isVerified ? 1 : -1;
        return a.distance - b.distance;
      });

    const total = businessesWithDistance.length;
    const data = businessesWithDistance.slice(offset, offset + limit);

    const result = { data, total, limit, offset };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CacheService.TTL.SEARCH);

    return result;
  }

  // ============================================
  // BUSINESS SERVICES
  // ============================================

  async createService(userId: string, dto: CreateBusinessServiceDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return this.prisma.businessService.create({
      data: {
        ...dto,
        businessId: business.id,
      },
      include: {
        category: true,
      },
    });
  }

  async updateService(
    userId: string,
    serviceId: string,
    dto: UpdateBusinessServiceDto,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const service = await this.prisma.businessService.findUnique({
      where: { id: serviceId },
    });

    if (!service || service.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.businessService.update({
      where: { id: serviceId },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async deleteService(userId: string, serviceId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const service = await this.prisma.businessService.findUnique({
      where: { id: serviceId },
    });

    if (!service || service.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    await this.prisma.businessService.delete({
      where: { id: serviceId },
    });

    return { success: true };
  }

  async getServices(businessId: string) {
    return this.prisma.businessService.findMany({
      where: { businessId, isActive: true },
      include: {
        category: true,
        employees: {
          include: {
            employee: true,
          },
        },
      },
    });
  }

  // ============================================
  // BUSINESS HOURS
  // ============================================

  async getHours(businessId: string) {
    return this.prisma.businessHours.findMany({
      where: { businessId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async getHoursBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return this.prisma.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async updateHours(userId: string, dto: UpdateBusinessHoursDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Delete existing hours and create new ones in a transaction
    await this.prisma.$transaction([
      this.prisma.businessHours.deleteMany({
        where: { businessId: business.id },
      }),
      ...dto.hours.map((hour) =>
        this.prisma.businessHours.create({
          data: {
            businessId: business.id,
            dayOfWeek: hour.dayOfWeek,
            startTime: hour.startTime,
            endTime: hour.endTime,
            isClosed: hour.isClosed || false,
          },
        }),
      ),
    ]);

    return this.getHours(business.id);
  }

  // ============================================
  // BUSINESS CATEGORIES
  // ============================================

  async getCategories(businessId: string) {
    return this.prisma.businessCategory.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });
  }

  async createCategory(userId: string, dto: CreateBusinessCategoryDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Get max sortOrder
    const maxSort = await this.prisma.businessCategory.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });

    return this.prisma.businessCategory.create({
      data: {
        businessId: business.id,
        name: dto.name,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    dto: UpdateBusinessCategoryDto,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const category = await this.prisma.businessCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.businessCategory.update({
      where: { id: categoryId },
      data: dto,
    });
  }

  async deleteCategory(userId: string, categoryId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const category = await this.prisma.businessCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    // Remove category from all services before deleting
    await this.prisma.businessService.updateMany({
      where: { businessCategoryId: categoryId },
      data: { businessCategoryId: null },
    });

    await this.prisma.businessCategory.delete({
      where: { id: categoryId },
    });

    return { success: true };
  }

  // ============================================
  // VACATION MODE
  // ============================================

  async updateVacationMode(
    userId: string,
    isOnVacation: boolean,
    vacationMessage?: string,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return this.prisma.business.update({
      where: { id: business.id },
      data: {
        isOnVacation,
        vacationMessage: isOnVacation ? vacationMessage : null,
      },
    });
  }

  // ============================================
  // BUSINESS IMAGES
  // ============================================

  async getImages(businessId: string) {
    return this.prisma.businessImage.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getImagesBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return this.prisma.businessImage.findMany({
      where: { businessId: business.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addImage(userId: string, url: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Check image count (max 10)
    const imageCount = await this.prisma.businessImage.count({
      where: { businessId: business.id },
    });

    if (imageCount >= 10) {
      throw new ForbiddenException('Maximum 10 images autorisées');
    }

    // Get max sortOrder
    const maxSort = await this.prisma.businessImage.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });

    return this.prisma.businessImage.create({
      data: {
        businessId: business.id,
        url,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async deleteImage(userId: string, imageId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const image = await this.prisma.businessImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    // Delete from R2
    const key = this.uploadService.extractKeyFromUrl(image.url);
    if (key) {
      await this.uploadService.deleteFile(key);
    }

    await this.prisma.businessImage.delete({
      where: { id: imageId },
    });

    return { success: true };
  }

  async reorderImages(userId: string, imageIds: string[]) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    // Update sort order for each image
    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.businessImage.updateMany({
          where: { id, businessId: business.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.getImages(business.id);
  }
}
