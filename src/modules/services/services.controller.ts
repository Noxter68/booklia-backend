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

  // Public endpoints
  @Get('suggest')
  async suggest(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.servicesService.suggest(query, limit ? parseInt(limit, 10) : 5);
  }

  @Get('search')
  async search(@Query() dto: SearchServicesDto) {
    return this.servicesService.search(dto);
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    return this.servicesService.findPublishedByUser(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.servicesService.findOneOrFail(id);
  }

  // Protected endpoints
  @Post()
  @UseGuards(AuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(user.id, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard)
  async publish(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.publish(user.id, id);
  }

  @Post(':id/pause')
  @UseGuards(AuthGuard)
  async pause(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.pause(user.id, id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.servicesService.delete(user.id, id);
  }

  @Get('me/services')
  @UseGuards(AuthGuard)
  async findMyServices(@CurrentUser() user: User) {
    return this.servicesService.findByUser(user.id);
  }
}
