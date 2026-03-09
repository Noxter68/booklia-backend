import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BookingNotesController } from './booking-notes.controller';
import { BookingNotesService } from './booking-notes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BookingNotesController],
  providers: [BookingNotesService],
  exports: [BookingNotesService],
})
export class BookingNotesModule {}
