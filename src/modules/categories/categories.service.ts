import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async findAll(locale: string = 'fr') {
    // Check cache first (locale-specific)
    const cacheKey = `${CacheService.categoriesKey()}:${locale}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      include: {
        children: {
          include: {
            _count: { select: { businessServices: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { businessServices: true } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });

    // Apply translations
    const translated = categories.map((cat) => this.applyTranslation(cat, locale));

    // Cache the result
    await this.cacheService.set(cacheKey, translated, CacheService.TTL.CATEGORIES);

    return translated;
  }

  async findOne(id: string, locale: string = 'fr') {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            _count: { select: { businessServices: true } },
          },
        },
        parent: true,
        _count: { select: { businessServices: true } },
      },
    });

    return category ? this.applyTranslation(category, locale) : null;
  }

  async findBySlug(slug: string, locale: string = 'fr') {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          include: {
            _count: { select: { businessServices: true } },
          },
        },
        parent: true,
        _count: { select: { businessServices: true } },
      },
    });

    return category ? this.applyTranslation(category, locale) : null;
  }

  /**
   * Applies locale-specific translation to a category's name.
   * Falls back to the default French name if no translation exists.
   * The `translations` field is a JSON like: { "en": "Hairdresser", "pt": "Cabeleireiro" }
   */
  private applyTranslation(category: any, locale: string): any {
    if (locale === 'fr') return category; // French is the default stored in `name`

    const translations = category.translations as Record<string, string> | null;
    const translatedName = translations?.[locale];

    const result = {
      ...category,
      name: translatedName || category.name, // Fallback to French
    };

    // Also translate children if present
    if (result.children) {
      result.children = result.children.map((child: any) =>
        this.applyTranslation(child, locale),
      );
    }

    // Also translate parent if present
    if (result.parent) {
      result.parent = this.applyTranslation(result.parent, locale);
    }

    return result;
  }
}
