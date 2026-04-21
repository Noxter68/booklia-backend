import { Module, forwardRef } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientsModule } from '../clients/clients.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => ClientsModule),
    CacheModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
