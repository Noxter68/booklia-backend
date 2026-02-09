import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto, AddProfileImageDto, ReorderProfileImagesDto } from './dto/update-profile.dto';
import { User } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/profile')
  @UseGuards(AuthGuard)
  async getMyProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me/profile')
  @UseGuards(AuthGuard)
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  // ============================================
  // PROFILE IMAGES
  // ============================================

  @Get('me/images')
  @UseGuards(AuthGuard)
  async getMyImages(@CurrentUser() user: User) {
    return this.usersService.getProfileImages(user.id);
  }

  @Post('me/images')
  @UseGuards(AuthGuard)
  async addImage(@CurrentUser() user: User, @Body() dto: AddProfileImageDto) {
    return this.usersService.addProfileImage(user.id, dto.url);
  }

  @Delete('me/images/:id')
  @UseGuards(AuthGuard)
  async deleteImage(@CurrentUser() user: User, @Param('id') id: string) {
    return this.usersService.deleteProfileImage(user.id, id);
  }

  @Put('me/images/reorder')
  @UseGuards(AuthGuard)
  async reorderImages(
    @CurrentUser() user: User,
    @Body() dto: ReorderProfileImagesDto,
  ) {
    return this.usersService.reorderProfileImages(user.id, dto.imageIds);
  }

  @Get(':id/images')
  async getPublicProfileImages(@Param('id') id: string) {
    return this.usersService.getProfileImages(id);
  }
}
