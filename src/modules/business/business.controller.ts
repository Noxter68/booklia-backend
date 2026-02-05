import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  CreateBusinessServiceDto,
  UpdateBusinessServiceDto,
  SearchBusinessDto,
} from './dto/business.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: any, @Body() dto: CreateBusinessDto) {
    return this.businessService.create(req.user.id, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  findMine(@Req() req: any) {
    return this.businessService.findByOwner(req.user.id);
  }

  @Put()
  @UseGuards(AuthGuard)
  update(@Req() req: any, @Body() dto: UpdateBusinessDto) {
    return this.businessService.update(req.user.id, dto);
  }

  @Get('search')
  search(@Query() dto: SearchBusinessDto) {
    return this.businessService.search(dto);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.businessService.findBySlug(slug);
  }

  // ============================================
  // BUSINESS SERVICES
  // ============================================

  @Post('services')
  @UseGuards(AuthGuard)
  createService(@Req() req: any, @Body() dto: CreateBusinessServiceDto) {
    return this.businessService.createService(req.user.id, dto);
  }

  @Put('services/:id')
  @UseGuards(AuthGuard)
  updateService(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessServiceDto,
  ) {
    return this.businessService.updateService(req.user.id, id, dto);
  }

  @Delete('services/:id')
  @UseGuards(AuthGuard)
  deleteService(@Req() req: any, @Param('id') id: string) {
    return this.businessService.deleteService(req.user.id, id);
  }

  @Get(':id/services')
  getServices(@Param('id') id: string) {
    return this.businessService.getServices(id);
  }
}
