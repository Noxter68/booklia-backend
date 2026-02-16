import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async findAll() {
    // Check cache first
    const cacheKey = CacheService.categoriesKey();
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      include: {
        children: {
          include: {
            _count: { select: { services: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { services: true } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });

    // Cache the result
    await this.cacheService.set(cacheKey, categories, CacheService.TTL.CATEGORIES);

    return categories;
  }

  async findOne(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            _count: { select: { services: true } },
          },
        },
        parent: true,
        _count: { select: { services: true } },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          include: {
            _count: { select: { services: true } },
          },
        },
        parent: true,
        _count: { select: { services: true } },
      },
    });
  }
}
