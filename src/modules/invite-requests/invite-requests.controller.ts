import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { InviteRequestsService } from './invite-requests.service';
import { CreateInviteRequestDto } from './dto/create-invite-request.dto';

@Controller('invite-requests')
export class InviteRequestsController {
  constructor(private readonly service: InviteRequestsService) {}

  // Public endpoint: anyone visiting the landing can submit a request.
  // 5 submissions per IP per minute on top of the per-email Redis limit.
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async create(@Body() dto: CreateInviteRequestDto) {
    return this.service.create(dto);
  }
}

@Controller('admin/invite-requests')
@UseGuards(AuthGuard, AdminGuard)
export class AdminInviteRequestsController {
  constructor(private readonly service: InviteRequestsService) {}

  @Get()
  async list() {
    return this.service.adminList();
  }

  @Get('pending-count')
  async pendingCount(@Query('since') since?: string) {
    return this.service.adminPendingCount(since);
  }

  @Patch(':id/notes')
  async updateNotes(@Param('id') id: string, @Body('notes') notes: string | null) {
    return this.service.adminUpdateNotes(id, notes);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.adminDelete(id);
  }
}
