import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MAX_PROFILE_IMAGES = 10;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        reputation: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: dto,
      create: {
        userId,
        ...dto,
      },
    });
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        subscriptionStatus: true,
        profile: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        reputation: true,
        reviewsReceived: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // ============================================
  // PROFILE IMAGES
  // ============================================

  async getProfileImages(userId: string) {
    // First ensure profile exists
    await this.ensureProfileExists(userId);

    return this.prisma.peopleImage.findMany({
      where: { profileId: userId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addProfileImage(userId: string, url: string) {
    await this.ensureProfileExists(userId);

    // Check count limit
    const count = await this.prisma.peopleImage.count({
      where: { profileId: userId },
    });

    if (count >= MAX_PROFILE_IMAGES) {
      throw new BadRequestException(
        `Maximum ${MAX_PROFILE_IMAGES} images allowed`,
      );
    }

    // Get next sortOrder
    const lastImage = await this.prisma.peopleImage.findFirst({
      where: { profileId: userId },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.peopleImage.create({
      data: {
        profileId: userId,
        url,
        sortOrder: lastImage ? lastImage.sortOrder + 1 : 0,
      },
    });
  }

  async deleteProfileImage(userId: string, imageId: string) {
    const image = await this.prisma.peopleImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.profileId !== userId) {
      throw new ForbiddenException('You can only delete your own images');
    }

    await this.prisma.peopleImage.delete({
      where: { id: imageId },
    });

    return { success: true };
  }

  async reorderProfileImages(userId: string, imageIds: string[]) {
    // Verify all images belong to this user
    const images = await this.prisma.peopleImage.findMany({
      where: { profileId: userId },
    });

    const userImageIds = images.map((img) => img.id);
    const allBelongToUser = imageIds.every((id) => userImageIds.includes(id));

    if (!allBelongToUser) {
      throw new ForbiddenException('Invalid image IDs');
    }

    // Update sortOrder for each image
    await Promise.all(
      imageIds.map((id, index) =>
        this.prisma.peopleImage.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.getProfileImages(userId);
  }

  private async ensureProfileExists(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      await this.prisma.profile.create({
        data: { userId },
      });
    }
  }
}
