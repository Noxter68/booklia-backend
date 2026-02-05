import { Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    // Check if it looks like a CUID (starts with 'c' and is 25 chars)
    if (idOrSlug.length === 25 && idOrSlug.startsWith('c')) {
      return this.categoriesService.findOne(idOrSlug);
    }
    // Otherwise treat as slug
    return this.categoriesService.findBySlug(idOrSlug);
  }
}
