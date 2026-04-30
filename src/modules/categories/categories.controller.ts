import { Controller, Get, Param, Headers, Header } from '@nestjs/common';
import { CategoriesService } from './categories.service';

// Categories change rarely; let browsers cache them and revalidate softly.
const PUBLIC_CACHE = 'public, max-age=300, stale-while-revalidate=600';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  async findAll(@Headers('accept-language') acceptLanguage?: string) {
    const locale = this.parseLocale(acceptLanguage);
    return this.categoriesService.findAll(locale);
  }

  @Get(':idOrSlug')
  @Header('Cache-Control', PUBLIC_CACHE)
  async findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = this.parseLocale(acceptLanguage);
    // Check if it looks like a CUID (starts with 'c' and is 25 chars)
    if (idOrSlug.length === 25 && idOrSlug.startsWith('c')) {
      return this.categoriesService.findOne(idOrSlug, locale);
    }
    // Otherwise treat as slug
    return this.categoriesService.findBySlug(idOrSlug, locale);
  }

  private parseLocale(acceptLanguage?: string): string {
    if (!acceptLanguage) return 'fr';
    // Extract primary language: "en-US,en;q=0.9,fr;q=0.8" → "en"
    const primary = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();
    if (primary && ['fr', 'en', 'pt'].includes(primary)) return primary;
    return 'fr';
  }
}
