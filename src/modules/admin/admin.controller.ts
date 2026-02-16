import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('business')
  async createBusiness(@Body() dto: CreateBusinessDto) {
    return this.adminService.createBusiness(dto);
  }

  @Get('businesses')
  async listBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listBusinesses(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('business/:id')
  async getBusiness(@Param('id') id: string) {
    return this.adminService.getBusiness(id);
  }

  @Patch('business/:id/reset-password')
  async resetPassword(@Param('id') id: string) {
    return this.adminService.resetBusinessPassword(id);
  }

  @Patch('business/:id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    return this.adminService.toggleBusinessActive(id);
  }

  @Patch('business/:id/verify')
  async verify(@Param('id') id: string) {
    return this.adminService.verifyBusiness(id);
  }

  @Patch('business/:id/toggle-early-adopter')
  async toggleEarlyAdopter(@Param('id') id: string) {
    return this.adminService.toggleEarlyAdopter(id);
  }

  @Get('users')
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
