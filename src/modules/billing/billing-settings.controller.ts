import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { BillingSettingsService } from './billing-settings.service';
import { UpsertBillingSettingsDto } from './dto/billing-settings.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('billing/settings')
@UseGuards(AuthGuard)
export class BillingSettingsController {
  constructor(
    private readonly billingSettingsService: BillingSettingsService,
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

  @Get()
  async getSettings(@Req() req: any) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.billingSettingsService.get(businessId);
  }

  @Post()
  async upsertSettings(
    @Req() req: any,
    @Body() dto: UpsertBillingSettingsDto,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.billingSettingsService.upsert(businessId, dto);
  }
}
