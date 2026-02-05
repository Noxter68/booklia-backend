import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async suggest(query: string) {
    if (!query || query.length < 2) {
      return [];
    }

    return this.prisma.tag.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });
  }

  async findOrCreate(name: string) {
    const normalized = name.toLowerCase().trim();

    return this.prisma.tag.upsert({
      where: { name: normalized },
      update: {},
      create: { name: normalized },
    });
  }
}
