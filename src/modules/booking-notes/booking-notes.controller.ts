import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { BookingNotesService } from './booking-notes.service';
import { UpsertBookingNoteDto } from './dto/booking-note.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('booking-notes')
@UseGuards(AuthGuard)
export class BookingNotesController {
  constructor(
    private readonly bookingNotesService: BookingNotesService,
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

  @Get('client/:clientId/last')
  async getClientLastNote(
    @Req() req: any,
    @Param('clientId') clientId: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.bookingNotesService.getClientLastNote(businessId, clientId);
  }

  @Get('client/:clientId')
  async getClientNotes(
    @Req() req: any,
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.bookingNotesService.getClientNotes(
      businessId,
      clientId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':bookingId')
  async getNote(@Req() req: any, @Param('bookingId') bookingId: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.bookingNotesService.getNote(businessId, bookingId);
  }

  @Post()
  async upsertNote(@Req() req: any, @Body() dto: UpsertBookingNoteDto) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.bookingNotesService.upsert(businessId, req.user.id, dto);
  }

  @Delete(':bookingId')
  async deleteNote(@Req() req: any, @Param('bookingId') bookingId: string) {
    const businessId = await this.getBusinessId(req.user.id);
    return this.bookingNotesService.delete(businessId, bookingId);
  }
}
