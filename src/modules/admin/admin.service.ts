import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  private generatePassword(length = 12): string {
    return randomBytes(length).toString('base64').slice(0, length);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async createBusiness(dto: CreateBusinessDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });

    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    // Generate password
    const generatedPassword = this.generatePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Generate unique slug
    let slug = this.generateSlug(dto.businessName);
    const existingSlug = await this.prisma.business.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    }

    // Create user, account, and business in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.ownerEmail,
          name: `${dto.ownerFirstName} ${dto.ownerLastName}`,
        },
      });

      // Create account with password
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: 'credentials',
          password: hashedPassword,
        },
      });

      // Create business
      const business = await tx.business.create({
        data: {
          ownerId: user.id,
          name: dto.businessName,
          slug,
          phone: dto.phone,
          city: dto.city,
          address: dto.address,
          postalCode: dto.postalCode,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isEarlyAdopter: dto.isEarlyAdopter ?? false,
        },
      });

      return { user, business };
    });

    // Invalidate search cache
    await this.cacheService.delByPattern('search:business:*');

    return {
      business: result.business,
      owner: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      generatedPassword,
    };
  }

  async listBusinesses(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              services: true,
              employees: true,
            },
          },
        },
      }),
      this.prisma.business.count(),
    ]);

    return {
      data: businesses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBusiness(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        services: true,
        employees: true,
        _count: {
          select: {
            services: true,
            employees: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    return business;
  }

  async resetBusinessPassword(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const generatedPassword = this.generatePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    await this.prisma.account.updateMany({
      where: {
        userId: business.ownerId,
        providerId: 'credentials',
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      email: business.owner.email,
      generatedPassword,
    };
  }

  async toggleBusinessActive(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { isActive: !business.isActive },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(CacheService.businessKey(business.slug)),
      this.cacheService.delByPattern('search:business:*'),
    ]);

    return updated;
  }

  async verifyBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { isVerified: true },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(CacheService.businessKey(business.slug)),
      this.cacheService.delByPattern('search:business:*'),
    ]);

    return updated;
  }

  async toggleEarlyAdopter(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { isEarlyAdopter: !business.isEarlyAdopter },
    });

    // Invalidate caches
    await Promise.all([
      this.cacheService.del(CacheService.businessKey(business.slug)),
      this.cacheService.delByPattern('search:business:*'),
    ]);

    return updated;
  }

}
