import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
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
