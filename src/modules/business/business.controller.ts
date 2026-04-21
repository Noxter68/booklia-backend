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
  UpdateBusinessHoursDto,
  CreateBusinessCategoryDto,
  UpdateBusinessCategoryDto,
  UpdateVacationModeDto,
  AddBusinessImageDto,
  ReorderBusinessImagesDto,
  CreateBusinessPromotionDto,
  UpdateBusinessPromotionDto,
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

  @Get('owner/:userId')
  findByOwnerId(@Param('userId') userId: string) {
    return this.businessService.findByOwnerPublic(userId);
  }

  // ============================================
  // BUSINESS PROMOTIONS (must be before :slug)
  // ============================================

  @Get('promotions/mine')
  @UseGuards(AuthGuard)
  async getMyPromotions(@Req() req: any) {
    const business = await this.businessService.findByOwner(req.user.id);
    return this.businessService.getPromotions(business.id);
  }

  @Post('promotions')
  @UseGuards(AuthGuard)
  createPromotion(@Req() req: any, @Body() dto: CreateBusinessPromotionDto) {
    return this.businessService.createPromotion(req.user.id, dto);
  }

  @Put('promotions/:id')
  @UseGuards(AuthGuard)
  updatePromotion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessPromotionDto,
  ) {
    return this.businessService.updatePromotion(req.user.id, id, dto);
  }

  @Delete('promotions/:id')
  @UseGuards(AuthGuard)
  deletePromotion(@Req() req: any, @Param('id') id: string) {
    return this.businessService.deletePromotion(req.user.id, id);
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

  // ============================================
  // BUSINESS HOURS
  // ============================================

  @Get('hours/mine')
  @UseGuards(AuthGuard)
  async getMyHours(@Req() req: any) {
    const business = await this.businessService.findByOwner(req.user.id);
    return this.businessService.getHours(business.id);
  }

  @Put('hours')
  @UseGuards(AuthGuard)
  updateHours(@Req() req: any, @Body() dto: UpdateBusinessHoursDto) {
    return this.businessService.updateHours(req.user.id, dto);
  }

  @Get(':slug/hours')
  getHoursBySlug(@Param('slug') slug: string) {
    return this.businessService.getHoursBySlug(slug);
  }

  // ============================================
  // BUSINESS CATEGORIES
  // ============================================

  @Get('categories/mine')
  @UseGuards(AuthGuard)
  async getMyCategories(@Req() req: any) {
    const business = await this.businessService.findByOwner(req.user.id);
    return this.businessService.getCategories(business.id);
  }

  @Post('categories')
  @UseGuards(AuthGuard)
  createCategory(@Req() req: any, @Body() dto: CreateBusinessCategoryDto) {
    return this.businessService.createCategory(req.user.id, dto);
  }

  @Put('categories/:id')
  @UseGuards(AuthGuard)
  updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessCategoryDto,
  ) {
    return this.businessService.updateCategory(req.user.id, id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard)
  deleteCategory(@Req() req: any, @Param('id') id: string) {
    return this.businessService.deleteCategory(req.user.id, id);
  }

  // ============================================
  // VACATION MODE
  // ============================================

  @Put('vacation')
  @UseGuards(AuthGuard)
  updateVacationMode(@Req() req: any, @Body() dto: UpdateVacationModeDto) {
    return this.businessService.updateVacationMode(
      req.user.id,
      dto.isOnVacation,
      dto.vacationMessage,
    );
  }

  // ============================================
  // BUSINESS IMAGES
  // ============================================

  @Get('images/mine')
  @UseGuards(AuthGuard)
  async getMyImages(@Req() req: any) {
    const business = await this.businessService.findByOwner(req.user.id);
    return this.businessService.getImages(business.id);
  }

  @Post('images')
  @UseGuards(AuthGuard)
  addImage(@Req() req: any, @Body() dto: AddBusinessImageDto) {
    return this.businessService.addImage(req.user.id, dto.url);
  }

  @Delete('images/:id')
  @UseGuards(AuthGuard)
  deleteImage(@Req() req: any, @Param('id') id: string) {
    return this.businessService.deleteImage(req.user.id, id);
  }

  @Put('images/reorder')
  @UseGuards(AuthGuard)
  reorderImages(@Req() req: any, @Body() dto: ReorderBusinessImagesDto) {
    return this.businessService.reorderImages(req.user.id, dto.imageIds);
  }

  @Get(':slug/images')
  getImagesBySlug(@Param('slug') slug: string) {
    return this.businessService.getImagesBySlug(slug);
  }
}
