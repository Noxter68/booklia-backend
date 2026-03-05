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
import { CalendarService } from './calendar.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { GetCalendarEntriesDto } from './dto/get-calendar-entries.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateCalendarEntryDto } from './dto/update-calendar-entry.dto';

@Controller('calendar')
@UseGuards(AuthGuard)
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get('entries')
  getEntries(
    @CurrentUser() user: User,
    @Query() dto: GetCalendarEntriesDto,
  ) {
    return this.calendarService.getEntries(user.id, dto);
  }

  @Post('appointments')
  createAppointment(
    @CurrentUser() user: User,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.calendarService.createAppointment(user.id, dto);
  }

  @Post('blocks')
  createBlock(
    @CurrentUser() user: User,
    @Body() dto: CreateBlockDto,
  ) {
    return this.calendarService.createBlock(user.id, dto);
  }

  @Patch('entries/:id')
  updateEntry(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEntryDto,
  ) {
    return this.calendarService.updateEntry(user.id, id, dto);
  }

  @Delete('blocks/:id')
  deleteBlock(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.calendarService.deleteBlock(user.id, id);
  }
}
