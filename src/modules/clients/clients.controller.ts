import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateBusinessClientDto, UpdateBusinessClientDto } from './dto/client.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('business/clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getBusinessId(userId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }
    return business.id;
  }

  @Post()
  async createClient(@Req() req: any, @Body() dto: CreateBusinessClientDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.createClient(businessId, dto);
  }

  @Get()
  async getClients(@Req() req: any, @Query('search') search?: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.getClientsForBusiness(businessId, search);
  }

  @Get('growth-stats')
  async growthStats(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.getClientGrowthStats(
      businessId,
      new Date(from),
      new Date(to),
    );
  }

  @Get(':clientId')
  async getClientDetail(
    @Req() req: any,
    @Param('clientId') clientId: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.getClientDetail(businessId, clientId);
  }

  @Put(':clientId')
  async updateClient(
    @Req() req: any,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateBusinessClientDto,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.updateClient(businessId, clientId, dto);
  }

  @Get(':clientId/bookings')
  async getClientBookings(
    @Req() req: any,
    @Param('clientId') clientId: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.clientsService.getClientBookings(businessId, clientId);
  }
}
