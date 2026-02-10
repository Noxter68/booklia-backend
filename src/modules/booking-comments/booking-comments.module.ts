import { Module } from '@nestjs/common';
import { BookingCommentsController } from './booking-comments.controller';
import { BookingCommentsService } from './booking-comments.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingCommentsController],
  providers: [BookingCommentsService],
  exports: [BookingCommentsService],
})
export class BookingCommentsModule {}
