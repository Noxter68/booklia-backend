import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ReferralsService } from './referrals.service';
import { CreateReferralDto } from './dto/create-referral.dto';

@Controller('referrals')
@UseGuards(AuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateReferralDto) {
    return this.referralsService.create(req.user.id, dto);
  }

  @Get('mine')
  async listMine(@Req() req: any) {
    return this.referralsService.listMine(req.user.id);
  }
}

@Controller('admin/referrals')
@UseGuards(AuthGuard, AdminGuard)
export class AdminReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  async listGroupedByBusiness() {
    return this.referralsService.adminListGroupedByBusiness();
  }

  @Get('business/:businessId')
  async listForBusiness(@Param('businessId') businessId: string) {
    return this.referralsService.adminListForBusiness(businessId);
  }

  @Patch(':id/validate')
  async validate(@Param('id') id: string) {
    return this.referralsService.adminValidate(id);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.referralsService.adminReject(id, reason);
  }

  @Patch(':id/notes')
  async updateNotes(@Param('id') id: string, @Body('notes') notes: string | null) {
    return this.referralsService.adminUpdateNotes(id, notes);
  }
}
