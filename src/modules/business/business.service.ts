import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  CreateBusinessServiceDto,
  UpdateBusinessServiceDto,
  SearchBusinessDto,
} from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

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

    // Create business and update user
    const [business] = await this.prisma.$transaction([
      this.prisma.business.create({
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
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isBusiness: true },
      }),
    ]);

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
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return business;
  }

  async findBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug, isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            reputation: true,
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
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

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

    return this.prisma.business.update({
      where: { id: business.id },
      data: dto,
      include: {
        employees: true,
        services: true,
      },
    });
  }

  async search(dto: SearchBusinessDto) {
    const { q, city, categoryId, limit = 20, offset = 0 } = dto;

    const where: any = {
      isActive: true,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (categoryId) {
      where.services = {
        some: {
          categoryId,
          isActive: true,
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include: {
          owner: {
            select: {
              reputation: true,
            },
          },
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
        orderBy: [
          { subscriptionTier: 'desc' }, // Premium businesses first
          { isVerified: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.business.count({ where }),
    ]);

    return { data, total, limit, offset };
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
}
