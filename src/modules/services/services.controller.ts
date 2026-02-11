/**
 * Services Controller
 *
 * REST API endpoints for P2P service listings.
 * Public endpoints for search/view, authenticated endpoints for CRUD operations.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import { User } from '@prisma/client';

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /** Quick service suggestions for search autocomplete */
  @Get('suggest')
  suggest(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.servicesService.suggest(query, limit ? parseInt(limit, 10) : 5);
  }

  /** Search services with filters (text, location, price, etc.) */
  @Get('search')
  search(@Query() dto: SearchServicesDto) {
    return this.servicesService.search(dto);
  }

  /** Get published services for a user's public profile */
  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.servicesService.findPublishedByUser(userId);
  }

  /** Get a single service by ID */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOneOrFail(id);
  }

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  /** Create a new service listing */
  @Post()
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user.id, dto);
  }

  /** Update a service (owner only) */
  @Patch(':id')
  @UseGuards(AuthGuard)
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(user.id, id, dto);
  }

  /** Publish a service (make visible in search) */
  @Post(':id/publish')
  @UseGuards(AuthGuard)
  publish(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.publish(user.id, id);
  }

  /** Pause a service (hide from search) */
  @Post(':id/pause')
  @UseGuards(AuthGuard)
  pause(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.pause(user.id, id);
  }

  /** Delete a service (owner only) */
  @Delete(':id')
  @UseGuards(AuthGuard)
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.delete(user.id, id);
  }

  /** Get all services owned by current user (including drafts) */
  @Get('me/services')
  @UseGuards(AuthGuard)
  findMyServices(@CurrentUser() user: User) {
    return this.servicesService.findByUser(user.id);
  }
}
