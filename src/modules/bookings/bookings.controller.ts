import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBookingDto, RejectBookingDto } from './dto/create-booking.dto';
import { User } from '@prisma/client';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookingsService.accept(user.id, id);
  }

  @Post(':id/complete')
  async complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookingsService.complete(user.id, id);
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookingsService.cancel(user.id, id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingsService.reject(user.id, id, dto.message);
  }

  @Get('me')
  async findMyBookings(
    @CurrentUser() user: User,
    @Query('role') role?: 'requester' | 'provider',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.findByUser(user.id, role, from, to);
  }

  @Get('revenue-stats')
  async revenueStats(
    @CurrentUser() user: User,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.bookingsService.getRevenueStats(
      user.id,
      new Date(from),
      new Date(to),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOneOrFail(id);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookingsService.deleteByRequester(user.id, id);
  }
}
